const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const app = express();
const PORT = process.env.PORT || 3002;

const { limiter, requestLogger, errorHandler } = require('./middleware');
const { initDatabase } = require('./database/db');

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);
app.use(limiter);

const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: '长沙旅游智能规划系统后端服务运行中' });
});

const apiController = require('./controllers/apiController');
app.use('/api', apiController);

app.use(errorHandler);

const startServer = async () => {
  try {
    await initDatabase();
    app.listen(PORT, () => {
      console.log(`后端服务器运行在 http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('服务器启动失败:', error.message);
    process.exit(1);
  }
};

startServer();
