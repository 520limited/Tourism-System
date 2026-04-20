/**
 * @fileoverview 行程规划控制器 - AI规划与多轮对话的核心入口
 * 
 * @module planningController
 * @description 本模块是整个行程规划系统的核心控制器,负责协调AI生成、数据处理、费用计算、路线优化等全流程。
 * 
 * 主要职责:
 *   1. 接收用户自然语言输入(旅行需求)
 *   2. 调用AI服务(qwenAIService)生成结构化行程
 *   3. 协调外部服务验证数据(高德地图POI/天气/酒店)
 *   4. 计算费用并生成报告
 *   5. 执行TSP路线优化和交通推荐
 *   6. 持久化行程到数据库
 *   7. 管理多轮会话状态(SessionManager)
 *
 * 两条主链路:
 *   POST /plan    → 首次生成完整行程 (AI → 验证 → 费用 → 优化 → 持久化)
 *   POST /chat    → 多轮对话调整行程 (上下文感知的AI交互)
 */
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

const SESSION_TTL_MS = 2 * 60 * 60 * 1000; // 2小时TTL，防止内存泄漏
const CLEANUP_INTERVAL = 30 * 60 * 1000; // 每30分钟清理一次

class SessionManager {
  /**
   * 会话管理器 — 管理AI多轮对话的内存状态(带TTL过期清理)
   * 
   * 设计目标:
   *   - 存储每次对话的完整历史(history)、需求(requirements)、行程(itinerary)
   *   - 支持跨请求的状态持久化(AI需要完整上下文才能连贯对话)
   *   - 自动清理防止内存泄漏(2小时TTL + 30分钟定时扫描)
   */
  constructor() {
    this.sessions = new Map();
    // 定期清理过期会话
    this._cleanupTimer = setInterval(() => this._cleanup(), CLEANUP_INTERVAL);
    // 不让定时器阻止进程退出
    this._cleanupTimer.unref?.();
  }

  get(id) {
    const entry = this.sessions.get(id);
    if (entry && (Date.now() - entry.lastAccess > SESSION_TTL_MS)) {
      this.sessions.delete(id);
      return undefined;
    }
    if (entry) entry.lastAccess = Date.now();
    return entry ? entry.data : undefined;
  }

  set(id, data) {
    this.sessions.set(id, { data, lastAccess: Date.now() });
  }

  _cleanup() {
    const now = Date.now();
    let cleaned = 0;
    for (const [id, entry] of this.sessions) {
      if (now - entry.lastAccess > SESSION_TTL_MS) {
        this.sessions.delete(id);
        cleaned++;
      }
    }
    if (cleaned > 0) logger.info(`Session清理: 移除${cleaned}个过期会话`);
  }
}

const sessionManager = new SessionManager();

// 公开会话引用（供其他模块如 popularityController 访问 enhanced 数据）
const getSession = (id) => sessionManager.get(id);

/**
 *
 * 执行顺序: 酒店搜索 → 坐标验证(并行) → 天气获取(并行)
 *         → 费用计算 → TSP优化+交通推荐(并行) → DB持久化
 */
