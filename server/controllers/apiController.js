/**
 * @fileoverview API路由聚合器 - 将各领域子控制器合并到统一 /api 前缀下
 * 
 * @module apiController
 * @description 本模块作为服务端API入口的路由聚合层,负责将各业务域的子控制器统一挂载到 /api 前缀下,
 *              实现模块化的路由管理。
 * 
 * 路由挂载结构:
 *   /api/auth/*          → authController      认证 + 用户管理(注册/登录/登出/个人信息)
 *   /api/planning/*      → planningRouter       行程规划 + AI 对话 + 刷新 + 增强规划
 *   /api/trip/*          → tripController       行程 CRUD + 路线 + 地图 + 导出 + 分享
 *   /api/favorite/*      → favoriteController   收藏管理
 *   /api/preference/*    → preferenceController 偏好学习 + 推荐反馈
 *   /api/popularity/*    → popularityController 热度预测 + 时间预估
 * 
 * @requires express Express.js框架
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
