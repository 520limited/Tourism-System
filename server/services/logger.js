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
        // 使用 setImmediate 在当前事件循环tick后异步写入，不阻塞主流程
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
