require('dotenv').config();
const mysql = require('mysql2/promise');

async function migrate() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '615715',
    database: process.env.DB_NAME || 'travel_planner'
  });

  console.log('连接数据库成功');

  try {
    // 检查 activities 列是否存在
    const [activitiesColumns] = await connection.query(`SHOW COLUMNS FROM trips LIKE 'activities'`);
    
    if (activitiesColumns.length === 0) {
      console.log('activities 列不存在，正在添加...');
      await connection.query(`ALTER TABLE trips ADD COLUMN activities TEXT AFTER requirements`);
      console.log('成功添加 activities 列！');
    } else {
      console.log('activities 列已存在，无需添加');
    }

    // 检查 is_favorite 列是否存在
    const [favoriteColumns] = await connection.query(`SHOW COLUMNS FROM trips LIKE 'is_favorite'`);
    
    if (favoriteColumns.length === 0) {
      console.log('is_favorite 列不存在，正在添加...');
      await connection.query(`ALTER TABLE trips ADD COLUMN is_favorite BOOLEAN DEFAULT FALSE AFTER status`);
      console.log('成功添加 is_favorite 列！');
    } else {
      console.log('is_favorite 列已存在，无需添加');
    }
  } catch (error) {
    console.error('迁移失败:', error.message);
  } finally {
    await connection.end();
  }
}

migrate().then(() => {
  console.log('迁移完成');
  process.exit(0);
}).catch(err => {
  console.error('迁移出错:', err);
  process.exit(1);
});
