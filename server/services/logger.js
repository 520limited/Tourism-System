const fs = require('fs');
const path = require('path');

class Logger {
  constructor() {
    this.logDir = path.join(__dirname, '..', 'logs');
    this.ensureLogDir();
  }

  ensureLogDir() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  getLogFilePath(type) {
    const date = new Date().toISOString().split('T')[0];
    return path.join(this.logDir, `${type}-${date}.log`);
  }

  formatMessage(level, message) {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level.toUpperCase()}] ${message}`;
  }

  log(level, message) {
    const formattedMessage = this.formatMessage(level, message);
    console.log(formattedMessage);

    try {
      const logPath = this.getLogFilePath('app');
      fs.appendFileSync(logPath, formattedMessage + '\n');
    } catch (error) {
      console.error('Failed to write log:', error);
    }
  }

  info(message) {
    this.log('info', message);
  }

  warn(message) {
    this.log('warn', message);
  }

  error(message) {
    this.log('error', message);
  }

  debug(message) {
    if (process.env.NODE_ENV === 'development') {
      this.log('debug', message);
    }
  }
}

module.exports = new Logger();
