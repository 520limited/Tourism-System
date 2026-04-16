const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const qwenAIService = require('../services/ai/qwenAIService');
const amapService = require('../services/external/amapService');
const hotelSearchService = require('../services/external/hotelSearchService');
const locationVerifyService = require('../services/trip/locationVerifyService');
const costCalculatorService = require('../services/trip/costCalculatorService');
const smartPlanningService = require('../services/trip/smartPlanningService');
const tripService = require('../services/trip/tripService');
const refreshService = require('../services/trip/refreshService');
const userService = require('../services/user/userService');
const logger = require('../services/logger');

const sessions = new Map();

// 公开会话引用（供其他模块如 popularityController 访问 enhanced 数据）
const getSession = (id) => sessions.get(id);

/**
 * 公共辅助函数：处理 AI 生成的行程结果
 * 包含坐标验证、天气合并、费用计算、智能规划增强、数据库保存
 */
async function processAndSaveItinerary(aiResult, session, sessionId, existingTripId, userId) {
  const hotelArea = aiResult.requirements.hotelArea || '五一广场';
  const hotelBudget = aiResult.requirements.budget || '500-1000';

  // 并行：酒店搜索 + 坐标验证 + 天气获取
  const [realtimeHotels, verifiedItinerary, weatherData] = await Promise.all([
    hotelSearchService.searchHotelsByAreaAndBudget(hotelArea, hotelBudget, 3),
    locationVerifyService.verifyItinerary(aiResult.itinerary),
    amapService.getWeather()
  ]);

  verifiedItinerary.forEach(day => { day.hotels = realtimeHotels; });

  // 天气数据合并到每天
  if (weatherData && weatherData.forecast) {
    verifiedItinerary.forEach((day, index) => {
      if (weatherData.forecast[index]) day.weather = weatherData.forecast[index];
    });
  }

  // 费用计算
  const costData = costCalculatorService.calculateTotalCost(verifiedItinerary, aiResult.requirements);
  const costReport = costCalculatorService.generateCostReport(costData);
  verifiedItinerary.forEach((day, index) => {
    if (costData?.dailyCosts[index]) day.dailyCost = costData.dailyCosts[index];
  });

  // 智能规划增强（交通推荐等）
  const enhancedPlanning = await smartPlanningService.enhanceItinerary(verifiedItinerary, {
    budget: aiResult.requirements.budget,
    timeSensitive: true,
    comfort: aiResult.requirements.crowd === '情侣' || aiResult.requirements.crowd === '家庭'
  });

  // 交通数据合并
  if (enhancedPlanning.transports) {
    enhancedPlanning.transports.forEach(dayTransport => {
      const day = verifiedItinerary.find(d => d.day === dayTransport.day);
      if (day) day.transports = dayTransport.routes;
    });
  }

  // 保存到数据库
  let tripId = existingTripId;
  if (existingTripId) {
    await tripService.updateTrip(existingTripId, {
      requirements: aiResult.requirements,
      itinerary: verifiedItinerary,
      activities: aiResult.activities || [],
      crowdPredictions: [],
      timeEstimates: []
    });
    await tripService.saveTripRoutes(existingTripId, verifiedItinerary);
  } else {
    const tripResult = await tripService.createTrip(
      userId, aiResult.requirements, verifiedItinerary, [], [], aiResult.activities || [], null, [], []
    );
    tripId = tripResult.tripId;
    await tripService.saveTripRoutes(tripId, verifiedItinerary);
  }

  return { verifiedItinerary, costReport, enhancedPlanning, tripId };
}

// 加载已有行程到 session
async function loadExistingTrip(session, existingTripId) {
  if (!existingTripId) return;
  const existingTrip = await tripService.getTripById(existingTripId);
  if (existingTrip) {
    if (existingTrip.conversationHistory?.length > 0) {
      session.history = existingTrip.conversationHistory;
    }
    if (existingTrip.itinerary?.length > 0) {
      session.itinerary = existingTrip.itinerary;
    }
    if (existingTrip.requirements) {
      session.requirements = existingTrip.requirements;
    }
  }
}

