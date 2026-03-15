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
const exportService = require('../services/trip/exportService');
const favoriteService = require('../services/user/favoriteService');
const userService = require('../services/user/userService');
const emailService = require('../services/user/emailService');
const logger = require('../services/logger');

const sessions = new Map();

// ==================== 用户认证接口 ====================

// 发送验证码
router.post('/auth/send-code', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ code: 400, message: '请输入邮箱' });
    }
    
    const result = await emailService.sendVerificationCode(email);
    
    if (result.success) {
      res.json({ code: 200, message: '验证码已发送，请查收邮件' });
    } else {
      res.status(500).json({ code: 500, message: result.message });
    }
  } catch (error) {
    logger.error(`发送验证码失败: ${error.message}`);
    res.status(500).json({ code: 500, message: '发送验证码失败' });
  }
});

// 用户注册
router.post('/auth/register', async (req, res) => {
  try {
    const { email, password, nickname, code } = req.body;
    
    if (code) {
      const verifyResult = emailService.verifyCode(email, code);
      if (!verifyResult.valid) {
        return res.status(400).json({ code: 400, message: verifyResult.message });
      }
    }
    
    const result = await userService.register({ email, password, nickname });
    
    res.json({
      code: 200,
      message: '注册成功',
      data: result
    });
  } catch (error) {
    logger.error(`注册失败: ${error.message}`);
    res.status(400).json({ code: 400, message: error.message });
  }
});

// 用户登录
router.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const result = await userService.login(email, password);
    
    res.json({
      code: 200,
      message: '登录成功',
      data: {
        sessionId: result.sessionId,
        user: result.user
      }
    });
  } catch (error) {
    logger.error(`登录失败: ${error.message}`);
    res.status(401).json({ code: 401, message: error.message });
  }
});

// 用户登出
router.post('/auth/logout', async (req, res) => {
  try {
    const sessionId = req.headers['x-session-id'];
    
    if (sessionId) {
      await userService.logout(sessionId);
    }
    
    res.json({ code: 200, message: '登出成功' });
  } catch (error) {
    logger.error(`登出失败: ${error.message}`);
    res.status(500).json({ code: 500, message: '登出失败' });
  }
});

// 获取当前用户信息
router.get('/user/profile', async (req, res) => {
  try {
    const sessionId = req.headers['x-session-id'];
    
    if (!sessionId) {
      return res.status(401).json({ code: 401, message: '未登录' });
    }
    
    const user = await userService.getUserBySession(sessionId);
    
    if (!user) {
      return res.status(401).json({ code: 401, message: '会话已过期，请重新登录' });
    }
    
    res.json({ code: 200, data: user });
  } catch (error) {
    logger.error(`获取用户信息失败: ${error.message}`);
    res.status(500).json({ code: 500, message: '获取用户信息失败' });
  }
});

