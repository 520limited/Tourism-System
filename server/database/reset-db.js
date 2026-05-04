/**
 * @fileoverview 数据库重置与初始化脚本
 * 
 * @module reset-db
 * @description 本脚本用于开发/部署阶段快速重建数据库。执行流程:
 *              1. 连接MySQL数据库(从.env读取连接参数)
 *              2. 关闭外键检查(允许任意顺序删除表)
 *              3. 按依赖顺序逐个DROP所有业务表(子表先删避免外键冲突)
 *              4. 调用db.js的initDatabase()重新建表(含完整索引和迁移逻辑)
 *              5. 输出重建结果验证信息
 * 
 * 使用方法:
 *   node server/database/reset-db.js
 * 
 * 数据表列表(按外键依赖顺序):
 *   shared_trips → trip_routes → favorites → user_behaviors → user_preference_profiles
 *   → attraction_popularity → trips → sessions → users
 * 
 * 注意事项: 此操作会清除所有数据,请勿在生产环境随意执行!
 * 
 * @requires mysql2/promise MySQL异步驱动
 * @requires dotenv 环境变量加载
 * @requires ./db 数据库初始化模块
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
const mysql = require('mysql2/promise');
const logger = require('../services/logger');

// 所有表（按外键依赖顺序排列：子表先删）
const ALL_TABLES = [
  'shared_trips',
  'trip_routes',
  'favorites',
  'user_behaviors',
  'user_preference_profiles',
  'attraction_popularity',
  'trips',
  'sessions',
  'users'
];

async function resetDatabase() {
  console.log('\n🔧 开始重置数据库...\n');

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'travel_planner'
  });

  try {
    // 关闭外键检查（允许任意顺序删除）
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');

    // 逐个删除所有表
    for (const table of ALL_TABLES) {
      const [rows] = await connection.query(`SHOW TABLES LIKE '${table}'`);
      if (rows.length > 0) {
        await connection.query(`DROP TABLE \`${table}\``);
        console.log(`  ✅ 已删除表: ${table}`);
      } else {
        console.log(`  ⏭️  表不存在(跳过): ${table}`);
      }
    }

    // 恢复外键检查
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');

    console.log('\n📦 所有旧表已清除，开始重建...\n');

    // 调用 db.js 的 initDatabase 重建全部表
    const { initDatabase } = require('./db');
    await initDatabase();

    console.log('\n✨ 数据库重置完成！');
    console.log(`   数据库: ${process.env.DB_NAME || 'travel_planner'}`);
    console.log(`   表数量: ${ALL_TABLES.length} 张`);

    // 验证结果
    const [tables] = await connection.query('SHOW TABLES');
    console.log('\n📋 当前表列表:');
    for (const row of tables) {
      const tableName = row[`Tables_in_${process.env.DB_NAME || 'travel_planner'}`];
      const [cols] = await connection.query(`SHOW COLUMNS FROM \`${tableName}\``);
      console.log(`   ├─ ${tableName} (${cols.length} 列)`);
    }
    console.log('');

  } catch (error) {
    console.error('\n❌ 重置失败:', error.message);
    process.exit(1);
  } finally {
    // 确保恢复外键检查
    try { await connection.query('SET FOREIGN_KEY_CHECKS = 1'); } catch (_) {}
    await connection.end();
  }
}

resetDatabase();