// ==================== 行程规划接口 ====================

// 生成行程 (POST /plan)
router.post('/plan', async (req, res) => {
  try {
    const { message, tripId: existingTripId } = req.body;
    const sessionId = req.headers['x-session-id'] || uuidv4();

    if (!message?.trim()) return res.status(400).json({ code: 400, message: '请输入您的旅行需求' });

    let session = sessions.get(sessionId) || { history: [], requirements: {}, itinerary: [], status: 'planning' };
    await loadExistingTrip(session, existingTripId);
    session.history.push({ role: 'user', content: message });

    // AI 生成行程
    const aiResult = await qwenAIService.generateTripFromNaturalLanguage(message, session.history);
    if (!aiResult.ready || aiResult.error) {
      return res.status(500).json({ code: 500, message: '行程生成失败，请重试' });
    }

    // 获取用户ID
    let userId = null;
    const user = await userService.getUserBySession(sessionId);
    if (user) userId = user.userId;

    // 处理并保存行程
    const { verifiedItinerary, costReport, enhancedPlanning, tripId } = await processAndSaveItinerary(
      aiResult, session, sessionId, existingTripId, userId
    );

    // 更新 session
    session.requirements = aiResult.requirements;
    session.itinerary = verifiedItinerary;
    session.enhancedPlanning = enhancedPlanning;
    session.status = 'completed';
    session.history.push({ role: 'assistant', content: aiResult.message });
    sessions.set(sessionId, session);

    res.json({
      code: 200,
      data: {
        message: aiResult.message, sessionId, tripId,
        requirements: aiResult.requirements,
        activities: aiResult.activities || [],
        itinerary: verifiedItinerary,
        costData: costReport,
        enhancedPlanning,
        ready: true
      }
    });
  } catch (error) {
    logger.error(`行程规划失败: ${error.message}`);
    res.status(500).json({ code: 500, message: error.message || '行程规划失败' });
  }
});

// 聊天接口 - 用于调整行程 (POST /chat)
router.post('/chat', async (req, res) => {
  try {
    const { message, tripId: existingTripId } = req.body;
    const sessionId = req.headers['x-session-id'] || uuidv4();

    if (!message?.trim()) return res.status(400).json({ code: 400, message: '消息不能为空' });

    let userId = null;
    const user = await userService.getUserBySession(sessionId);
    if (user) userId = user.userId;

    let session = sessions.get(sessionId) || { history: [], requirements: {}, itinerary: [], status: 'chatting' };
    await loadExistingTrip(session, existingTripId);
    session.history.push({ role: 'user', content: message });

    // 获取天气后调用 AI
    const weatherData = await amapService.getWeather();
    const aiResult = await qwenAIService.generateTripFromNaturalLanguage(message, session.history, weatherData);
    session.history.push({ role: 'assistant', content: aiResult.message });

    if (aiResult.ready && aiResult.itinerary?.length > 0) {
      const verifiedItinerary = await locationVerifyService.verifyItinerary(aiResult.itinerary);
      session.itinerary = verifiedItinerary;
      session.requirements = aiResult.requirements;

      // 合并天气
      if (weatherData?.forecast) {
        verifiedItinerary.forEach((day, index) => {
          if (weatherData.forecast[index]) day.weather = weatherData.forecast[index];
        });
      }

      // 费用计算
      const costData = costCalculatorService.calculateTotalCost(verifiedItinerary, aiResult.requirements);
      const costReport = costCalculatorService.generateCostReport(costData);
      verifiedItinerary.forEach((day, index) => {
        if (costData?.dailyCosts[index]) day.dailyCost = costData.dailyCosts[index];
      });

      // 智能增强
      const enhancedPlanning = await smartPlanningService.enhanceItinerary(verifiedItinerary, {
        budget: aiResult.requirements.budget,
        timeSensitive: true,
        comfort: aiResult.requirements.crowd === '情侣' || aiResult.requirements.crowd === '家庭'
      });
      if (enhancedPlanning.transports) {
        enhancedPlanning.transports.forEach(dayTransport => {
          const day = verifiedItinerary.find(d => d.day === dayTransport.day);
          if (day) day.transports = dayTransport.routes;
        });
      }

      // 保存
      const tripResult = await tripService.createTrip(
        userId, aiResult.requirements, verifiedItinerary, session.history, [], aiResult.activities || [], sessionId
      );
      const tripId = tripResult.tripId;
      await tripService.saveTripRoutes(tripId, verifiedItinerary);

      sessions.set(sessionId, session);
      res.json({
        code: 200,
        data: { message: aiResult.message, sessionId, tripId, requirements: aiResult.requirements, activities: aiResult.activities || [], itinerary: verifiedItinerary, costData: costReport, ready: true }
      });
    } else {
      sessions.set(sessionId, session);
      res.json({
        code: 200,
        data: { message: aiResult.message, sessionId, requirements: aiResult.requirements || {}, itinerary: [], ready: false }
      });
    }
  } catch (error) {
    logger.error(`Chat error: ${error.message}`);
    res.status(500).json({ code: 500, message: error.message || '服务处理失败' });
  }
});

