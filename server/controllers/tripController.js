const express = require('express');
const router = express.Router();
const amapService = require('../services/external/amapService');
const smartPlanningService = require('../services/trip/smartPlanningService');
const tripService = require('../services/trip/tripService');
const exportService = require('../services/trip/exportService');
const userService = require('../services/user/userService');
const logger = require('../services/logger');

// ==================== 路线与地图接口 ====================

router.post('/route', async (req, res) => {
  try {
    const { origin, destination, mode = 'walking' } = req.body;
    if (!origin || !destination) return res.status(400).json({ code: 400, message: '缺少起点或终点' });

    const routeHandlers = {
      walking: () => amapService.getWalkingRoute(origin, destination),
      transit: () => amapService.getTransitRoute(origin, destination),
      driving: () => amapService.getDrivingRoute(origin, destination),
    };

    const route = await (routeHandlers[mode] || routeHandlers.walking)();
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

router.get('/config/amap', (req, res) => {
  try {
    const amapJsKey = process.env.AMAP_JS_KEY;
    if (!amapJsKey) return res.status(500).json({ code: 500, message: '地图服务未配置' });
    res.json({ code: 200, data: { key: amapJsKey, securityKey: process.env.AMAP_WEB_KEY } });
  } catch (error) {
    logger.error(`获取配置失败: ${error.message}`);
    res.status(500).json({ code: 500, message: '获取配置失败' });
  }
});

router.get('/weather', async (req, res) => {
  try {
    const weather = await amapService.getWeather();
    res.json(weather ? { code: 200, data: weather } : { code: 500, message: '获取天气失败' });
  } catch (error) {
    logger.error(`获取天气失败: ${error.message}`);
    res.status(500).json({ code: 500, message: '获取天气失败' });
  }
});

// ==================== 交通推荐与优化 ====================

router.post('/transport/recommend', async (req, res) => {
  try {
    const { from, to, preferences } = req.body;
    if (!from || !to) return res.status(400).json({ code: 400, message: '缺少起点或终点' });
    const recommendations = smartPlanningService.recommendTransportation(from, to, preferences);
    res.json({ code: 200, data: { recommendations, bestOption: recommendations[0] } });
  } catch (error) {
    logger.error(`获取交通推荐失败: ${error.message}`);
    res.status(500).json({ code: 500, message: '获取交通推荐失败' });
  }
});

router.post('/route/optimize', async (req, res) => {
  try {
    const { attractions, startPoint } = req.body;
    if (!attractions || attractions.length < 2) return res.status(400).json({ code: 400, message: '至少需要2个景点' });
    res.json({ code: 200, data: smartPlanningService.optimizeRoute(attractions, startPoint) });
  } catch (error) {
    logger.error(`路线优化失败: ${error.message}`);
    res.status(500).json({ code: 500, message: '路线优化失败' });
  }
});

router.post('/budget/optimize', async (req, res) => {
  try {
    const { itinerary, targetBudget } = req.body;
    if (!itinerary || !targetBudget) return res.status(400).json({ code: 400, message: '缺少行程或预算数据' });
    res.json({ code: 200, data: smartPlanningService.optimizeBudget(itinerary, targetBudget) });
  } catch (error) {
    logger.error(`预算优化失败: ${error.message}`);
    res.status(500).json({ code: 500, message: '预算优化失败' });
  }
});

// ==================== 行程 CRUD 接口 ====================

router.post('/trips', async (req, res) => {
  try {
    let body = req.body;
    if (req.body.data && typeof req.body.data === 'string') body = JSON.parse(req.body.data);
    const { tripId, params, itinerary, conversationHistory, routes } = body;
    const sessionId = req.headers['x-session-id'];

    let userId = null;
    if (sessionId) {
      const user = await userService.getUserBySession(sessionId);
      if (user) userId = user.userId;
    }

    if (tripId) {
      await tripService.updateTrip(tripId, { requirements: params, itinerary, conversationHistory: conversationHistory || [], routes: routes || [] });
      res.json({ code: 200, data: { tripId, updated: true } });
    } else {
      const result = await tripService.createTrip(userId, params, itinerary, conversationHistory || [], routes || []);
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
      if (user) userId = user.userId;
    }
    const trips = await tripService.getUserTrips(userId, req.query, userId ? null : sessionId);
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
    res.json({ code: 200, data: await tripService.updateTrip(req.params.id, req.body) });
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

// 分享
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

router.get('/trips/shared/:shareId', async (req, res) => {
  try {
    res.json({ code: 200, data: await tripService.getSharedTrip(req.params.shareId) });
  } catch (error) {
    logger.error(`获取分享行程失败: ${error.message}`);
    res.status(404).json({ code: 404, message: error.message });
  }
});

// 导出
router.post('/export', async (req, res) => {
  try {
    const { requirements, itinerary, format = 'json' } = req.body;
    if (!itinerary?.length) return res.status(400).json({ code: 400, message: '没有可导出的行程' });
    const exportData = exportService.getExportData({ requirements, itinerary }, format);
    res.setHeader('Content-Type', exportData.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="trip-plan.${exportData.extension}"`);
    res.send(exportData.content);
  } catch (error) {
    logger.error(`导出行程失败: ${error.message}`);
    res.status(500).json({ code: 500, message: '导出行程失败' });
  }
});

router.post('/export/preview', async (req, res) => {
  try {
    const { requirements, itinerary, format = 'json' } = req.body;
    if (!itinerary?.length) return res.status(400).json({ code: 400, message: '没有可预览的行程' });
    const exportData = exportService.getExportData({ requirements, itinerary }, format);
    res.json({ code: 200, data: { content: exportData.content, mimeType: exportData.mimeType, extension: exportData.extension } });
  } catch (error) {
    logger.error(`预览导出失败: ${error.message}`);
    res.status(500).json({ code: 500, message: '预览导出失败' });
  }
});

// 统计数据
router.get('/user/stats', async (req, res) => {
  try {
    let userId = null;
    const sessionId = req.headers['x-session-id'];
    if (sessionId) {
      const user = await userService.getUserBySession(sessionId);
      if (user) userId = user.userId;
    }
    res.json({ code: 200, data: await tripService.getTripStats(userId, userId ? null : sessionId) });
  } catch (error) {
    logger.error(`获取统计数据失败: ${error.message}`);
    res.status(500).json({ code: 500, message: '获取统计数据失败' });
  }
});

module.exports = router;
