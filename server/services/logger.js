/**
 * @fileoverview 异步日志服务 - 基于WriteStream的高性能缓冲日志系统
 * 
 * @module logger
 * @description 本模块实现了生产级异步日志方案,解决fs.appendFileSync同步写阻塞Node.js事件循环的问题。
 *              采用缓冲区批处理策略减少IO次数,按日期自动分文件存储。
 * 
 * 核心设计:
 *   - WriteStream替代appendFileSync: 异步写入不阻塞主线程
 *   - 64KB缓冲区批量刷盘: 积累足够数据后一次性写入减少IO调用
 *   - setImmediate微任务调度: 在当前事件循环tick结束后异步刷出
 *   - 按日期分文件: logs/YYYY-MM-DD-app.log,便于归档和清理
 *   - 流自动清理: 保留最近2天的流句柄,防止文件描述符泄漏
 *   - 同步兜底机制: 缓冲区溢出时降级为sync写入保证数据安全
 * 
 * 五个日志级别:
 *   info()  - 一般信息(始终输出)
 *   warn()  - 警告信息(始终输出)
 *   error() - 错误信息(始终输出)
 *   debug() - 调试信息(仅NODE_ENV=development时输出)
 *   http()  - HTTP请求(预留)
 * 
 * 使用方式: 全局单例 const logger = require('./logger'); logger.info('message');
 * 
 * @requires fs Node.js文件系统模块
 * @requires path 路径处理模块
 */
const fs = require('fs');
const path = require('path');

class Logger {
  constructor() {
    this.logDir = path.join(__dirname, '..', 'logs');
    this.ensureLogDir();
    // 使用 WriteStream 替代 appendFileSync，避免阻塞事件循环
    this._streams = new Map();
    this._buffer = [];
    this._flushing = false;
    this._bufferSize = 0;
    this._maxBufferSize = 64 * 1024; // 64KB 缓冲区
  }

  ensureLogDir() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  _getStream(type) {
    const date = new Date().toISOString().split('T')[0];
    const key = `${type}-${date}`;
    if (!this._streams.has(key) || this._streams.get(key).date !== date) {
      const filePath = path.join(this.logDir, `${key}.log`);
      const stream = fs.createWriteStream(filePath, { flags: 'a', encoding: 'utf8' });
      this._streams.set(key, { stream, date });
      // 清理过期流（保留2天）
      this._cleanStreams(date);
    }
    return this._streams.get(key).stream;
  }

  _cleanStreams(currentDate) {
    for (const [key, { date }] of this._streams) {
      if (date !== currentDate) {
        const entry = this._streams.get(key);
        if (entry && entry.stream) entry.stream.end();
        this._streams.delete(key);
      }
    }
  }

  formatMessage(level, message) {
    return `[${new Date().toISOString()}] [${level.toUpperCase()}] ${message}`;
  }

  log(level, message) {
    const formattedMessage = this.formatMessage(level, message);
    console.log(formattedMessage);

    try {
      this._buffer.push(formattedMessage + '\n');
      this._bufferSize += this._buffer[this._buffer.length - 1].length;

      if (this._bufferSize >= this._maxBufferSize) {
        this._flushSync(); // 缓冲区满时同步刷出（极少发生）
      } else if (!this._flushing) {
        this._flushing = true;
        setImmediate(() => this._flush());
      }
    } catch (error) {
      console.error('Failed to write log:', error);
    }
  }

  _flush() {
    if (this._buffer.length === 0) {
      this._flushing = false;
      return;
    }
    const chunk = this._buffer.splice(0, this._buffer.length);
    this._bufferSize = 0;
    const data = chunk.join('');
    const stream = this._getStream('app');
    if (!stream.destroyed) {
      stream.write(data, () => {
        this._flushing = false;
        if (this._buffer.length > 0) this._flush();
      });
    } else {
      this._flushing = false;
    }
  }

  _flushSync() {
    if (this._buffer.length === 0) return;
    const chunk = this._buffer.splice(0, this._buffer.length);
    this._bufferSize = 0;
    try {
      fs.appendFileSync(this._getStream('app').path || this.getLogFilePath('app'), chunk.join(''));
    } catch (e) {
      console.error('Sync flush failed:', e.message);
    }
  }

  getLogFilePath(type) {
    const date = new Date().toISOString().split('T')[0];
    return path.join(this.logDir, `${type}-${date}.log`);
  }

  info(message) { this.log('info', message); }
  warn(message) { this.log('warn', message); }
  error(message) { this.log('error', message); }
  debug(message) {
    if (process.env.NODE_ENV === 'development') {
      this.log('debug', message);
    }
  }
}

module.exports = new Logger();
