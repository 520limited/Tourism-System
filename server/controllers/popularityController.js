const express = require('express');
const router = express.Router();
const popularityPredictionService = require('../services/trip/popularityPredictionService');
const logger = require('../services/logger');

// 热度预测
router.get('/popularity/predict', async (req, res) => {
  try {
    const { attraction, date, hour } = req.query;
    if (!attraction) return res.status(400).json({ code: 400, message: '请提供景点名称' });
    const targetDate = date || new Date().toISOString().split('T')[0];
    const targetHour = parseInt(hour) || 10;
    const prediction = await popularityPredictionService.predictCrowdLevel(attraction, targetDate, targetHour);
    res.json({ code: 200, data: { attraction, date: targetDate, hour: targetHour, ...prediction } });
  } catch (error) {
    logger.error(`热度预测失败: ${error.message}`);
    res.status(500).json({ code: 500, message: '热度预测失败' });
  }
});

// 最佳游览时间
router.get('/popularity/best-time', async (req, res) => {
  try {
    const { attraction, date } = req.query;
    if (!attraction) return res.status(400).json({ code: 400, message: '请提供景点名称' });
    const targetDate = date || new Date().toISOString().split('T')[0];
    res.json({ code: 200, data: { attraction, date: targetDate, ...(await popularityPredictionService.getBestVisitTime(attraction, targetDate)) } });
  } catch (error) {
    logger.error(`获取最佳时间失败: ${error.message}`);
    res.status(500).json({ code: 500, message: '获取最佳时间失败' });
  }
});

// 游览时长预估
router.post('/duration/estimate', (req, res) => {
  try {
    const { attraction, crowdLevel, groupType, withKids, withElderly } = req.body;
    if (!attraction) return res.status(400).json({ code: 400, message: '请提供景点名称' });
    const result = popularityPredictionService.estimateVisitDuration(attraction, { crowdLevel, groupType, withKids, withElderly });
    res.json({ code: 200, data: { attraction, ...result } });
  } catch (error) {
    logger.error(`时长预估失败: ${error.message}`);
    res.status(500).json({ code: 500, message: '时长预估失败' });
  }
});

// 批量行程热度预测
router.post('/popularity/trip-predictions', async (req, res) => {
  try {
    const { attractions, date, startTime } = req.body;
    if (!attractions || !Array.isArray(attractions)) return res.status(400).json({ code: 400, message: '请提供景点列表' });
    const targetDate = date || new Date().toISOString().split('T')[0];
    res.json({ code: 200, data: { date: targetDate, schedule: await popularityPredictionService.predictDaySchedule(attractions, targetDate, startTime || 9) } });
  } catch (error) {
    logger.error(`行程热度预测失败: ${error.message}`);
    res.status(500).json({ code: 500, message: '行程热度预测失败' });
  }
});

// 行程安排优化（避开高峰）
router.post('/schedule/optimize', async (req, res) => {
  try {
    const { attractions, date, preferences } = req.body;
    if (!attractions || !Array.isArray(attractions)) return res.status(400).json({ code: 400, message: '请提供景点列表' });
    const targetDate = date || new Date().toISOString().split('T')[0];
    res.json({ code: 200, data: { date: targetDate, optimizedSchedule: await popularityPredictionService.optimizeScheduleForCrowd(attractions, targetDate, preferences || {}) } });
  } catch (error) {
    logger.error(`行程优化失败: ${error.message}`);
    res.status(500).json({ code: 500, message: '行程优化失败' });
  }
});

// 热度概览
router.post('/popularity/overview', async (req, res) => {
  try {
    const { itinerary, date } = req.body;
    if (!itinerary || !Array.isArray(itinerary)) return res.status(400).json({ code: 400, message: '请提供行程数据' });
    const targetDate = date || new Date().toISOString().split('T')[0];

    // 并行处理每天的景点预测（替代原来的同步循环）
    const overview = await Promise.all(itinerary.map(async day => {
      const dayOverview = { day: day.day, date: day.date, attractions: [] };
      if (day.attractions?.length > 0) {
        dayOverview.attractions = await Promise.all(day.attractions.map(async (attr, i) => {
          const hour = 9 + i * 2;
          const prediction = await popularityPredictionService.predictCrowdLevel(attr.name, targetDate, hour);
          const duration = await popularityPredictionService.estimateVisitDuration(attr.name, { crowdLevel: prediction.level });
          return {
            name: attr.name, order: i + 1, suggestedTime: `${hour}:00`,
            crowdLevel: prediction.level, crowdStatus: prediction.status, crowdColor: prediction.color,
            estimatedDuration: duration.estimatedDuration, recommendation: prediction.recommendation
          };
        }));
      }
      return dayOverview;
    }));

    res.json({ code: 200, data: { date: targetDate, overview } });
  } catch (error) {
    logger.error(`获取热度概览失败: ${error.message}`);
    res.status(500).json({ code: 500, message: '获取热度概览失败' });
  }
});

module.exports = router;
