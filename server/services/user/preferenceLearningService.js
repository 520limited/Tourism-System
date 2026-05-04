/**
 * @fileoverview 用户偏好学习引擎 - 基于行为数据的个性化画像构建系统
 * 
 * @module preferenceLearningService
 * @description 本模块通过采集和分析用户在平台上的各类操作行为,构建多维度的用户偏好画像,
 *              实现个性化推荐。是将"通用AI推荐"升级为"千人千面"的关键服务。
 * 
 * 工作机制(闭环流程):
 *   ┌──────────┐     ┌───────────┐     ┌──────────────┐     ┌──────────┐
 *   │ 用户操作 │ ──→ │ 记录行为  │ ──→ │ 加权更新画像 │ ──→ │ 注入AI   │
 *   │浏览/收藏 │     │DB持久化  │     │ 6维度累加    │     │ Prompt   │
 *   └──────────┘     └───────────┘     └──────────────┘     └──────────┘
 * 
 * 行为类型及权重分配:
 *   正向权重: view(+1) click(+2) favorite(+5) visit(+8) book(+10) share(+6) rate_positive(+7)
 *   负向权重: rate_negative(-5) refresh_skip(-2) remove(-3)
 * 
 * 六个画像维度(带权重占比):
 *   attractionType(25%) - 景点类型偏好(自然/人文/娱乐...)
 *   priceRange(20%)      - 价格区间偏好(免费/低价/中等/高价)
 *   cuisineType(15%)     - 菜系口味偏好(湘菜/小吃/西餐...)
 *   hotelStar(15%)       - 酒店档次偏好(3星/4星/5星)
 *   region(15%)          - 区域位置偏好(五一广场/岳麓区...)
 *   activityType(10%)    - 活动类型偏好
 * 
 * 置信度分级:
 *   totalBehaviors < 5  → low(数据不足,不启用个性化)
 *   totalBehaviors < 20 → medium(初步画像,辅助参考)
 *   totalBehaviors >= 20 → high(可靠画像,强力引导AI)
 * 
 * 核心输出: generatePreferencePrompt(userId) → 文本化的用户偏好描述,
 *           直接拼接到 qwenAIService 的 systemPrompt 中影响AI决策
 * 
 * 数据存储: user_behaviors(原始行为) + user_preference_profiles(聚合画像)
 * 
 * @requires ../../database/db 数据库访问层(dbRun/dbGet/dbAll)
 * @requires ../logger 日志服务
 */
const { dbRun, dbGet, dbAll } = require('../../database/db');
const logger = require('../logger');

class PreferenceLearningService {
  constructor() {
    this.preferenceWeights = {
      attractionType: 0.25,
      priceRange: 0.20,
      cuisineType: 0.15,
      hotelStar: 0.15,
      region: 0.15,
      activityType: 0.10
    };
  }