/**
 * processAndSaveItinerary — 行程处理与持久化的核心流水线
 * 
 * 这是整个系统最关键的函数,串联了从AI原始输出到最终存储的完整数据加工链路。
 * 执行顺序(严格有序):
 *   Step1: [并行] 酒店搜索 + 坐标验证 + 天气获取 (Promise.all)
 *   Step2: 合并酒店数据到每天行程
 *   Step3: 合并天气数据到每天行程
 *   Step4: 费用计算 (六大类费用 + 应急备用金)
 *   Step5: 智能规划增强 (TSP路线优化 + 交通方式推荐)
 *   Step6: 合并交通路线数据到每天
 *   Step7: 数据库持久化 (新增或更新,含对话历史和路由信息)
 * 
 * @param {Object} aiResult - AI服务返回的结构化行程结果
 * @param {Object} session - 当前会话状态对象
 * @param {string} sessionId - 会话唯一标识
 * @param {string|null} existingTripId - 已有行程ID(编辑模式时非空)
 * @param {string|null} userId - 当前用户ID(未登录时为null)
 * @returns {Promise<{verifiedItinerary, costReport, enhancedPlanning, tripId}>}
 */
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

  // 保存到数据库（包含完整的对话历史和路由）
  let tripId = existingTripId;
  if (existingTripId) {
    await tripService.updateTrip(existingTripId, {
      requirements: aiResult.requirements,
      itinerary: verifiedItinerary,
      activities: aiResult.activities || [],
      conversationHistory: session.history,       // ← 保存对话历史！
      routes: enhancedPlanning?.transports || [],   // ← 保存路线规划
      crowdPredictions: [],
      timeEstimates: []
    });
    await tripService.saveTripRoutes(existingTripId, verifiedItinerary);
  } else {
    const tripResult = await tripService.createTrip(
      userId, aiResult.requirements, verifiedItinerary,
      session.history,                              // ← 对话历史（不再为空！）
      enhancedPlanning?.transports || [],           // ← 路线数据
      aiResult.activities || [], null, [], []
    );
    tripId = tripResult.tripId;
    await tripService.saveTripRoutes(tripId, verifiedItinerary);
  }

  return { verifiedItinerary, costReport, enhancedPlanning, tripId };
}

/**
 * loadExistingTrip — 从数据库加载已有行程到会话状态
 * 
 * 当用户在已有行程基础上进行修改时(传入existingTripId),
 * 需要先恢复之前的对话历史、行程数据和需求信息,
 * 让AI能够基于上下文进行增量调整而非重新生成。
 * 
 * @param {Object} session - 当前会话对象(将被填充历史数据)
 * @param {string|null} existingTripId - 已有行程ID
 */
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

/**
 * POST /api/plan — 首次行程生成接口(核心入口)
 * 
 * 完整处理流程:
 *   1. 提取用户消息和会话ID(无则生成新UUID)
 *   2. 获取/创建Session对象
 *   3. 加载已有行程(编辑模式)
 *   4. 用户消息加入对话历史
 *   5. 通过sessionId获取userId(加载用户偏好画像)
 *   6. 调用AI生成结构化行程(注入偏好+天气+日期上下文)
 *   7. AI回复也加入历史(保证对话完整)
 *   8. processAndSaveItinerary: 验证→费用→优化→持久化
 *   9. 更新Session并返回完整结果
 * 
 * @requestBody { message: string, tripId?: string }
 * @header x-session-id 会话标识(可选,首次自动生成)
 * @response { code:200, data:{ message, sessionId, tripId, requirements, itinerary, costData, enhancedPlanning } }
 */

