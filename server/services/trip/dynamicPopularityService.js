const axios = require('axios');
const { dbRun, dbGet, dbAll } = require('../../database/db');
const logger = require('../logger');
const qwenAIService = require('../ai/qwenAIService');

class DynamicPopularityService {
  constructor() {
    this.cacheTimeout = 24 * 60 * 60 * 1000;
    this.defaultProfile = {
    basePopularity: 0.5,
    peakHours: [10, 11, 14, 15],
    lowHours: [8, 9, 16, 17],
    weekendMultiplier: 1.3,
    holidayMultiplier: 1.6,
    avgVisitDuration: 120,
    areaSize: 'medium',
    indoorRatio: 0.5
  };
  }

  async getAttractionProfile(attractionName, attractionData = null) {
    try {
      const cached = await this.getCachedProfile(attractionName);
      if (cached && this.isCacheValid(cached)) {
        return cached.profile;
      }

      const profile = await this.fetchOrInferProfile(attractionName, attractionData);
      
      await this.cacheProfile(attractionName, profile);
      
      return profile;
    } catch (error) {
      logger.error(`获取景点热度画像失败: ${error.message}`);
      return this.inferFromAttractionData(attractionName, attractionData);
    }
  }

  async getCachedProfile(attractionName) {
    try {
      const row = await dbGet(
        'SELECT * FROM attraction_popularity WHERE attraction_name = ?',
        [attractionName]
      );
      
      if (row) {
        return {
          profile: JSON.parse(row.popularity_data || '{}'),
          updatedAt: row.updated_at
        };
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  isCacheValid(cached) {
    if (!cached || !cached.updatedAt) return false;
    const cacheTime = new Date(cached.updatedAt).getTime();
    return (Date.now() - cacheTime) < this.cacheTimeout;
  }

  async fetchOrInferProfile(attractionName, attractionData) {
    let profile = null;

    profile = await this.tryFetchFromAmap(attractionName);
    if (profile && profile.confidence === 'high') {
      profile.source = 'amap_api';
      return profile;
    }

    profile = await this.inferByAI(attractionName, attractionData, profile);
    if (profile) {
      profile.source = 'ai_inferred';
      return profile;
    }

    if (attractionData) {
      profile = this.inferFromAttractionData(attractionName, attractionData);
      if (profile) {
        profile.source = 'data_inferred';
        return profile;
      }
    }

    return this.getDefaultProfile(attractionName);
  }

  async tryFetchFromAmap(attractionName) {
    const amapService = require('../external/amapService');
    
    try {
      const pois = await amapService.searchPOI(attractionName, '景点', 1, 3);
      if (pois && pois.length > 0) {
        const poi = pois[0];
        return this.analyzeAmapPOI(attractionName, poi);
      }
    } catch (e) {
      logger.warn(`高德API获取失败: ${e.message}`);
    }
    return null;
  }

  analyzeAmapPOI(attractionName, poi) {
    const profile = {
      confidence: 'medium'
    };
    
    if (poi.biz_ext?.rating) {
      const rating = parseFloat(poi.biz_ext.rating);
      profile.basePopularity = Math.min(0.95, 0.3 + (rating / 5) * 0.5);
      profile.rating = rating;
    }
    
    const type = poi.type || '';
    const typecode = poi.typecode || '';
    
    const typeAnalysis = this.analyzePOIType(type, typecode);
    Object.assign(profile, typeAnalysis);
    
    if (poi.biz_ext?.cost) {
      profile.avgCost = poi.biz_ext.cost;
      if (poi.biz_ext.cost > 100) {
        profile.basePopularity = (profile.basePopularity || 0.5) * 0.9;
      }
    }
    
    if (poi.photos?.length > 5) {
      profile.photoCount = poi.photos.length;
      profile.basePopularity = Math.min(0.95, (profile.basePopularity || 0.5) + 0.1);
    }
    
    if (poi.business_area) {
      profile.businessArea = poi.business_area;
    }
    
    profile.amapData = {
      name: poi.name,
      type: poi.type,
      rating: poi.biz_ext?.rating,
      address: poi.address
    };
    
    return profile;
  }

  analyzePOIType(type, typecode) {
    const analysis = {};
    
    const typeStr = type.toLowerCase();
    
    const typePatterns = {
      museum: {
        patterns: ['博物馆', '纪念馆', '展览馆', '美术馆', 'museum'],
        profile: {
          avgVisitDuration: 180,
          areaSize: 'medium',
          indoorRatio: 1.0,
          peakHours: [10, 11, 13, 14],
          lowHours: [9, 15, 16],
          weekendMultiplier: 1.6,
          holidayMultiplier: 2.2,
          reservationRequired: true,
          basePopularityAdd: 0.2
        }
      },
      mountain: {
        patterns: ['山', '峰', '岭', '岳', 'mountain'],
        profile: {
          avgVisitDuration: 240,
          areaSize: 'large',
          indoorRatio: 0.05,
          peakHours: [9, 10, 14, 15],
          lowHours: [7, 8, 16, 17, 18],
          weekendMultiplier: 1.5,
          holidayMultiplier: 2.0,
          physicalRequired: true
        }
      },
      park: {
        patterns: ['公园', '园', '森林', '湿地', 'park'],
        profile: {
          avgVisitDuration: 120,
          areaSize: 'large',
          indoorRatio: 0.1,
          peakHours: [7, 8, 18, 19],
          lowHours: [10, 11, 14, 15, 16],
          weekendMultiplier: 1.3,
          holidayMultiplier: 1.5
        }
      },
      temple: {
        patterns: ['寺', '庙', '观', '宫', '阁', 'temple'],
        profile: {
          avgVisitDuration: 60,
          areaSize: 'small',
          indoorRatio: 0.6,
          peakHours: [9, 10, 14, 15],
          lowHours: [8, 16, 17],
          weekendMultiplier: 1.2,
          holidayMultiplier: 1.5,
          religious: true
        }
      },
      street: {
        patterns: ['街', '巷', '路', '镇', 'street'],
        profile: {
          avgVisitDuration: 90,
          areaSize: 'small',
          indoorRatio: 0.3,
          peakHours: [18, 19, 20, 21],
          lowHours: [9, 10, 11, 22],
          weekendMultiplier: 1.8,
          holidayMultiplier: 2.5,
          nightRecommended: true
        }
      },
      lake: {
        patterns: ['湖', '江', '河', '洲', '岛', 'lake', 'river'],
        profile: {
          avgVisitDuration: 150,
          areaSize: 'large',
          indoorRatio: 0.1,
          peakHours: [10, 11, 14, 15, 16],
          lowHours: [7, 8, 17, 18],
          weekendMultiplier: 1.4,
          holidayMultiplier: 1.8,
          outdoorActivity: true
        }
      },
      plaza: {
        patterns: ['广场', '中心', 'plaza', 'square'],
        profile: {
          avgVisitDuration: 60,
          areaSize: 'medium',
          indoorRatio: 0.8,
          peakHours: [14, 15, 16, 19, 20],
          lowHours: [10, 11, 21, 22],
          weekendMultiplier: 1.5,
          holidayMultiplier: 1.8,
          shopping: true
        }
      },
      themepark: {
        patterns: ['世界之窗', '欢乐谷', '方特', '游乐园', '主题公园', '乐园', 'theme'],
        profile: {
          avgVisitDuration: 360,
          areaSize: 'large',
          indoorRatio: 0.2,
          peakHours: [10, 11, 13, 14, 15],
          lowHours: [9, 16, 17],
          weekendMultiplier: 1.6,
          holidayMultiplier: 2.5,
          ticketRequired: true,
          familyFriendly: true
        }
      },
      zoo: {
        patterns: ['动物园', '野生动物', '海洋馆', '水族馆', 'zoo', 'aquarium'],
        profile: {
          avgVisitDuration: 240,
          areaSize: 'large',
          indoorRatio: 0.3,
          peakHours: [10, 11, 13, 14, 15],
          lowHours: [9, 16, 17],
          weekendMultiplier: 1.7,
          holidayMultiplier: 2.3,
          familyFriendly: true,
          kidFriendly: true
        }
      },
      ancient: {
        patterns: ['古', '遗址', '遗迹', '古迹', 'ancient', 'heritage'],
        profile: {
          avgVisitDuration: 120,
          areaSize: 'medium',
          indoorRatio: 0.2,
          peakHours: [10, 11, 14, 15],
          lowHours: [8, 9, 16, 17],
          weekendMultiplier: 1.4,
          holidayMultiplier: 1.8,
          historical: true
        }
      }
    };
    
    for (const [key, config] of Object.entries(typePatterns)) {
        if (config.patterns.some(p => typeStr.includes(p))) {
          Object.assign(analysis, config.profile);
          analysis.detectedType = key;
          break;
        }
      }
    
    if (!analysis.detectedType) {
      analysis.avgVisitDuration = 120;
      analysis.areaSize = 'medium';
      analysis.indoorRatio = 0.5;
    }
    
    return analysis;
  }

  async inferByAI(attractionName, attractionData, amapProfile) {
    try {
      const prompt = this.buildAIPrompt(attractionName, attractionData, amapProfile);
      
      const aiResponse = await qwenAIService.callAPI([
        { role: 'system', content: this.getSystemPrompt() },
        { role: 'user', content: prompt }
      ]);
      
      const profile = this.parseAIResponse(aiResponse);
      if (profile && profile.confidence !== 'low') {
        return profile;
      }
    } catch (e) {
      logger.warn(`AI推断失败: ${e.message}`);
    }
    return null;
  }

  getSystemPrompt() {
    return `你是一个旅游景点分析专家。根据景点名称和相关信息，分析该景点的特征。

请返回JSON格式的分析结果，包含以下字段：
{
  "attractionType": "景点类型（博物馆/山/公园/街道/湖泊/主题公园/寺庙/古镇/广场/其他）",
  "basePopularity": 0.0-1.0的基础热度值,
  "avgVisitDuration": 平均游览时长（分钟）,
  "areaSize": "面积大小（small/medium/large）",
  "indoorRatio": 室内占比（0.0-1.0）,
  "peakHours": [高峰时段数组，如10,11,14,15],
  "lowHours": [低峰时段数组，如8,9,16,17],
  "weekendMultiplier": 周末热度倍数（1.0-2.5）,
  "holidayMultiplier": 节假日热度倍数（1.0-3.0）,
  "specialFeatures": ["特殊特征数组，如需要预约、适合亲子、夜游推荐等"],
  "confidence": "分析置信度（high/medium/low）",
  "reasoning": "简要说明推断依据"
}

分析原则：
1. 博物馆类：室内、需预约、游览2-3小时、节假日人流大
2. 山岳类：户外、体力消耗大、游览3-4小时、早晨最佳
3. 公园类：面积大、休闲为主、早晚人流多、中午人少
4. 古街/步行街：小吃多、晚上热闹、游览1-2小时
5. 主题公园：全天游玩、节假日人流爆满、适合亲子
6. 寺庙类：文化景点、游览时间短、节假日人流适中
7. 湖泊/江岛：户外、游览2-3小时、适合拍照
8. 广场/商场：购物为主、下午和晚上人多

请根据景点名称的语义和已知信息进行智能推断。`;
  }

  buildAIPrompt(attractionName, attractionData, amapProfile) {
    let prompt = `请分析以下景点：

景点名称：${attractionName}`;
    
    if (attractionData) {
      prompt += `\n已知信息：
- 类型: ${attractionData.type || '未知'}
- 评分: ${attractionData.rating || '未知'}
- 地址: ${attractionData.address || '未知'}`;
    }
    
    if (amapProfile) {
      prompt += `\n高德API分析结果:
- 检测类型: ${amapProfile.detectedType || '未知'}
- 基础热度: ${amapProfile.basePopularity || '未知'}
- 平均游览时长: ${amapProfile.avgVisitDuration || '未知'}分钟`;
    }
    
    prompt += `\n请根据以上信息，智能分析该景点的特征并返回JSON。`;
    
    return prompt;
  }

  parseAIResponse(response) {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const data = JSON.parse(jsonMatch[0]);
        
        const profile = {
          basePopularity: this.validateNumber(data.basePopularity, 0.5, 0.1, 0.95),
          avgVisitDuration: this.validateNumber(data.avgVisitDuration, 120, 30, 480),
          areaSize: this.validateAreaSize(data.areaSize),
          indoorRatio: this.validateNumber(data.indoorRatio, 0.5, 0, 1),
          peakHours: Array.isArray(data.peakHours) ? data.peakHours : [10, 11, 14, 15],
          lowHours: Array.isArray(data.lowHours) ? data.lowHours : [8, 9, 16, 17],
          weekendMultiplier: this.validateNumber(data.weekendMultiplier, 1.3, 1.0, 2.5),
          holidayMultiplier: this.validateNumber(data.holidayMultiplier, 1.6, 1.0, 3.0),
          confidence: data.confidence || 'medium',
          reasoning: data.reasoning || '',
          attractionType: data.attractionType || '其他',
          specialFeatures: Array.isArray(data.specialFeatures) ? data.specialFeatures : []
        };
        
        if (data.specialFeatures) {
          if (data.specialFeatures.includes('需要预约')) {
            profile.reservationRequired = true;
          }
          if (data.specialFeatures.includes('适合亲子')) {
            profile.familyFriendly = true;
          }
          if (data.specialFeatures.includes('夜游推荐')) {
            profile.nightRecommended = true;
          }
        }
        
        return profile;
      }
    } catch (e) {
      logger.error(`解析AI响应失败: ${e.message}`);
      return null;
    }
    return null;
  }

  validateNumber(value, defaultValue, min, max) {
    const num = parseFloat(value);
    if (isNaN(num)) return defaultValue;
    return Math.max(min, Math.min(max, num));
  }

  validateAreaSize(size) {
    const validSizes = ['small', 'medium', 'large'];
    return validSizes.includes(size) ? size : 'medium';
  }

  inferFromAttractionData(attractionName, attractionData) {
    if (!attractionData) return null;
    
    const profile = { ...this.defaultProfile };
    const name = attractionName.toLowerCase();
    const type = (attractionData.type || '').toLowerCase();
    
    const typeAnalysis = this.analyzePOIType(type, '');
    Object.assign(profile, typeAnalysis);
    
    if (attractionData.rating) {
      const ratingFactor = attractionData.rating / 5;
      profile.basePopularity = 0.3 + ratingFactor * 0.5;
    }
    
    if (attractionData.ticketPrice > 0) {
      profile.basePopularity *= 0.95;
      profile.ticketPrice = attractionData.ticketPrice;
    }
    
    if (attractionData.estimatedDuration) {
      profile.avgVisitDuration = attractionData.estimatedDuration * 60;
    }
    
    profile.source = 'data_inferred';
    return profile;
  }

  getDefaultProfile(attractionName) {
    return {
      ...this.defaultProfile,
      source: 'default'
    };
  }

  async cacheProfile(attractionName, profile) {
    try {
      const id = `pop_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      await dbRun(
        `INSERT INTO attraction_popularity (id, attraction_name, popularity_data, updated_at) 
         VALUES (?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE popularity_data = VALUES(popularity_data), updated_at = NOW()`,
        [id, attractionName, JSON.stringify(profile)]
      );
      
      logger.info(`缓存景点热度画像: ${attractionName} (来源: ${profile.source || 'unknown'})`);
    } catch (error) {
      logger.error(`缓存热度画像失败: ${error.message}`);
    }
  }

  async batchUpdateProfiles(attractions) {
    const results = [];
    
    for (const attraction of attractions) {
      const profile = await this.getAttractionProfile(attraction.name, attraction);
      results.push({
        name: attraction.name,
        profile
      });
      
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    return results;
  }

  async getProfilesStats() {
    try {
      const rows = await dbAll('SELECT * FROM attraction_popularity');
      return {
        total: rows.length,
        bySource: rows.reduce((acc, row) => {
          const data = JSON.parse(row.popularity_data || '{}');
          const source = data.source || 'unknown';
          acc[source] = (acc[source] || 0) + 1;
          return acc;
        }, {})
      };
    } catch (error) {
      return { total: 0, bySource: {} };
    }
  }
}

module.exports = new DynamicPopularityService();
