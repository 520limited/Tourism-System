/**
 * @fileoverview 用户认证控制器 - 处理用户注册、登录、登出及个人信息管理
 * 
 * @module authController
 * @description 本模块负责用户身份认证相关的全部API接口,包括邮箱验证码发送、用户注册、
 *              登录鉴权、会话管理、信息修改等功能。所有接口均通过sessionId机制维护登录状态。
 * 
 * API接口列表:
 *   POST /api/auth/send-code     发送邮箱验证码(用于注册)
 *   POST /api/auth/register      用户注册(需验证码)
 *   POST /api/auth/login         用户登录(返回sessionId)
 *   POST /api/auth/logout        用户登出(销毁会话)
 *   GET  /api/user/profile       获取当前用户信息(需登录)
 *   PUT  /api/user/profile       更新用户信息(需登录)
 *   PUT  /api/user/preferences   更新用户偏好设置(需登录)
 *   PUT  /api/user/password      修改密码(需登录+原密码校验)
 * 
 * @requires express Express.js框架路由
 * @requires ../services/user/userService 用户业务逻辑服务
 * @requires ../services/user/emailService 邮箱验证码服务
 * @requires ../services/logger 日志服务
 */
const express = require('express');
const router = express.Router();
const userService = require('../services/user/userService');
const emailService = require('../services/user/emailService');
const logger = require('../services/logger');

// 发送验证码
router.post('/auth/send-code', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ code: 400, message: '请输入邮箱' });
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
      if (!verifyResult.valid) return res.status(400).json({ code: 400, message: verifyResult.message });
    }
    const result = await userService.register({ email, password, nickname });
    res.json({ code: 200, message: '注册成功', data: result });
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
      code: 200, message: '登录成功',
      data: { sessionId: result.sessionId, user: result.user }
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
    if (sessionId) await userService.logout(sessionId);
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
    if (!sessionId) return res.status(401).json({ code: 401, message: '未登录' });
    const user = await userService.getUserBySession(sessionId);
    if (!user) return res.status(401).json({ code: 401, message: '会话已过期，请重新登录' });
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
    if (!sessionId) return res.status(401).json({ code: 401, message: '未登录' });
    const user = await userService.getUserBySession(sessionId);
    if (!user) return res.status(401).json({ code: 401, message: '会话已过期' });
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
    if (!sessionId) return res.status(401).json({ code: 401, message: '未登录' });
    const user = await userService.getUserBySession(sessionId);
    if (!user) return res.status(401).json({ code: 401, message: '会话已过期' });
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
    if (!sessionId) return res.status(401).json({ code: 401, message: '未登录' });
    const user = await userService.getUserBySession(sessionId);
    if (!user) return res.status(401).json({ code: 401, message: '会话已过期' });
    await userService.changePassword(user.userId, oldPassword, newPassword);
    res.json({ code: 200, message: '密码修改成功' });
  } catch (error) {
    logger.error(`修改密码失败: ${error.message}`);
    res.status(400).json({ code: 400, message: error.message });
  }
});

module.exports = router;
