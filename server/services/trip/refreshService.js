const qwenAIService = require('../ai/qwenAIService');
const locationVerifyService = require('./locationVerifyService');
const logger = require('../logger');

class RefreshService {
  async refreshAttractions(currentNames = [], count = 3, area = null, locationContext = '') {
    logger.info(`换一批景点: 排除 ${currentNames.length} 个已存在景点，地理上下文: ${locationContext ? '已提供精确坐标' : area || '长沙'}`);

    try {
      const aiRecommendations = await qwenAIService.generateRecommendations('attractions', area || '长沙', currentNames, count, locationContext);

      if (aiRecommendations.length === 0) {
        logger.warn('AI未返回景点推荐');
        return [];
      }

      logger.info(`AI推荐了 ${aiRecommendations.length} 个景点，开始高德验证坐标...`);

      const verifiedAttractions = await locationVerifyService.verifyAttractions(aiRecommendations);

      logger.info(`换一批景点完成: 获取 ${verifiedAttractions.length} 个新景点`);
      return verifiedAttractions;
    } catch (error) {
      logger.error(`换一批景点失败: ${error.message}`);
      return [];
    }
  }

  async refreshRestaurants(currentNames = [], count = 10, area = null, locationContext = '', cuisine = '') {
    logger.info(`换一批餐厅: 排除 ${currentNames.length} 个已存在餐厅，地理上下文: ${locationContext ? '已提供精确坐标' : area || '长沙'}, 菜系偏好: ${cuisine || '全部'}`);

    try {
      const aiRecommendations = await qwenAIService.generateRecommendations(
        'restaurants', area || '长沙', currentNames, count, locationContext, cuisine
      );

      if (aiRecommendations.length === 0) {
        logger.warn('AI未返回餐厅推荐');
        return [];
      }

      logger.info(`AI推荐了 ${aiRecommendations.length} 家餐厅，开始高德验证坐标...`);

      const verifiedRestaurants = await locationVerifyService.verifyRestaurants(aiRecommendations);

      logger.info(`换一批餐厅完成: 获取 ${verifiedRestaurants.length} 家新餐厅`);
      return verifiedRestaurants;
    } catch (error) {
      logger.error(`换一批餐厅失败: ${error.message}`);
      return [];
    }
  }

  async refreshHotels(currentNames = [], area = '长沙', count = 3, locationContext = '', starRating = '') {
    logger.info(`换一批酒店: 排除 ${currentNames.length} 个已存在酒店，区域: ${area}，星级偏好: ${starRating || '全部'}, 地理上下文: ${locationContext ? '已提供精确坐标' : area}`);

    try {
      const aiRecommendations = await qwenAIService.generateRecommendations(
        'hotels', area, currentNames, count, locationContext, starRating
      );

      if (aiRecommendations.length === 0) {
        logger.warn('AI未返回酒店推荐');
        return [];
      }

      logger.info(`AI推荐了 ${aiRecommendations.length} 家酒店，开始高德验证坐标...`);

      const verifiedHotels = await locationVerifyService.verifyHotels(aiRecommendations);

      logger.info(`换一批酒店完成: 获取 ${verifiedHotels.length} 家新酒店`);
      return verifiedHotels;
    } catch (error) {
      logger.error(`换一批酒店失败: ${error.message}`);
      return [];
    }
  }
}

module.exports = new RefreshService();
