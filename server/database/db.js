const mysql = require('mysql2/promise');
const logger = require('../services/logger');

let pool = null;

/**
 * 初始化数据库连接池 + 自动建表 + 迁移检查（一体化）
 * 所有表结构和迁移逻辑集中在此文件，无需独立迁移脚本
 */
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

// ==================== 辅助函数 ====================

/**
 * 安全添加列：如果列不存在则 ALTER TABLE ADD
 */
async function ensureColumn(conn, table, column, definition) {
  try {
    const [cols] = await conn.query(`SHOW COLUMNS FROM \`${table}\` LIKE '${column}'`);
    if (cols.length === 0) {
      await conn.query(`ALTER TABLE \`${table}\` ADD COLUMN ${definition}`);
      logger.info(`已添加 ${table}.${column} 列`);
    }
  } catch (err) {
    // 列已存在或其他错误，静默处理
    if (!err.message.includes('Duplicate')) {
      logger.warn(`列迁移检查 ${table}.${column}: ${err.message}`);
    }
  }
}

// ==================== 表定义与创建 ====================

const createTables = async () => {
  const conn = await pool.getConnection();

  try {
    // ─── 1. 用户表 ──────────────────────
    await conn.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(64) PRIMARY KEY,
        email VARCHAR(128) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        nickname VARCHAR(64),
        avatar VARCHAR(255),
        preferences TEXT,
        preference_summary TEXT COMMENT '偏好摘要JSON',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    logger.info('用户表已就绪');

    // ─── 2. 会话表 ──────────────────────
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

    // ─── 3. 行程表（含所有字段）──────────
    await conn.query(`
      CREATE TABLE IF NOT EXISTS trips (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64),
        session_id VARCHAR(64) COMMENT '游客会话标识',
        title VARCHAR(255),
        requirements TEXT,
        activities TEXT,
        itinerary LONGTEXT,
        conversation_history LONGTEXT,
        routes LONGTEXT,
        crowd_predictions LONGTEXT COMMENT '热度预测数据JSON',
        time_estimates LONGTEXT COMMENT '时间预估数据JSON',
        user_feedback TEXT COMMENT '用户反馈JSON',
        is_favorite BOOLEAN DEFAULT FALSE,
        status VARCHAR(32) DEFAULT 'draft',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    logger.info('行程表已就绪');

    // 行程表索引优化：加速按 user_id / session_id / is_favorite 查询
    await ensureColumn(conn, 'trips', 'session_id', "session_id VARCHAR(64) AFTER user_id");

    // 兼容旧数据库：确保以下列存在（新库已在 CREATE TABLE 中定义，此处为安全兜底）
    await ensureColumn(conn, 'trips', 'activities', "activities TEXT AFTER requirements");
    await ensureColumn(conn, 'trips', 'is_favorite', "is_favorite BOOLEAN DEFAULT FALSE AFTER status");
    await ensureColumn(conn, 'trips', 'crowd_predictions', "crowd_predictions LONGTEXT COMMENT '热度预测数据JSON' AFTER routes");
    await ensureColumn(conn, 'trips', 'time_estimates', "time_estimates LONGTEXT COMMENT '时间预估数据JSON' AFTER crowd_predictions");
    await ensureColumn(conn, 'trips', 'user_feedback', "user_feedback TEXT COMMENT '用户反馈JSON' AFTER time_estimates");

    // 查询性能索引
    try {
      await conn.query(`CREATE INDEX IF NOT EXISTS idx_trips_user_id ON trips(user_id)`);
      await conn.query(`CREATE INDEX IF NOT EXISTS idx_trips_session_id ON trips(session_id)`);
      await conn.query(`CREATE INDEX IF NOT EXISTS idx_trips_is_favorite ON trips(is_favorite)`);
    } catch (_) { /* 索引可能已存在 */ }

    // ─── 4. 行程路线表 ──────────────────
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
        FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
        INDEX idx_trip_routes_trip_id (trip_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    logger.info('行程路径表已就绪');

    // ─── 5. 收藏表 ──────────────────────
    await conn.query(`
      CREATE TABLE IF NOT EXISTS favorites (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL,
        item_type VARCHAR(32) NOT NULL,
        item_id VARCHAR(64),
        item_data TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY uk_user_item (user_id, item_type, item_id(64)),
        INDEX idx_favorites_type (item_type)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    logger.info('收藏表已就绪');

    // ─── 6. 分享表 ──────────────────────
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

    // ─── 7. 用户行为记录表 ──────────────
    await conn.query(`
      CREATE TABLE IF NOT EXISTS user_behaviors (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL,
        behavior_type VARCHAR(32) NOT NULL COMMENT 'view/click/favorite/visit/book/share/rate_positive/rate_negative',
        item_type VARCHAR(32) NOT NULL COMMENT 'attraction/restaurant/hotel/trip',
        item_data TEXT COMMENT '项目详情JSON',
        context TEXT COMMENT '上下文信息JSON',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_behaviors_user_id (user_id),
        INDEX idx_behaviors_behavior_type (behavior_type),
        INDEX idx_behaviors_item_type (item_type),
        INDEX idx_behaviors_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户行为记录表'
    `);
    logger.info('用户行为记录表已就绪');

    // ─── 8. 用户偏好画像表 ──────────────
    await conn.query(`
      CREATE TABLE IF NOT EXISTS user_preference_profiles (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL UNIQUE,
        preferences LONGTEXT COMMENT '偏好数据JSON',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_pref_profiles_user_id (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户偏好画像表'
    `);
    logger.info('用户偏好画像表已就绪');

    // ─── 9. 景点热度数据表 ──────────────
    await conn.query(`
      CREATE TABLE IF NOT EXISTS attraction_popularity (
        id VARCHAR(64) PRIMARY KEY,
        attraction_name VARCHAR(128) NOT NULL UNIQUE,
        popularity_data LONGTEXT COMMENT '热度预测数据JSON',
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_attraction_popularity_name (attraction_name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='景点热度数据表'
    `);
    logger.info('景点热度数据表已就绪');

    // ─── 用户表迁移：preference_summary ──
    await ensureColumn(conn, 'users', 'preference_summary', "preference_summary TEXT COMMENT '偏好摘要JSON' AFTER preferences");

    logger.info('✅ 全部 9 张表已就绪，所有迁移检查完成');

  } finally {
    conn.release();
  }
};

// ==================== 数据库查询辅助方法 ====================

/**
 * 执行写操作 (INSERT/UPDATE/DELETE)
 * @returns {{ lastID: number, changes: number }}
 */
const dbRun = async (sql, params = []) => {
  const [result] = await pool.execute(sql, params);
  return { lastID: result.insertId, changes: result.affectedRows };
};

/**
 * 查询单条记录
 * @returns {Object|null}
 */
const dbGet = async (sql, params = []) => {
  const [rows] = await pool.execute(sql, params);
  return rows[0] || null;
};

/**
 * 查询多条记录
 * @returns {Array}
 */
const dbAll = async (sql, params = []) => {
  const [rows] = await pool.execute(sql, params);
  return rows;
};

module.exports = { initDatabase, pool: () => pool, dbRun, dbGet, dbAll };
