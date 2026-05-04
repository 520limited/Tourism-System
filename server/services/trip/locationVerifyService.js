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

      // 同一天的景点/餐厅/酒店之间无依赖，可并行（内部由 limiter 控制速率）
      const [verifiedAttractions, verifiedRestaurants, verifiedHotels] = await Promise.all([
        this.verifyAttractions(day.attractions || []),
        this.verifyRestaurants(day.restaurants || []),
        this.verifyHotels(day.hotels || [])
      ]);
      
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
        const matchedPoi = this.findBestMatch(pois, location.name, location.latitude, location.longitude);
        
        // 高德结果不可信（坐标偏差过大），使用AI坐标
        if (!matchedPoi) {
          logger.warn(`[高德验证被拒绝] ${typeName}: ${location.name}, 使用AI坐标 (${location.latitude}, ${location.longitude})`);
          return { ...location, source: 'amap_rejected' };
        }
        
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
   * 找到最佳匹配的POI（增加距离校验，避免匹配到外省）
   */
  findBestMatch(pois, targetName, aiLatitude = null, aiLongitude = null) {
    // 优先选择名称完全匹配的
    const exactMatch = pois.find(poi =>
      poi.name === targetName ||
      poi.name.includes(targetName) ||
      targetName.includes(poi.name)
    );

    const candidate = exactMatch || pois[0];
    if (!candidate) return null;

    // 距离校验：如果AI坐标与高德坐标差距过大（>30km），说明搜索结果不可信，拒绝使用
    if (aiLatitude != null && aiLongitude != null) {
      const distance = this.calculateDistance(
        { latitude: aiLatitude, longitude: aiLongitude },
        { latitude: candidate.latitude, longitude: candidate.longitude }
      );
      if (distance > 30000) {
        logger.warn(`坐标偏差过大 (${Math.round(distance)}m > 30km), 拒绝高德结果: ${targetName} → ${candidate.name}`);
        return null;
      }
    }

    return candidate;
  }

  /** Haversine公式计算两点距离(米) */
  calculateDistance(a, b) {
    if (!a?.latitude || !a?.longitude || !b?.latitude || !b?.longitude) return Infinity;
    const R = 6371000;
    const rad = Math.PI / 180;
    const dLat = (b.latitude - a.latitude) * rad;
    const dLng = (b.longitude - a.longitude) * rad;
    const sinLat = Math.sin(dLat / 2);
    const sinLng = Math.sin(dLng / 2);
    const cosLat1 = Math.cos(a.latitude * rad);
    const cosLat2 = Math.cos(b.latitude * rad);
    const A = sinLat * sinLat + cosLat1 * cosLat2 * sinLng * sinLng;
    return R * 2 * Math.atan2(Math.sqrt(A), Math.sqrt(1 - A));
  }
}

module.exports = new LocationVerifyService();
