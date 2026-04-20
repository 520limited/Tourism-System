const rateLimit = require('express-rate-limit');
const logger = require('../services/logger');

// 每秒至少5次并发 → 设为 600/min（=10/s），满足要求且有冗余
const limiter = rateLimit({
  windowMs: 60000,
  max: 600,
  message: {
    code: 'RATE_LIMIT_EXCEEDED',
    message: '请求过于频繁，请稍后再试'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const requestLogger = (req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    // 使用 logger 替代 console.log，统一日志管理
    const logMsg = `${req.method} ${req.url} ${res.statusCode} - ${duration}ms`;
    if (res.statusCode >= 400) {
      logger.warn(logMsg);
    } else {
      logger.info(logMsg);
    }
  });

  next();
};

const errorHandler = (err, req, res, next) => {
  logger.error(`Error: ${err.message || err}`);

  const statusCode = err.statusCode || 500;
  const message = err.message || '服务器内部错误';

  res.status(statusCode).json({
    code: statusCode,
    message: statusCode === 500 ? '服务器内部错误' : message
  });
};

module.exports = {
  limiter,
  requestLogger,
  errorHandler
};