// 生成行程 (POST /plan)
router.post('/plan', async (req, res) => {
  try {
    const { message, tripId: existingTripId } = req.body;
    const sessionId = req.headers['x-session-id'] || uuidv4();

    if (!message?.trim()) return res.status(400).json({ code: 400, message: '请输入您的旅行需求' });

    let session = sessionManager.get(sessionId) || { history: [], requirements: {}, itinerary: [], status: 'planning' };
    await loadExistingTrip(session, existingTripId);
    session.history.push({ role: 'user', content: message });

    // 获取用户ID（必须在AI调用之前，用于加载用户偏好画像）
    let userId = null;
    const user = await userService.getUserBySession(sessionId);
    if (user) userId = user.userId;

    // AI 生成行程（传入userId以加载用户偏好）
    const aiResult = await qwenAIService.generateTripFromNaturalLanguage(message, session.history, null, userId);
    if (!aiResult.ready || aiResult.error) {
      return res.status(500).json({ code: 500, message: '行程生成失败，请重试' });
    }

    // 处理并保存行程
    // 先把AI回复加入session.history（确保完整对话被保存到DB）
    session.history.push({ role: 'assistant', content: aiResult.message });
    
    const { verifiedItinerary, costReport, enhancedPlanning, tripId } = await processAndSaveItinerary(
      aiResult, session, sessionId, existingTripId, userId
    );

    // 更新 session
    session.requirements = aiResult.requirements;
    session.itinerary = verifiedItinerary;
    session.enhancedPlanning = enhancedPlanning;
    session.status = 'completed';
    sessionManager.set(sessionId, session);

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

/**
 * POST /api/chat — 多轮对话接口(行程调整/问答)
 * 
 * 与 /plan 接口的区别:
 *   - /plan:  首次生成,返回完整结构化行程
 *   - /chat: 后续对话,支持自然语言调整(换景点/改酒店等)
 * 
 * 特殊处理:
 *   - 先获取天气数据作为AI上下文(规划时已传入,聊天时需重新获取)
 *   - AI可能只返回文本调整建议(ready=false),不一定每次都重生成行程
 *   - 若AI返回了完整行程则复用processAndSaveItinerary处理
 * 
 * @requestBody { message: string, tripId?: string }
 */
router.post('/chat', async (req, res) => {
  try {
    const { message, tripId: existingTripId } = req.body;
    const sessionId = req.headers['x-session-id'] || uuidv4();

    if (!message?.trim()) return res.status(400).json({ code: 400, message: '消息不能为空' });

    let session = sessionManager.get(sessionId) || { history: [], requirements: {}, itinerary: [], status: 'chatting' };
    await loadExistingTrip(session, existingTripId);
    session.history.push({ role: 'user', content: message });

    // 获取用户ID
    let userId = null;
    const user = await userService.getUserBySession(sessionId);
    if (user) userId = user.userId;

    // 获取天气后调用 AI（天气作为上下文传入，同时传userId加载用户偏好）
    const weatherData = await amapService.getWeather();
    const aiResult = await qwenAIService.generateTripFromNaturalLanguage(message, session.history, weatherData, userId);

    if (!aiResult.ready || aiResult.error) {
      session.history.push({ role: 'assistant', content: aiResult.message });
      sessionManager.set(sessionId, session);
      return res.json({
        code: 200,
        data: { message: aiResult.message, sessionId, requirements: aiResult.requirements || {}, itinerary: [], ready: false }
      });
    }

    // AI 回复加入历史
    session.history.push({ role: 'assistant', content: aiResult.message });

    // 复用 processAndSaveItinerary 统一处理（消除重复代码）
    const { verifiedItinerary, costReport, enhancedPlanning, tripId } = await processAndSaveItinerary(
      aiResult, session, sessionId, existingTripId, userId
    );

    // 合并天气数据到每天（chat接口特有的：AI生成时已传入weather，这里再确保覆盖）
    if (weatherData?.forecast) {
      verifiedItinerary.forEach((day, index) => {
        if (weatherData.forecast[index]) day.weather = weatherData.forecast[index];
      });
    }

    // 更新 session
    session.requirements = aiResult.requirements;
    session.itinerary = verifiedItinerary;
    session.enhancedPlanning = enhancedPlanning;
    sessionManager.set(sessionId, session);

    res.json({
      code: 200,
      data: { message: aiResult.message, sessionId, tripId, requirements: aiResult.requirements, activities: aiResult.activities || [], itinerary: verifiedItinerary, costData: costReport, enhancedPlanning, ready: true }
    });
  } catch (error) {
    logger.error(`Chat error: ${error.message}`);
    res.status(500).json({ code: 500, message: error.message || '服务处理失败' });
  }
});

// ==================== 刷新接口（换一批）====================
// 以下三个接口实现"不满意?换一批"功能,调用AI生成全新推荐并排除已有项

/**
 * POST /api/refresh/attractions — 刷新景点推荐
 * @requestBody { currentAttractions: string[], locationContext?: string }
 */

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

/**
 * POST /api/refresh/restaurants — 刷新餐厅推荐
 * @requestBody { currentRestaurants: string[], locationContext?: string, cuisine?: string }
 * 特殊逻辑: 指定菜系返回3家, all模式返回10家(多类别覆盖)
 */
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

/**
 * POST /api/refresh/hotels — 刷新酒店推荐
 * @requestBody { currentHotels: string[], hotelArea?: string, locationContext?: string, starRating?: string }
 * 特殊逻辑: 指定星级返回3家, all模式返回10家
 */
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
    const session = sessionManager.get(req.params.sessionId);
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
