const express = require('express');
const router = express.Router();
const preferenceLearningService = require('../services/user/preferenceLearningService');
const userService = require('../services/user/userService');
const tripService = require('../services/trip/tripService');
const logger = require('../services/logger');

// 从 session 获取用户，支持游客模式返回 null
async function getUser(req) {
  const sessionId = req.headers['x-session-id'];
  if (!sessionId) return null;
  return await userService.getUserBySession(sessionId);
}

// 记录用户行为
router.post('/behavior/record', async (req, res) => {
  try {
    const user = await getUser(req);
    if (!user) return res.json({ code: 200, message: '游客模式，不记录行为' });

    const result = await preferenceLearningService.recordBehavior(user.userId, {
      type: req.body.type,
      itemType: req.body.itemType,
      itemData: req.body.itemData,
      context: req.body.context
    });
    res.json({ code: 200, data: result });
  } catch (error) {
    logger.error(`记录行为失败: ${error.message}`);
    res.status(500).json({ code: 500, message: '记录行为失败' });
  }
});

// 获取用户偏好画像
router.get('/user/preferences/profile', async (req, res) => {
  try {
    const user = await getUser(req);
    if (!user) return res.json({ code: 200, data: null, message: '未登录' });

    const profile = await preferenceLearningService.getUserProfile(user.userId);
    if (profile) {
      const preferences = JSON.parse(profile.preferences || '{}');
      res.json({
        code: 200,
        data: {
          preferences,
          topPreferences: preferenceLearningService.getTopPreferences(preferences, 'all', 5),
          confidence: preferenceLearningService.calculateConfidence(preferences),
          totalBehaviors: preferences.totalBehaviors || 0
        }
      });
    } else {
      res.json({ code: 200, data: null, message: '暂无偏好数据' });
    }
  } catch (error) {
    logger.error(`获取偏好画像失败: ${error.message}`);
    res.status(500).json({ code: 500, message: '获取偏好画像失败' });
  }
});

// 获取个性化推荐
router.get('/recommendations/:type', async (req, res) => {
  try {
    const user = await getUser(req);
    if (!user) return res.json({ code: 200, data: { recommendations: [], reason: '游客模式' } });

    const result = await preferenceLearningService.getPersonalizedRecommendations(user.userId, req.params.type);
    res.json({ code: 200, data: result });
  } catch (error) {
    logger.error(`获取个性化推荐失败: ${error.message}`);
    res.status(500).json({ code: 500, message: '获取个性化推荐失败' });
  }
});

// 记录行程反馈
router.post('/trips/:id/feedback', async (req, res) => {
  try {
    const sessionId = req.headers['x-session-id'];
    if (!sessionId) return res.status(401).json({ code: 401, message: '请先登录' });

    const user = await userService.getUserBySession(sessionId);
    if (!user) return res.status(401).json({ code: 401, message: '会话已过期' });

    const result = await preferenceLearningService.recordTripFeedback(user.userId, req.params.id, {
      rating: req.body.rating,
      comments: req.body.comments,
      likedItems: req.body.likedItems,
      dislikedItems: req.body.dislikedItems
    });
    res.json({ code: 200, data: result, message: '感谢您的反馈！' });
  } catch (error) {
    logger.error(`记录反馈失败: ${error.message}`);
    res.status(500).json({ code: 500, message: '记录反馈失败' });
  }
});

module.exports = router;
