const { dbRun, dbGet, dbAll } = require('../../database/db');
const logger = require('../logger');

class FavoriteService {
  async addFavorite(userId, type, item) {
    try {
      const id = `fav_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const itemData = JSON.stringify(item);
      
      const existing = await dbGet(
        'SELECT id FROM favorites WHERE user_id = ? AND item_type = ? AND item_id = ?',
        [userId, type, item.id || item.name]
      );
      
      if (existing) {
        return { success: false, message: '已收藏' };
      }
      
      await dbRun(
        'INSERT INTO favorites (id, user_id, item_type, item_id, item_data) VALUES (?, ?, ?, ?, ?)',
        [id, userId, type, item.id || item.name, itemData]
      );
      
      logger.info(`用户 ${userId} 收藏了 ${type}: ${item.name}`);
      return { success: true, message: '收藏成功', data: { id, ...item } };
    } catch (error) {
      logger.error(`添加收藏失败: ${error.message}`);
      return { success: false, message: '收藏失败' };
    }
  }

  async removeFavorite(userId, type, itemId) {
    try {
      const result = await dbRun(
        'DELETE FROM favorites WHERE user_id = ? AND item_type = ? AND item_id = ?',
        [userId, type, itemId]
      );
      
      if (result.changes === 0) {
        return { success: false, message: '未找到收藏' };
      }
      
      logger.info(`用户 ${userId} 取消收藏 ${type}: ${itemId}`);
      return { success: true, message: '取消收藏成功' };
    } catch (error) {
      logger.error(`取消收藏失败: ${error.message}`);
      return { success: false, message: '取消收藏失败' };
    }
  }

  async getFavorites(userId, type) {
    try {
      const rows = await dbAll(
        'SELECT * FROM favorites WHERE user_id = ? AND item_type = ? ORDER BY created_at DESC',
        [userId, type]
      );
      
      return rows.map(row => {
        try {
          return { id: row.id, ...JSON.parse(row.item_data), favoritedAt: row.created_at };
        } catch {
          return { id: row.id, name: row.item_id, favoritedAt: row.created_at };
        }
      });
    } catch (error) {
      logger.error(`获取收藏失败: ${error.message}`);
      return [];
    }
  }

  async getAllFavorites(userId) {
    const [attractions, restaurants, hotels] = await Promise.all([
      this.getFavorites(userId, 'attraction'),
      this.getFavorites(userId, 'restaurant'),
      this.getFavorites(userId, 'hotel')
    ]);
    
    return { attractions, restaurants, hotels };
  }

  async isFavorited(userId, type, itemId) {
    try {
      const row = await dbGet(
        'SELECT id FROM favorites WHERE user_id = ? AND item_type = ? AND item_id = ?',
        [userId, type, itemId]
      );
      return !!row;
    } catch {
      return false;
    }
  }

  async toggleFavorite(userId, type, item) {
    const isFav = await this.isFavorited(userId, type, item.id || item.name);
    
    if (isFav) {
      return await this.removeFavorite(userId, type, item.id || item.name);
    } else {
      return await this.addFavorite(userId, type, item);
    }
  }
}

module.exports = new FavoriteService();