// 更新用户信息
router.put('/user/profile', async (req, res) => {
  try {
    const sessionId = req.headers['x-session-id'];
    
    if (!sessionId) {
      return res.status(401).json({ code: 401, message: '未登录' });
    }
    
    const user = await userService.getUserBySession(sessionId);
    if (!user) {
      return res.status(401).json({ code: 401, message: '会话已过期' });
    }
    
    const result = await userService.updateUser(user.userId, req.body);
    res.json({ code: 200, message: '更新成功', data: result });
  } catch (error) {
    logger.error(`更新用户信息失败: ${error.message}`);
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 更新用户偏好
router.put('/user/preferences', async (req, res) => {
  try {
    const sessionId = req.headers['x-session-id'];
    const { preferences } = req.body;
    
    if (!sessionId) {
      return res.status(401).json({ code: 401, message: '未登录' });
    }
    
    const user = await userService.getUserBySession(sessionId);
    if (!user) {
      return res.status(401).json({ code: 401, message: '会话已过期' });
    }
    
    const result = await userService.updatePreferences(user.userId, preferences);
    res.json({ code: 200, message: '偏好更新成功', data: result });
  } catch (error) {
    logger.error(`更新偏好失败: ${error.message}`);
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 修改密码
router.put('/user/password', async (req, res) => {
  try {
    const sessionId = req.headers['x-session-id'];
    const { oldPassword, newPassword } = req.body;
    
    if (!sessionId) {
      return res.status(401).json({ code: 401, message: '未登录' });
    }
    
    const user = await userService.getUserBySession(sessionId);
    if (!user) {
      return res.status(401).json({ code: 401, message: '会话已过期' });
    }
    
    await userService.changePassword(user.userId, oldPassword, newPassword);
    res.json({ code: 200, message: '密码修改成功' });
  } catch (error) {
    logger.error(`修改密码失败: ${error.message}`);
    res.status(400).json({ code: 400, message: error.message });
  }
});

// ==================== 行程规划接口 ====================

// 生成行程 - 优化版：并行处理，提速
router.post('/plan', async (req, res) => {
  try {
    const { message, tripId: existingTripId } = req.body;
    const sessionId = req.headers['x-session-id'] || uuidv4();

    if (!message || !message.trim()) {
      return res.status(400).json({ code: 400, message: '请输入您的旅行需求' });
    }

    let session = sessions.get(sessionId) || {
      history: [],
      requirements: {},
      itinerary: [],
      status: 'planning'
    };

    session.history.push({ role: 'user', content: message });

    // AI生成行程
    const aiResult = await qwenAIService.generateTripFromNaturalLanguage(message, session.history);

    if (!aiResult.ready || aiResult.error) {
      return res.status(500).json({ code: 500, message: '行程生成失败，请重试' });
    }

    const hotelArea = aiResult.requirements.hotelArea || '五一广场';
    const hotelBudget = aiResult.requirements.budget || '500-1000';

    // 并行执行：酒店搜索 + 坐标验证
    const [realtimeHotels, verifiedItinerary] = await Promise.all([
      hotelSearchService.searchHotelsByAreaAndBudget(hotelArea, hotelBudget, 3),
      locationVerifyService.verifyItinerary(aiResult.itinerary)
    ]);

    // 替换为实时搜索的酒店
    verifiedItinerary.forEach(day => { day.hotels = realtimeHotels; });

    // 计算费用
    const costData = costCalculatorService.calculateTotalCost(verifiedItinerary, aiResult.requirements);
    const costReport = costCalculatorService.generateCostReport(costData);

    verifiedItinerary.forEach((day, index) => {
      if (costData?.dailyCosts[index]) { day.dailyCost = costData.dailyCosts[index]; }
    });

    // 智能规划增强
    const enhancedPlanning = await smartPlanningService.enhanceItinerary(verifiedItinerary, {
      budget: aiResult.requirements.budget,
      timeSensitive: true,
      comfort: aiResult.requirements.crowd === '情侣' || aiResult.requirements.crowd === '家庭'
    });

    // 保存会话
    session.requirements = aiResult.requirements;
    session.itinerary = verifiedItinerary;
    session.costData = costData;
    session.enhancedPlanning = enhancedPlanning;
    session.status = 'completed';
    session.history.push({ role: 'assistant', content: aiResult.message });

    // 获取用户ID
    let userId = null;
    const user = await userService.getUserBySession(sessionId);
    if (user) {
      userId = user.userId;
    }
    
    // 如果有 existingTripId，更新已有行程；否则创建新行程
    let tripId = existingTripId;
    if (existingTripId) {
      await tripService.updateTrip(existingTripId, {
        requirements: aiResult.requirements,
        itinerary: aiResult.itinerary,
        activities: aiResult.activities || []
      });
    } else {
      const tripResult = await tripService.createTrip(userId, aiResult.requirements, aiResult.itinerary, [], [], aiResult.activities || []);
      tripId = tripResult.tripId;
    }
    sessions.set(sessionId, session);

    res.json({
      code: 200,
      data: {
        message: aiResult.message,
        sessionId,
        tripId,
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

// 聊天接口 - 用于调整行程
router.post('/chat', async (req, res) => {
  try {
    const { message } = req.body;
    const sessionId = req.headers['x-session-id'] || uuidv4();

    if (!message || !message.trim()) {
      return res.status(400).json({ code: 400, message: '消息不能为空' });
    }

    let session = sessions.get(sessionId) || {
      history: [],
      requirements: {},
      itinerary: [],
      status: 'chatting'
    };

    session.history.push({ role: 'user', content: message });

    // 调用AI对话
    const chatResult = await qwenAIService.chat(message, session.history);

    session.history.push({ role: 'assistant', content: chatResult.message });

    // 如果AI建议重新生成行程
    if (chatResult.adjustmentType === 'all') {
      // 更新需求
      session.requirements = { ...session.requirements, ...chatResult.requirements };
      
      // 重新生成行程
      const aiResult = await qwenAIService.generateTripFromNaturalLanguage(
        `基于之前的对话，重新生成行程。新要求：${JSON.stringify(session.requirements)}`,
        session.history
      );

      if (aiResult.ready) {
        // 验证并修正行程中的所有地点坐标
        const verifiedItinerary = await locationVerifyService.verifyItinerary(aiResult.itinerary);
        
        session.itinerary = verifiedItinerary;
        session.requirements = aiResult.requirements;

        res.json({
          code: 200,
          data: {
            message: aiResult.message,
            sessionId,
            requirements: aiResult.requirements,
            itinerary: aiResult.itinerary,
            ready: true
          }
        });
        return;
      }
    }

    sessions.set(sessionId, session);

    res.json({
      code: 200,
      data: {
        message: chatResult.message,
        sessionId,
        requirements: session.requirements,
        itinerary: session.itinerary,
        ready: session.itinerary.length > 0
      }
    });
  } catch (error) {
    logger.error(`Chat error: ${error.message}`);
    res.status(500).json({ code: 500, message: error.message || '服务处理失败' });
  }
});

// 刷新景点 - 换一批（轻量级，不调用AI）
router.post('/refresh/attractions', async (req, res) => {
  try {
    const { currentAttractions, sessionId } = req.body;
    // currentAttractions 现在是所有天已存在的景点名称数组
    const currentNames = Array.isArray(currentAttractions) ? currentAttractions : [];
    
    logger.info(`换一批景点请求: 排除 ${currentNames.length} 个已存在景点`);
    
    const newAttractions = await refreshService.refreshAttractions(currentNames, 3);
    
    res.json({
      code: 200,
      data: {
        attractions: newAttractions,
        message: `为您推荐了${newAttractions.length}个新景点`
      }
    });
  } catch (error) {
    logger.error(`刷新景点失败: ${error.message}`);
    res.status(500).json({ code: 500, message: '刷新景点失败' });
  }
});

// 刷新餐厅 - 换一批（轻量级，不调用AI）
router.post('/refresh/restaurants', async (req, res) => {
  try {
    const { currentRestaurants, sessionId } = req.body;
    // currentRestaurants 现在是所有天已存在的餐厅名称数组
    const currentNames = Array.isArray(currentRestaurants) ? currentRestaurants : [];
    
    logger.info(`换一批餐厅请求: 排除 ${currentNames.length} 个已存在餐厅`);
    
    const newRestaurants = await refreshService.refreshRestaurants(currentNames, 3);
    
    res.json({
      code: 200,
      data: {
        restaurants: newRestaurants,
        message: `为您推荐了${newRestaurants.length}家新餐厅`
      }
    });
  } catch (error) {
    logger.error(`刷新餐厅失败: ${error.message}`);
    res.status(500).json({ code: 500, message: '刷新餐厅失败' });
  }
});

// 刷新酒店 - 换一批（轻量级，不调用AI）
router.post('/refresh/hotels', async (req, res) => {
  try {
    const { currentHotels, sessionId, hotelArea } = req.body;
    // currentHotels 现在是所有天已存在的酒店名称数组
    const currentNames = Array.isArray(currentHotels) ? currentHotels : [];
    const area = hotelArea || '五一广场';
    
    logger.info(`换一批酒店请求: 排除 ${currentNames.length} 个已存在酒店, 区域: ${area}`);
    
    const newHotels = await refreshService.refreshHotels(currentNames, area, 3);
    
    res.json({
      code: 200,
      data: {
        hotels: newHotels,
        message: `为您推荐了${newHotels.length}家新酒店`
      }
    });
  } catch (error) {
    logger.error(`刷新酒店失败: ${error.message}`);
    res.status(500).json({ code: 500, message: '刷新酒店失败' });
  }
});

// 获取路线规划
router.post('/route', async (req, res) => {
  try {
    const { origin, destination, mode = 'walking' } = req.body;
    
    if (!origin || !destination) {
      return res.status(400).json({ code: 400, message: '缺少起点或终点' });
    }

    let route = null;
    
    switch (mode) {
      case 'walking':
        route = await amapService.getWalkingRoute(origin, destination);
        break;
      case 'transit':
        route = await amapService.getTransitRoute(origin, destination);
        break;
      case 'driving':
        route = await amapService.getDrivingRoute(origin, destination);
        break;
      default:
        route = await amapService.getWalkingRoute(origin, destination);
    }

    if (route) {
      res.json({ code: 200, data: route });
    } else {
      res.status(500).json({ code: 500, message: '路线规划失败' });
    }
  } catch (error) {
    logger.error(`路线规划失败: ${error.message}`);
    res.status(500).json({ code: 500, message: '路线规划失败' });
  }
});

// 获取地图配置
router.get('/config/amap', (req, res) => {
  try {
    const amapJsKey = process.env.AMAP_JS_KEY;
    const amapWebKey = process.env.AMAP_WEB_KEY;
    
    if (!amapJsKey) {
      return res.status(500).json({ code: 500, message: '地图服务未配置' });
    }
    
    res.json({
      code: 200,
      data: {
        key: amapJsKey,
        securityKey: amapWebKey
      }
    });
  } catch (error) {
    logger.error(`获取配置失败: ${error.message}`);
    res.status(500).json({ code: 500, message: '获取配置失败' });
  }
});

// 获取天气
router.get('/weather', async (req, res) => {
  try {
    const weather = await amapService.getWeather();
    if (weather) {
      res.json({ code: 200, data: weather });
    } else {
      res.status(500).json({ code: 500, message: '获取天气失败' });
    }
  } catch (error) {
    logger.error(`获取天气失败: ${error.message}`);
    res.status(500).json({ code: 500, message: '获取天气失败' });
  }
});

// 行程相关接口
router.post('/trips', async (req, res) => {
  try {
    let body = req.body;
    if (req.body.data && typeof req.body.data === 'string') {
      body = JSON.parse(req.body.data);
    }
    const { tripId, params, itinerary, conversationHistory, routes } = body;
    const sessionId = req.headers['x-session-id'];
    
    let userId = null;
    if (sessionId) {
      const user = await userService.getUserBySession(sessionId);
      if (user) {
        userId = user.userId;
      }
    }
    
    // 如果有 tripId，则更新已有行程；否则创建新行程
    if (tripId) {
      const result = await tripService.updateTrip(tripId, {
        requirements: params,
        itinerary,
        conversationHistory: conversationHistory || [],
        routes: routes || []
      });
      res.json({ code: 200, data: { tripId, updated: true } });
    } else {
      const result = await tripService.createTrip(
        userId, 
        params, 
        itinerary, 
        conversationHistory || [], 
        routes || []
      );
      res.json({ code: 200, data: result });
    }
  } catch (error) {
    logger.error(`保存行程失败: ${error.message}`);
    res.status(500).json({ code: 500, message: '保存行程失败' });
  }
});

router.get('/trips', async (req, res) => {
  try {
    let userId = null;
    const sessionId = req.headers['x-session-id'];
    if (sessionId) {
      const user = await userService.getUserBySession(sessionId);
      if (user) {
        userId = user.userId;
      }
    }
    
    const trips = await tripService.getUserTrips(userId, req.query);
    res.json({ code: 200, data: trips });
  } catch (error) {
    logger.error(`获取行程列表失败: ${error.message}`);
    res.status(500).json({ code: 500, message: '获取行程列表失败' });
  }
});

router.get('/trips/:id', async (req, res) => {
  try {
    const trip = await tripService.getTripById(req.params.id);
    res.json({ code: 200, data: trip });
  } catch (error) {
    logger.error(`获取行程失败: ${error.message}`);
    res.status(404).json({ code: 404, message: '行程不存在' });
  }
});

router.put('/trips/:id', async (req, res) => {
  try {
    const result = await tripService.updateTrip(req.params.id, req.body);
    res.json({ code: 200, data: result });
  } catch (error) {
    logger.error(`更新行程失败: ${error.message}`);
    res.status(500).json({ code: 500, message: '更新行程失败' });
  }
});

router.delete('/trips/:id', async (req, res) => {
  try {
    await tripService.deleteTrip(req.params.id);
    res.json({ code: 200, message: '删除成功' });
  } catch (error) {
    logger.error(`删除失败: ${error.message}`);
    res.status(500).json({ code: 500, message: '删除失败' });
  }
});

router.post('/trips/:id/favorite', async (req, res) => {
  try {
    const { isFavorite } = req.body;
    const result = await tripService.updateTrip(req.params.id, { isFavorite });
    res.json({ code: 200, data: result, message: isFavorite ? '已收藏' : '已取消收藏' });
  } catch (error) {
    logger.error(`收藏操作失败: ${error.message}`);
    res.status(500).json({ code: 500, message: '收藏操作失败' });
  }
});

// 获取增强规划信息
router.get('/plan/enhanced/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = sessions.get(sessionId);
    
    if (!session) {
      return res.status(404).json({ code: 404, message: '会话不存在' });
    }

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

// 获取交通推荐
router.post('/transport/recommend', async (req, res) => {
  try {
    const { from, to, preferences } = req.body;
    
    if (!from || !to) {
      return res.status(400).json({ code: 400, message: '缺少起点或终点' });
    }

    const recommendations = smartPlanningService.recommendTransportation(from, to, preferences);
    
    res.json({
      code: 200,
      data: {
        recommendations,
        bestOption: recommendations[0]
      }
    });
  } catch (error) {
    logger.error(`获取交通推荐失败: ${error.message}`);
    res.status(500).json({ code: 500, message: '获取交通推荐失败' });
  }
});

// 优化路线
router.post('/route/optimize', async (req, res) => {
  try {
    const { attractions, startPoint } = req.body;
    
    if (!attractions || attractions.length < 2) {
      return res.status(400).json({ code: 400, message: '至少需要2个景点' });
    }

    const optimization = smartPlanningService.optimizeRoute(attractions, startPoint);
    
    res.json({
      code: 200,
      data: optimization
    });
  } catch (error) {
    logger.error(`路线优化失败: ${error.message}`);
    res.status(500).json({ code: 500, message: '路线优化失败' });
  }
});

// 预算优化建议
router.post('/budget/optimize', async (req, res) => {
  try {
    const { itinerary, targetBudget } = req.body;
    
    if (!itinerary || !targetBudget) {
      return res.status(400).json({ code: 400, message: '缺少行程或预算数据' });
    }

    const optimization = smartPlanningService.optimizeBudget(itinerary, targetBudget);
    
    res.json({
      code: 200,
      data: optimization
    });
  } catch (error) {
    logger.error(`预算优化失败: ${error.message}`);
    res.status(500).json({ code: 500, message: '预算优化失败' });
  }
});

// 导出行程
router.post('/export', async (req, res) => {
  try {
    const { requirements, itinerary, format = 'json' } = req.body;
    
    if (!itinerary || itinerary.length === 0) {
      return res.status(400).json({ code: 400, message: '没有可导出的行程' });
    }

    const tripData = { requirements, itinerary };
    const exportData = exportService.getExportData(tripData, format);
    
    res.setHeader('Content-Type', exportData.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="trip-plan.${exportData.extension}"`);
    res.send(exportData.content);
  } catch (error) {
    logger.error(`导出行程失败: ${error.message}`);
    res.status(500).json({ code: 500, message: '导出行程失败' });
  }
});

// 获取导出预览
router.post('/export/preview', async (req, res) => {
  try {
    const { requirements, itinerary, format = 'json' } = req.body;
    
    if (!itinerary || itinerary.length === 0) {
      return res.status(400).json({ code: 400, message: '没有可预览的行程' });
    }

    const tripData = { requirements, itinerary };
    const exportData = exportService.getExportData(tripData, format);
    
    res.json({
      code: 200,
      data: {
        content: exportData.content,
        mimeType: exportData.mimeType,
        extension: exportData.extension
      }
    });
  } catch (error) {
    logger.error(`预览导出失败: ${error.message}`);
    res.status(500).json({ code: 500, message: '预览导出失败' });
  }
});

// 生成分享链接
router.post('/trips/:id/share', async (req, res) => {
  try {
    const shareInfo = await tripService.generateShareLink(req.params.id);
    res.json({
      code: 200,
      data: {
        shareId: shareInfo.shareId,
        shareUrl: `${req.protocol}://${req.get('host')}/trip/shared/${shareInfo.shareId}`,
        expiresAt: shareInfo.expiresAt
      }
    });
  } catch (error) {
    logger.error(`生成分享链接失败: ${error.message}`);
    res.status(500).json({ code: 500, message: '生成分享链接失败' });
  }
});

// 获取分享的行程
router.get('/trips/shared/:shareId', async (req, res) => {
  try {
    const shared = await tripService.getSharedTrip(req.params.shareId);
    res.json({
      code: 200,
      data: shared
    });
  } catch (error) {
    logger.error(`获取分享行程失败: ${error.message}`);
    res.status(404).json({ code: 404, message: error.message });
  }
});

// 收藏相关接口
router.post('/favorites/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const { item } = req.body;
    const sessionId = req.headers['x-session-id'];
    
    if (!sessionId) {
      return res.status(401).json({ code: 401, message: '请先登录' });
    }
    
    const user = await userService.getUserBySession(sessionId);
    if (!user) {
      return res.status(401).json({ code: 401, message: '会话已过期' });
    }
    
    if (!['attraction', 'restaurant', 'hotel'].includes(type)) {
      return res.status(400).json({ code: 400, message: '无效的收藏类型' });
    }
    
    const result = await favoriteService.addFavorite(user.userId, type, item);
    res.json({ code: 200, ...result });
  } catch (error) {
    logger.error(`添加收藏失败: ${error.message}`);
    res.status(500).json({ code: 500, message: '添加收藏失败' });
  }
});

router.delete('/favorites/:type/:itemId', async (req, res) => {
  try {
    const { type, itemId } = req.params;
    const sessionId = req.headers['x-session-id'];
    
    if (!sessionId) {
      return res.status(401).json({ code: 401, message: '请先登录' });
    }
    
    const user = await userService.getUserBySession(sessionId);
    if (!user) {
      return res.status(401).json({ code: 401, message: '会话已过期' });
    }
    
    const result = await favoriteService.removeFavorite(user.userId, type, itemId);
    res.json({ code: 200, ...result });
  } catch (error) {
    logger.error(`取消收藏失败: ${error.message}`);
    res.status(500).json({ code: 500, message: '取消收藏失败' });
  }
});

router.get('/favorites', async (req, res) => {
  try {
    const sessionId = req.headers['x-session-id'];
    
    if (!sessionId) {
      return res.json({ code: 200, data: { attractions: [], restaurants: [], hotels: [] } });
    }
    
    const user = await userService.getUserBySession(sessionId);
    if (!user) {
      return res.json({ code: 200, data: { attractions: [], restaurants: [], hotels: [] } });
    }
    
    const favorites = await favoriteService.getAllFavorites(user.userId);
    res.json({ code: 200, data: favorites });
  } catch (error) {
    logger.error(`获取收藏失败: ${error.message}`);
    res.status(500).json({ code: 500, message: '获取收藏失败' });
  }
});

router.get('/favorites/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const sessionId = req.headers['x-session-id'];
    
    if (!sessionId) {
      return res.json({ code: 200, data: [] });
    }
    
    const user = await userService.getUserBySession(sessionId);
    if (!user) {
      return res.json({ code: 200, data: [] });
    }
    
    const favorites = await favoriteService.getFavorites(user.userId, type);
    res.json({ code: 200, data: favorites });
  } catch (error) {
    logger.error(`获取收藏失败: ${error.message}`);
    res.status(500).json({ code: 500, message: '获取收藏失败' });
  }
});

router.post('/favorites/:type/toggle', async (req, res) => {
  try {
    const { type } = req.params;
    const { item } = req.body;
    const sessionId = req.headers['x-session-id'];
    
    if (!sessionId) {
      return res.status(401).json({ code: 401, message: '请先登录' });
    }
    
    const user = await userService.getUserBySession(sessionId);
    if (!user) {
      return res.status(401).json({ code: 401, message: '会话已过期' });
    }
    
    const result = await favoriteService.toggleFavorite(user.userId, type, item);
    res.json({ code: 200, ...result });
  } catch (error) {
    logger.error(`切换收藏失败: ${error.message}`);
    res.status(500).json({ code: 500, message: '切换收藏失败' });
  }
});

module.exports = router;
