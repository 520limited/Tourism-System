const express = require('express');
const router = express.Router();
const favoriteService = require('../services/user/favoriteService');
const preferenceLearningService = require('../services/user/preferenceLearningService');
const userService = require('../services/user/userService');
const logger = require('../services/logger');

// 鉴权中间件：从 session 获取用户，未登录返回 401 或空数据
async function authenticate(req, res, options = {}) {
  const sessionId = req.headers['x-session-id'];
  if (!sessionId) {
    if (options.allowGuest) return null;
    return res.status(401).json({ code: 401, message: '请先登录' });
  }
  const user = await userService.getUserBySession(sessionId);
  if (!user) {
    if (options.allowGuest) return null;
    return res.status(401).json({ code: 401, message: '会话已过期' });
  }
  return user;
}

// 添加收藏
router.post('/favorites/:type', async (req, res) => {
  try {
    const user = await authenticate(req, res);
    if (!user || res.headersSent) return;
    const { type } = req.params;
    if (!['attraction', 'restaurant', 'hotel'].includes(type)) {
      return res.status(400).json({ code: 400, message: '无效的收藏类型' });
    }
    const result = await favoriteService.addFavorite(user.userId, type, req.body.item);
    res.json({ code: 200, ...result });
  } catch (error) {
    logger.error(`添加收藏失败: ${error.message}`);
    res.status(500).json({ code: 500, message: '添加收藏失败' });
  }
});

// 删除收藏
router.delete('/favorites/:type/:itemId', async (req, res) => {
  try {
    const user = await authenticate(req, res);
    if (!user || res.headersSent) return;
    const result = await favoriteService.removeFavorite(user.userId, req.params.type, req.params.itemId);
    res.json({ code: 200, ...result });
  } catch (error) {
    logger.error(`取消收藏失败: ${error.message}`);
    res.status(500).json({ code: 500, message: '取消收藏失败' });
  }
});

// 获取所有收藏
router.get('/favorites', async (req, res) => {
  try {
    const user = await authenticate(req, res, { allowGuest: true });
    if (!user) return res.json({ code: 200, data: { attractions: [], restaurants: [], hotels: [] } });
    res.json({ code: 200, data: await favoriteService.getAllFavorites(user.userId) });
  } catch (error) {
    logger.error(`获取收藏失败: ${error.message}`);
    res.status(500).json({ code: 500, message: '获取收藏失败' });
  }
});

// 按类型获取收藏
router.get('/favorites/:type', async (req, res) => {
  try {
    const user = await authenticate(req, res, { allowGuest: true });
    if (!user) return res.json({ code: 200, data: [] });
    res.json({ code: 200, data: await favoriteService.getFavorites(user.userId, req.params.type) });
  } catch (error) {
    logger.error(`获取收藏失败: ${error.message}`);
    res.status(500).json({ code: 500, message: '获取收藏失败' });
  }
});

// 切换收藏状态
router.post('/favorites/:type/toggle', async (req, res) => {
  try {
    const user = await authenticate(req, res);
    if (!user || res.headersSent) return;

    const result = await favoriteService.toggleFavorite(user.userId, req.params.type, req.body.item);
    if (result.success) {
      await preferenceLearningService.recordBehavior(user.userId, {
        type: 'favorite', itemType: req.params.type, itemData: req.body.item
      });
    }
    res.json({ code: 200, ...result });
  } catch (error) {
    logger.error(`切换收藏失败: ${error.message}`);
    res.status(500).json({ code: 500, message: '切换收藏失败' });
  }
});

module.exports = router;
