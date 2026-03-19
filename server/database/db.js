const mysql = require('mysql2/promise');
const logger = require('../services/logger');

let pool = null;

const initDatabase = async () => {
  pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'travel_planner',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });

  try {
    const connection = await pool.getConnection();
    logger.info('MySQL数据库连接成功');
    connection.release();
    
    await createTables();
    return true;
  } catch (error) {
    logger.error(`MySQL连接失败: ${error.message}`);
    throw error;
  }
};

const createTables = async () => {
  const conn = await pool.getConnection();
  
  try {
    await conn.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(64) PRIMARY KEY,
        email VARCHAR(128) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        nickname VARCHAR(64),
        avatar VARCHAR(255),
        preferences TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    logger.info('用户表已就绪');

    await conn.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    logger.info('会话表已就绪');

    await conn.query(`
      CREATE TABLE IF NOT EXISTS trips (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64),
        title VARCHAR(255),
        requirements TEXT,
        activities TEXT,
        itinerary LONGTEXT,
        conversation_history LONGTEXT,
        routes LONGTEXT,
        status VARCHAR(32) DEFAULT 'draft',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    logger.info('行程表已就绪');
    
    // 迁移：检查并添加 activities 列
    try {
      const [columns] = await conn.query(`SHOW COLUMNS FROM trips LIKE 'activities'`);
      if (columns.length === 0) {
        await conn.query(`ALTER TABLE trips ADD COLUMN activities TEXT AFTER requirements`);
        logger.info('已添加 activities 列到 trips 表');
      }
    } catch (migrationError) {
      logger.warn(`迁移检查失败: ${migrationError.message}`);
    }

    // 迁移：检查并添加 session_id 列
    try {
      const [sessionColumns] = await conn.query(`SHOW COLUMNS FROM trips LIKE 'session_id'`);
      if (sessionColumns.length === 0) {
        await conn.query(`ALTER TABLE trips ADD COLUMN session_id VARCHAR(64) AFTER user_id`);
        logger.info('已添加 session_id 列到 trips 表');
      }
    } catch (migrationError) {
      logger.warn(`session_id 迁移检查失败: ${migrationError.message}`);
    }

    await conn.query(`
      CREATE TABLE IF NOT EXISTS trip_routes (
        id VARCHAR(64) PRIMARY KEY,
        trip_id VARCHAR(64) NOT NULL,
        day INT NOT NULL,
        route_type VARCHAR(32),
        origin_name VARCHAR(255),
        destination_name VARCHAR(255),
        origin_coord VARCHAR(64),
        destination_coord VARCHAR(64),
        route_data LONGTEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    logger.info('行程路径表已就绪');

    await conn.query(`
      CREATE TABLE IF NOT EXISTS favorites (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL,
        item_type VARCHAR(32) NOT NULL,
        item_id VARCHAR(64),
        item_data TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    logger.info('收藏表已就绪');

    await conn.query(`
      CREATE TABLE IF NOT EXISTS shared_trips (
        share_id VARCHAR(64) PRIMARY KEY,
        trip_id VARCHAR(64) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME,
        view_count INT DEFAULT 0,
        FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    logger.info('分享表已就绪');

  } finally {
    conn.release();
  }
};

const dbRun = async (sql, params = []) => {
  const [result] = await pool.execute(sql, params);
  return { lastID: result.insertId, changes: result.affectedRows };
};

const dbGet = async (sql, params = []) => {
  const [rows] = await pool.execute(sql, params);
  return rows[0] || null;
};

const dbAll = async (sql, params = []) => {
  const [rows] = await pool.execute(sql, params);
  return rows;
};

module.exports = { initDatabase, dbRun, dbGet, dbAll };