  /**
   * recordBehavior — 记录单次用户行为并触发画像更新
   * 
   * 这是偏好学习的"数据采集入口",每次用户操作都应调用此方法:
   *   浏览景点(view)、收藏(favorite)、评分(rate_positive/negative)、
   *   跳过刷新(refresh_skip)、删除(remove)等
   * 
   * 执行流程: 写入user_behaviors表 → 加权更新preference_profiles表
   */
  async recordBehavior(userId, behavior) {
    const { type, itemType, itemData, context } = behavior;
    const behaviorId = `bh_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      await dbRun(
        `INSERT INTO user_behaviors 
         (id, user_id, behavior_type, item_type, item_data, context, created_at) 
         VALUES (?, ?, ?, ?, ?, ?, NOW())`,
        [
          behaviorId,
          userId,
          type,
          itemType,
          JSON.stringify(itemData || {}),
          JSON.stringify(context || {})
        ]
      );
      
      await this.updatePreferenceProfile(userId, behavior);
      
      logger.info(`记录用户行为: ${userId} - ${type} - ${itemType}`);
      return { success: true, behaviorId };
    } catch (error) {
      logger.error(`记录行为失败: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * updatePreferenceProfile — 核心画像更新算法(加权累加)
   * 
   * 根据行为类型和操作对象,将权重值累加到对应的6个维度:
   *   - 景点操作 → attractionTypes + regions + priceRanges
   *   - 餐厅操作 → cuisineTypes + restaurantPriceRanges
   *   - 酒店操作 → hotelStars + hotelPriceRanges
   *   - 兴趣标签 → interests (半权重0.5)
   * 
   * 每次调用后立即持久化到数据库,保证实时性
   */
  async updatePreferenceProfile(userId, behavior) {
    try {
      let profile = await this.getUserProfile(userId);
      if (!profile) {
        profile = await this.createDefaultProfile(userId);
      }

      const preferences = JSON.parse(profile.preferences || '{}');
      const { type, itemType, itemData, context } = behavior;
      
      const weight = this.getBehaviorWeight(type);
      
      if (itemType === 'attraction' && itemData) {
        preferences.attractionTypes = preferences.attractionTypes || {};
        preferences.regions = preferences.regions || {};
        preferences.priceRanges = preferences.priceRanges || {};
        
        if (itemData.type) {
          preferences.attractionTypes[itemData.type] = 
            (preferences.attractionTypes[itemData.type] || 0) + weight;
        }
        if (itemData.region || itemData.district) {
          const region = itemData.region || itemData.district;
          preferences.regions[region] = (preferences.regions[region] || 0) + weight;
        }
        if (itemData.ticketPrice !== undefined) {
          const priceRange = this.getPriceRange(itemData.ticketPrice);
          preferences.priceRanges[priceRange] = 
            (preferences.priceRanges[priceRange] || 0) + weight;
        }
      }
      
      if (itemType === 'restaurant' && itemData) {
        preferences.cuisineTypes = preferences.cuisineTypes || {};
        preferences.restaurantPriceRanges = preferences.restaurantPriceRanges || {};
        
        if (itemData.cuisine) {
          preferences.cuisineTypes[itemData.cuisine] = 
            (preferences.cuisineTypes[itemData.cuisine] || 0) + weight;
        }
        if (itemData.avgPrice) {
          const priceRange = this.getRestaurantPriceRange(itemData.avgPrice);
          preferences.restaurantPriceRanges[priceRange] = 
            (preferences.restaurantPriceRanges[priceRange] || 0) + weight;
        }
      }
      
      if (itemType === 'hotel' && itemData) {
        preferences.hotelStars = preferences.hotelStars || {};
        preferences.hotelPriceRanges = preferences.hotelPriceRanges || {};
        
        if (itemData.starRating) {
          const starKey = `${itemData.starRating}星`;
          preferences.hotelStars[starKey] = 
            (preferences.hotelStars[starKey] || 0) + weight;
        }
        if (itemData.pricePerNight || itemData.price) {
          const price = itemData.pricePerNight || itemData.price;
          const priceRange = this.getHotelPriceRange(price);
          preferences.hotelPriceRanges[priceRange] = 
            (preferences.hotelPriceRanges[priceRange] || 0) + weight;
        }
      }
      
      if (context?.interests) {
        preferences.interests = preferences.interests || {};
        context.interests.forEach(interest => {
          preferences.interests[interest] = (preferences.interests[interest] || 0) + weight * 0.5;
        });
      }
      
      preferences.lastUpdated = new Date().toISOString();
      preferences.totalBehaviors = (preferences.totalBehaviors || 0) + 1;
      
      await dbRun(
        `UPDATE user_preference_profiles 
         SET preferences = ?, updated_at = NOW() 
         WHERE user_id = ?`,
        [JSON.stringify(preferences), userId]
      );
      
      logger.info(`更新用户偏好画像: ${userId}`);
      return preferences;
    } catch (error) {
      logger.error(`更新偏好画像失败: ${error.message}`);
      throw error;
    }
  }

  getBehaviorWeight(type) {
    const weights = {
      view: 1,
      click: 2,
      favorite: 5,
      visit: 8,
      book: 10,
      share: 6,
      rate_positive: 7,
      rate_negative: -5,
      refresh_skip: -2,
      remove: -3
    };
    return weights[type] || 1;
  }

  getPriceRange(price) {
    if (price === 0) return '免费';
    if (price <= 50) return '低价';
    if (price <= 100) return '中等';
    return '高价';
  }

  getRestaurantPriceRange(price) {
    if (price <= 30) return '经济';
    if (price <= 80) return '中等';
    if (price <= 150) return '中高';
    return '高端';
  }

  getHotelPriceRange(price) {
    if (price <= 200) return '经济';
    if (price <= 400) return '舒适';
    if (price <= 800) return '高档';
    return '豪华';
  }

  async getUserProfile(userId) {
    try {
      const profile = await dbGet(
        'SELECT * FROM user_preference_profiles WHERE user_id = ?',
        [userId]
      );
      return profile;
    } catch (error) {
      logger.error(`获取用户画像失败: ${error.message}`);
      return null;
    }
  }

  async createDefaultProfile(userId) {
    const profileId = `prof_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const defaultPreferences = {
      attractionTypes: {},
      cuisineTypes: {},
      hotelStars: {},
      regions: {},
      priceRanges: {},
      restaurantPriceRanges: {},
      hotelPriceRanges: {},
      interests: {},
      totalBehaviors: 0,
      createdAt: new Date().toISOString()
    };
    
    await dbRun(
      `INSERT INTO user_preference_profiles 
       (id, user_id, preferences, created_at, updated_at) 
       VALUES (?, ?, ?, NOW(), NOW())`,
      [profileId, userId, JSON.stringify(defaultPreferences)]
    );
    
    return { id: profileId, user_id: userId, preferences: JSON.stringify(defaultPreferences) };
  }

  async getPersonalizedRecommendations(userId, type, options = {}) {
    try {
      const profile = await this.getUserProfile(userId);
      if (!profile) {
        return { recommendations: [], reason: '暂无偏好数据' };
      }
      
      const preferences = JSON.parse(profile.preferences || '{}');
      const scores = this.calculatePreferenceScores(preferences, type);
      
      return {
        recommendations: scores,
        preferences: this.getTopPreferences(preferences, type),
        confidence: this.calculateConfidence(preferences)
      };
    } catch (error) {
      logger.error(`获取个性化推荐失败: ${error.message}`);
      return { recommendations: [], error: error.message };
    }
  }

  calculatePreferenceScores(preferences, type) {
    const scores = [];
    
    if (type === 'attraction') {
      const types = preferences.attractionTypes || {};
      Object.entries(types).forEach(([t, score]) => {
        scores.push({ type: t, score, category: 'attractionType' });
      });
      
      const regions = preferences.regions || {};
      Object.entries(regions).forEach(([r, score]) => {
        scores.push({ region: r, score, category: 'region' });
      });
    }
    
    if (type === 'restaurant') {
      const cuisines = preferences.cuisineTypes || {};
      Object.entries(cuisines).forEach(([c, score]) => {
        scores.push({ cuisine: c, score, category: 'cuisineType' });
      });
    }
    
    if (type === 'hotel') {
      const stars = preferences.hotelStars || {};
      Object.entries(stars).forEach(([s, score]) => {
        scores.push({ starRating: s, score, category: 'hotelStar' });
      });
    }
    
    return scores.sort((a, b) => b.score - a.score);
  }

  getTopPreferences(preferences, type, limit = 3) {
    const result = {};
    
    if (type === 'attraction' || type === 'all') {
      result.topAttractionTypes = this.getTopItems(preferences.attractionTypes, limit);
      result.topRegions = this.getTopItems(preferences.regions, limit);
    }
    
    if (type === 'restaurant' || type === 'all') {
      result.topCuisines = this.getTopItems(preferences.cuisineTypes, limit);
    }
    
    if (type === 'hotel' || type === 'all') {
      result.topHotelStars = this.getTopItems(preferences.hotelStars, limit);
    }
    
    return result;
  }

  getTopItems(obj, limit) {
    if (!obj) return [];
    return Object.entries(obj)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([key, value]) => ({ name: key, score: value }));
  }

  calculateConfidence(preferences) {
    const totalBehaviors = preferences.totalBehaviors || 0;
    if (totalBehaviors < 5) return 'low';
    if (totalBehaviors < 20) return 'medium';
    return 'high';
  }

  /**
   * generatePreferencePrompt — 将结构化画像转为AI可读的文本提示
   * 
   * 输出格式示例:
   *   【用户偏好画像】
   *   偏好景点类型: 自然风光、人文历史
   *   偏好区域: 岳麓区、五一广场
   *   偏好菜系: 湘菜、小吃
   *   兴趣标签: 美食、摄影
   * 
   * 此文本直接拼接至qwenAIService的systemPrompt,影响AI推荐决策
   */
  async generatePreferencePrompt(userId) {
    try {
      const profile = await this.getUserProfile(userId);
      if (!profile) {
        return '';
      }
      
      const preferences = JSON.parse(profile.preferences || '{}');
      const topPrefs = this.getTopPreferences(preferences, 'all', 3);
      
      let prompt = '\n【用户偏好画像】';
      
      if (topPrefs.topAttractionTypes?.length > 0) {
        prompt += `\n偏好景点类型: ${topPrefs.topAttractionTypes.map(p => p.name).join('、')}`;
      }
      if (topPrefs.topRegions?.length > 0) {
        prompt += `\n偏好区域: ${topPrefs.topRegions.map(p => p.name).join('、')}`;
      }
      if (topPrefs.topCuisines?.length > 0) {
        prompt += `\n偏好菜系: ${topPrefs.topCuisines.map(p => p.name).join('、')}`;
      }
      if (topPrefs.topHotelStars?.length > 0) {
        prompt += `\n偏好酒店档次: ${topPrefs.topHotelStars.map(p => p.name).join('、')}`;
      }
      
      const interests = preferences.interests || {};
      const topInterests = Object.entries(interests)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([k]) => k);
      if (topInterests.length > 0) {
        prompt += `\n兴趣标签: ${topInterests.join('、')}`;
      }
      
      return prompt;
    } catch (error) {
      logger.error(`生成偏好提示失败: ${error.message}`);
      return '';
    }
  }

  async recordTripFeedback(userId, tripId, feedback) {
    const { rating, comments, likedItems, dislikedItems } = feedback;
    
    try {
      await this.recordBehavior(userId, {
        type: rating >= 4 ? 'rate_positive' : 'rate_negative',
        itemType: 'trip',
        itemData: { tripId, rating, comments },
        context: { likedItems, dislikedItems }
      });
      
      if (likedItems) {
        for (const item of likedItems) {
          await this.recordBehavior(userId, {
            type: 'favorite',
            itemType: item.type,
            itemData: item
          });
        }
      }
      
      if (dislikedItems) {
        for (const item of dislikedItems) {
          await this.recordBehavior(userId, {
            type: 'refresh_skip',
            itemType: item.type,
            itemData: item
          });
        }
      }
      
      logger.info(`记录行程反馈: ${userId} - ${tripId} - 评分${rating}`);
      return { success: true };
    } catch (error) {
      logger.error(`记录反馈失败: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async batchRecordBehaviors(userId, behaviors) {
    const results = [];
    for (const behavior of behaviors) {
      const result = await this.recordBehavior(userId, behavior);
      results.push(result);
    }
    return results;
  }

  async getUserBehaviorHistory(userId, options = {}) {
    const { limit = 50, type, itemType } = options;
    
    let sql = 'SELECT * FROM user_behaviors WHERE user_id = ?';
    const params = [userId];
    
    if (type) {
      sql += ' AND behavior_type = ?';
      params.push(type);
    }
    if (itemType) {
      sql += ' AND item_type = ?';
      params.push(itemType);
    }
    
    sql += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);
    
    try {
      const rows = await dbAll(sql, params);
      return rows.map(row => ({
        ...row,
        item_data: JSON.parse(row.item_data || '{}'),
        context: JSON.parse(row.context || '{}')
      }));
    } catch (error) {
      logger.error(`获取行为历史失败: ${error.message}`);
      return [];
    }
  }
}

module.exports = new PreferenceLearningService();
