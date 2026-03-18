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
    console.log('开始创建用户行为记录表...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS user_behaviors (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL,
        behavior_type VARCHAR(32) NOT NULL COMMENT 'view/click/favorite/visit/book/share/rate_positive/rate_negative',
        item_type VARCHAR(32) NOT NULL COMMENT 'attraction/restaurant/hotel/trip',
        item_data TEXT COMMENT '项目详情JSON',
        context TEXT COMMENT '上下文信息JSON',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user_id (user_id),
        INDEX idx_behavior_type (behavior_type),
        INDEX idx_item_type (item_type),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户行为记录表'
    `);
    console.log('用户行为记录表创建成功');

    console.log('开始创建用户偏好画像表...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS user_preference_profiles (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL UNIQUE,
        preferences LONGTEXT COMMENT '偏好数据JSON',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_user_id (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户偏好画像表'
    `);
    console.log('用户偏好画像表创建成功');

    console.log('开始创建景点热度数据表...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS attraction_popularity (
        id VARCHAR(64) PRIMARY KEY,
        attraction_name VARCHAR(128) NOT NULL UNIQUE,
        popularity_data LONGTEXT COMMENT '热度预测数据JSON',
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_attraction_name (attraction_name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='景点热度数据表'
    `);
    console.log('景点热度数据表创建成功');

    console.log('开始创建行程热度预测缓存表...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS trip_crowd_predictions (
        id VARCHAR(64) PRIMARY KEY,
        trip_id VARCHAR(64) NOT NULL,
        day_index INT NOT NULL,
        attraction_name VARCHAR(128),
        prediction_data TEXT COMMENT '预测数据JSON',
        predicted_date DATE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_trip_id (trip_id),
        INDEX idx_predicted_date (predicted_date),
        UNIQUE KEY uk_trip_day_attraction (trip_id, day_index, attraction_name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='行程热度预测缓存表'
    `);
    console.log('行程热度预测缓存表创建成功');

    console.log('检查并添加trips表新字段...');
    const [tripsColumns] = await connection.query(`SHOW COLUMNS FROM trips`);
    const columnNames = tripsColumns.map(col => col.Field);

    if (!columnNames.includes('crowd_predictions')) {
      console.log('添加 crowd_predictions 列...');
      await connection.query(`ALTER TABLE trips ADD COLUMN crowd_predictions LONGTEXT COMMENT '热度预测数据JSON' AFTER routes`);
    }

    if (!columnNames.includes('time_estimates')) {
      console.log('添加 time_estimates 列...');
      await connection.query(`ALTER TABLE trips ADD COLUMN time_estimates LONGTEXT COMMENT '时间预估数据JSON' AFTER crowd_predictions`);
    }

    if (!columnNames.includes('user_feedback')) {
      console.log('添加 user_feedback 列...');
      await connection.query(`ALTER TABLE trips ADD COLUMN user_feedback TEXT COMMENT '用户反馈JSON' AFTER time_estimates`);
    }

    console.log('检查并添加users表新字段...');
    const [usersColumns] = await connection.query(`SHOW COLUMNS FROM users`);
    const userColumnNames = usersColumns.map(col => col.Field);

    if (!userColumnNames.includes('preference_summary')) {
      console.log('添加 preference_summary 列...');
      await connection.query(`ALTER TABLE users ADD COLUMN preference_summary TEXT COMMENT '偏好摘要JSON' AFTER preferences`);
    }

    console.log('所有迁移完成！');
    
  } catch (error) {
    console.error('迁移失败:', error.message);
    console.error(error);
  } finally {
    await connection.end();
  }
}

migrate().then(() => {
  console.log('迁移脚本执行完毕');
  process.exit(0);
}).catch(err => {
  console.error('迁移出错:', err);
  process.exit(1);
});