// ==================== 刷新接口（换一批）====================

router.post('/refresh/attractions', async (req, res) => {
  try {
    const { currentAttractions, locationContext } = req.body;
    const currentNames = Array.isArray(currentAttractions) ? currentAttractions : [];
    const newAttractions = await refreshService.refreshAttractions(currentNames, 3, null, locationContext);
    res.json({ code: 200, data: { attractions: newAttractions, message: `为您推荐了${newAttractions.length}个新景点` } });
  } catch (error) {
    logger.error(`刷新景点失败: ${error.message}`);
    res.status(500).json({ code: 500, message: '刷新景点失败' });
  }
});

router.post('/refresh/restaurants', async (req, res) => {
  try {
    const { currentRestaurants, locationContext, cuisine } = req.body;
    const currentNames = Array.isArray(currentRestaurants) ? currentRestaurants : [];
    // 有特定菜系→返回3个；全部(all)→返回10个(多类别覆盖)
    const count = cuisine && cuisine !== 'all' ? 3 : 10;
    const newRestaurants = await refreshService.refreshRestaurants(currentNames, count, null, locationContext, cuisine);
    res.json({ code: 200, data: { restaurants: newRestaurants, message: `为您推荐了${newRestaurants.length}家新餐厅` } });
  } catch (error) {
    logger.error(`刷新餐厅失败: ${error.message}`);
    res.status(500).json({ code: 500, message: '刷新餐厅失败' });
  }
});

router.post('/refresh/hotels', async (req, res) => {
  try {
    const { currentHotels, hotelArea, locationContext, starRating } = req.body;
    const currentNames = Array.isArray(currentHotels) ? currentHotels : [];
    // 有特定星级→返回3个；全部(all)→返回10个
    const count = starRating && starRating !== 'all' ? 3 : 10;
    const area = hotelArea || '五一广场';
    const newHotels = await refreshService.refreshHotels(currentNames, area, count, locationContext, starRating);
    res.json({ code: 200, data: { hotels: newHotels, message: `为您推荐了${newHotels.length}家新酒店` } });
  } catch (error) {
    logger.error(`刷新酒店失败: ${error.message}`);
    res.status(500).json({ code: 500, message: '刷新酒店失败' });
  }
});

// 增强规划查询
router.get('/plan/enhanced/:sessionId', (req, res) => {
  try {
    const session = sessions.get(req.params.sessionId);
    if (!session) return res.status(404).json({ code: 404, message: '会话不存在' });
    res.json({
      code: 200,
      data: {
        optimizations: session.enhancedPlanning?.optimizations || [],
        budgetOptimization: session.enhancedPlanning?.budgetOptimization || null
      }
    });
  } catch (error) {
    logger.error(`获取增强规划失败: ${error.message}`);
    res.status(500).json({ code: 500, message: '获取增强规划失败' });
  }
});

module.exports = { router };
