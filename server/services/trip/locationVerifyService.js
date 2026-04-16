const amapService = require('../external/amapService');
const logger = require('../logger');

/**
 * 地点验证服务
 * 用高德地图API验证AI生成的所有地点，获取精准坐标
 * 优化：并行验证，减少延迟
 */
class LocationVerifyService {
  /**
   * 验证并修正行程中的所有地点
   */
  async verifyItinerary(itinerary) {
    logger.info('========== 开始验证行程中的所有地点坐标 ==========');
    
    const verifiedItinerary = [];
    let totalVerified = 0;
    let totalUnverified = 0;
    
    for (const day of itinerary) {
      logger.info(`--- 验证第 ${day.day} 天的地点 ---`);
      
      // 串行验证，避免并发请求过多触发高德API限制
      const verifiedAttractions = await this.verifyAttractions(day.attractions || []);
      const verifiedRestaurants = await this.verifyRestaurants(day.restaurants || []);
      const verifiedHotels = await this.verifyHotels(day.hotels || []);
      
      const dayVerified = verifiedAttractions.filter(a => a.source === 'amap_verified').length +
                         verifiedRestaurants.filter(r => r.source === 'amap_verified').length +
                         verifiedHotels.filter(h => h.source === 'amap_verified').length;
      const dayUnverified = verifiedAttractions.filter(a => a.source !== 'amap_verified').length +
                           verifiedRestaurants.filter(r => r.source !== 'amap_verified').length +
                           verifiedHotels.filter(h => h.source !== 'amap_verified').length;
      
      totalVerified += dayVerified;
      totalUnverified += dayUnverified;
      
      logger.info(`第 ${day.day} 天验证完成: 高德验证 ${dayVerified} 个, 使用AI坐标 ${dayUnverified} 个`);
      
      const verifiedDay = {
        ...day,
        attractions: verifiedAttractions,
        restaurants: verifiedRestaurants,
        hotels: verifiedHotels
      };
      
      verifiedItinerary.push(verifiedDay);
    }
    
    logger.info(`========== 地点坐标验证完成 ==========`);
    logger.info(`总计: 高德验证成功 ${totalVerified} 个, 使用AI坐标 ${totalUnverified} 个`);
    return verifiedItinerary;
  }

  /**
   * 批量验证地点（串行，带延时）
   */
  async batchVerifyLocations(locations, type) {
    const results = [];
    
    for (const location of locations) {
      const result = await this.verifySingleLocation(location, type);
      results.push(result);
      await this.delay(250);
    }
    
    return results;
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 验证单个地点
   */
  async verifySingleLocation(location, type) {
    const typeNames = {
      attraction: '景点',
      restaurant: '餐厅',
      hotel: '酒店'
    };
    const typeName = typeNames[type] || type;
    
    try {
      let pois = [];
      
      switch (type) {
        case 'attraction':
          pois = await amapService.searchAttractions([location.name]);
          break;
        case 'restaurant':
          pois = await amapService.searchRestaurants([location.name]);
          break;
        case 'hotel':
          pois = await amapService.searchHotels([location.name]);
          break;
      }
      
      if (pois && pois.length > 0) {
        const matchedPoi = this.findBestMatch(pois, location.name);
        
        const aiCoord = `(${location.latitude}, ${location.longitude})`;
        const amapCoord = `(${matchedPoi.latitude}, ${matchedPoi.longitude})`;
        
        logger.info(`[高德验证成功] ${typeName}: ${location.name}`);
        logger.info(`  AI坐标: ${aiCoord} -> 高德坐标: ${amapCoord}`);
        logger.info(`  地址: ${matchedPoi.address || '无'}`);
        
        return {
          ...location,
          id: matchedPoi.id || location.id,
          name: location.name,
          address: matchedPoi.address || location.address,
          latitude: matchedPoi.latitude,
          longitude: matchedPoi.longitude,
          starRating: location.starRating,  // 保留AI返回的星级（高德POI无此字段）
          rating: matchedPoi.rating || location.rating,
          description: location.description || location.reason || matchedPoi.description || '',
          source: 'amap_verified'
        };
      } else {
        logger.warn(`[高德未找到] ${typeName}: ${location.name}, 使用AI坐标 (${location.latitude}, ${location.longitude})`);
        return {
          ...location,
          description: location.description || location.reason || '',
          source: 'ai_unverified'
        };
      }
    } catch (error) {
      logger.error(`验证${typeName}失败 ${location.name}: ${error.message}`);
      return {
        ...location,
        description: location.description || location.reason || '',
        source: 'ai_error'
      };
    }
  }

  /**
   * 验证景点
   */
  async verifyAttractions(attractions) {
    return await this.batchVerifyLocations(attractions, 'attraction');
  }

  /**
   * 验证餐厅
   */
  async verifyRestaurants(restaurants) {
    return await this.batchVerifyLocations(restaurants, 'restaurant');
  }

  /**
   * 验证酒店
   */
  async verifyHotels(hotels) {
    return await this.batchVerifyLocations(hotels, 'hotel');
  }

  /**
   * 找到最佳匹配的POI
   */
  findBestMatch(pois, targetName) {
    // 优先选择名称完全匹配的
    const exactMatch = pois.find(poi => 
      poi.name === targetName || 
      poi.name.includes(targetName) || 
      targetName.includes(poi.name)
    );
    
    if (exactMatch) return exactMatch;
    
    // 如果没有完全匹配，返回第一个结果
    return pois[0];
  }
}

module.exports = new LocationVerifyService();
