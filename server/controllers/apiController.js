/**
 * API 路由聚合器 - 将各领域子控制器合并到统一 /api 前缀下
 * 
 * 拆分前: 单一 1435 行巨石文件
 * 拆分后: 6 个按职责划分的子控制器 + 本聚合文件
 */
const express = require('express');
const router = express.Router();

const authController = require('./authController');
const { router: planningRouter } = require('./planningController');
const tripController = require('./tripController');
const favoriteController = require('./favoriteController');
const preferenceController = require('./preferenceController');
const popularityController = require('./popularityController');

router.use(authController);          // 认证 + 用户管理
router.use(planningRouter);           // 行程规划 + AI 对话 + 刷新 + 增强规划
router.use(tripController);           // 行程 CRUD + 路线 + 地图 + 导出 + 分享
router.use(favoriteController);       // 收藏管理
router.use(preferenceController);     // 偏好学习 + 推荐反馈
router.use(popularityController);     // 热度预测 + 时间预估

module.exports = router;
