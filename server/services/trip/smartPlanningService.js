const amapService = require('../external/amapService');
const logger = require('../logger');

/**
 * 智能规划增强服务
 * 所有数据通过API实时获取，禁止固定数据
 */
class SmartPlanningService {
  constructor() {}

  /**
   * 智能路线优化
   * 基于坐标计算，不使用固定数据
   */
  optimizeRoute(attractions, startPoint = null) {
    if (!attractions || attractions.length <= 1) return attractions;

    logger.info(`开始优化路线，共${attractions.length}个景点`);
    
    const optimized = [];
    const unvisited = [...attractions];
    
    let current = startPoint || unvisited.shift();
    optimized.push(current);

    while (unvisited.length > 0) {
      let nearestIndex = 0;
      let minDistance = Infinity;

      unvisited.forEach((attraction, index) => {
        const distance = this.calculateDistance(current, attraction);
        if (distance < minDistance) {
          minDistance = distance;
          nearestIndex = index;
        }
      });

      current = unvisited.splice(nearestIndex, 1)[0];
      optimized.push(current);
    }

    const originalDistance = this.calculateTotalDistance(attractions);
    const optimizedDistance = this.calculateTotalDistance(optimized);
    const savedDistance = originalDistance - optimizedDistance;
    
    logger.info(`路线优化完成，节省距离: ${Math.round(savedDistance)}米`);

    return {
      route: optimized,
      savedDistance: Math.round(savedDistance),
      savedTime: Math.round(savedDistance / 80)
    };
  }

  /**
   * 计算两点间距离
   */
  calculateDistance(point1, point2) {
    if (!point1?.latitude || !point1?.longitude || !point2?.latitude || !point2?.longitude) {
      return Infinity;
    }

    const R = 6371000;
    const lat1 = this.toRadians(point1.latitude);
    const lat2 = this.toRadians(point2.latitude);
    const deltaLat = this.toRadians(point2.latitude - point1.latitude);
    const deltaLon = this.toRadians(point2.longitude - point1.longitude);

    const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
              Math.cos(lat1) * Math.cos(lat2) *
              Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  toRadians(degrees) {
    return degrees * (Math.PI / 180);
  }

  calculateTotalDistance(points) {
    let total = 0;
    for (let i = 0; i < points.length - 1; i++) {
      total += this.calculateDistance(points[i], points[i + 1]);
    }
    return total;
  }

  /**
   * 智能交通推荐
   * 基于距离计算，检查地铁站可用性
   */
  async recommendTransportation(from, to, preferences = {}) {
    const distance = this.calculateDistance(from, to);
    const weather = preferences.weather || 'sunny';
    const hasLuggage = preferences.hasLuggage || false;
    const isRushHour = this.isRushHour();

    logger.info(`交通推荐: ${from.name} -> ${to.name}, 距离: ${Math.round(distance)}米`);

    let recommendations = [];

    // 步行 - 总是推荐（距离合理时）
    if (distance <= 2000) {
      recommendations.push({
        mode: 'walking',
        name: '步行',
        duration: Math.round(distance / 80),
        cost: 0,
        distance: Math.round(distance),
        reason: distance <= 500 ? '距离很近，步行即可' : '距离适中，步行可欣赏沿途风景',
        icon: '🚶'
      });
    }

    // 骑行 - 天气好时推荐
    if (distance <= 3000 && weather !== 'rainy' && !hasLuggage) {
      recommendations.push({
        mode: 'cycling',
        name: '骑行',
        duration: Math.round(distance / 200),
        cost: 2,
        distance: Math.round(distance),
        reason: '共享单车，灵活便捷',
        icon: '🚴'
      });
    }

    // 地铁 - 检查起点终点是否有地铁站
    let subwayInfo = null;
    if (from?.latitude && from?.longitude && to?.latitude && to?.longitude) {
      subwayInfo = await amapService.checkSubwayAvailable(
        { lat: from.latitude, lng: from.longitude },
        { lat: to.latitude, lng: to.longitude }
      );
    }

    if (subwayInfo && subwayInfo.fromAvailable && subwayInfo.toAvailable) {
      const fromStation = subwayInfo.fromStation;
      const toStation = subwayInfo.toStation;
      const walkToStation = fromStation ? parseInt(fromStation.distance) : 0;
      const walkFromStation = toStation ? parseInt(toStation.distance) : 0;
      const totalWalk = walkToStation + walkFromStation;
      
      recommendations.push({
        mode: 'subway',
        name: '地铁',
        duration: Math.round(distance / 500) + 15 + Math.round(totalWalk / 80),
        cost: 2,
        distance: Math.round(distance),
        reason: `${fromStation?.name || '附近站'} → ${toStation?.name || '目的地站'}，准时可靠`,
        icon: '🚇',
        fromStation: fromStation?.name,
        toStation: toStation?.name,
        walkToStation: walkToStation,
        walkFromStation: walkFromStation
      });
    }

    // 网约车 - 总是推荐
    recommendations.push({
      mode: 'taxi',
      name: isRushHour ? '网约车（可能拥堵）' : '网约车',
      duration: Math.round(distance / 300) + 5,
      cost: Math.max(10, Math.round(distance / 1000 * 2.5)),
      distance: Math.round(distance),
      reason: isRushHour ? '高峰期可能拥堵' : '直达目的地，舒适便捷',
      icon: '🚗'
    });

    // 公交 - 检查附近是否有公交站
    if (distance > 1500 && from?.latitude && to?.latitude) {
      const busInfo = await amapService.checkBusAvailable(
        { lat: from.latitude, lng: from.longitude },
        { lat: to.latitude, lng: to.longitude }
      );
      
      if (busInfo && busInfo.fromAvailable && busInfo.toAvailable) {
        recommendations.push({
          mode: 'bus',
          name: '公交',
          duration: Math.round(distance / 250) + 10,
          cost: 2,
          distance: Math.round(distance),
          reason: `${busInfo.fromStation?.name || '附近站'} → ${busInfo.toStation?.name || '目的地站'}，经济实惠`,
          icon: '🚌',
          fromStation: busInfo.fromStation?.name,
          toStation: busInfo.toStation?.name
        });
      }
    }

    return recommendations
      .sort((a, b) => {
        const scoreA = this.calculateTransportScore(a, preferences);
        const scoreB = this.calculateTransportScore(b, preferences);
        return scoreB - scoreA;
      });
  }

  calculateTransportScore(transport, preferences) {
    let score = 0;
    if (preferences.budget === 'tight') {
      score += (20 - transport.cost) * 2;
    }
    if (preferences.timeSensitive) {
      score += 100 - transport.duration;
    }
    if (preferences.comfort) {
      if (transport.mode === 'taxi') score += 20;
      if (transport.mode === 'subway') score += 10;
    }
    return score;
  }

  isRushHour() {
    const hour = new Date().getHours();
    return (hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19);
  }

  /**
   * 生成完整增强行程
   * 包含路线优化和交通方式推荐
   */
  async enhanceItinerary(itinerary, preferences = {}) {
    logger.info('开始增强行程规划...');

    const enhanced = {
      original: itinerary,
      optimizations: [],
      tips: [],
      transports: []
    };

    for (const day of itinerary) {
      if (day.attractions && day.attractions.length > 1) {
        const dayTransports = [];

        // 并行计算所有相邻景点对的交通推荐（替代串行循环）
        const transportTasks = [];
        for (let i = 0; i < day.attractions.length - 1; i++) {
          const from = day.attractions[i];
          const to = day.attractions[i + 1];
          if (from?.latitude && to?.latitude) {
            transportTasks.push(
              this.recommendTransportation(from, to, preferences)
                .then(transport => ({ from: from.name, to: to.name, transport, index: i }))
                .catch(err => {
                  logger.warn(`交通推荐失败 ${from.name}->${to.name}: ${err.message}`);
                  return { from: from.name, to: to.name, transport: [], index: i };
                })
            );
          }
        }

        const results = await Promise.all(transportTasks);
        // 按原始顺序排列
        results.sort((a, b) => a.index - b.index);
        for (const { from, to, transport } of results) {
          if (transport && transport.length > 0) {
            dayTransports.push({
              from,
              to,
              recommendations: transport,
              best: transport[0]
            });
          }
        }
        
        if (dayTransports.length > 0) {
          enhanced.transports.push({
            day: day.day,
            routes: dayTransports
          });
          
          day.transports = dayTransports;
          logger.info(`第${day.day}天交通数据: ${dayTransports.length}条`);
        }
      }
    }

    if (preferences.budget) {
      enhanced.budgetOptimization = this.optimizeBudget(itinerary, preferences.budget);
    }

    logger.info('行程增强完成');
    return enhanced;
  }

  /**
   * 预算优化建议
   * 基于实际价格数据计算
   */
  optimizeBudget(itinerary, targetBudget) {
    const currentCost = this.calculateTotalCost(itinerary);
    const suggestions = [];

    if (currentCost > targetBudget) {
      const diff = currentCost - targetBudget;
      
      suggestions.push({
        category: '住宿',
        suggestion: '选择经济型酒店或青年旅社',
        saving: Math.min(diff * 0.4, 300)
      });

      suggestions.push({
        category: '餐饮',
        suggestion: '增加小吃比例，减少正餐',
        saving: Math.min(diff * 0.3, 200)
      });

      suggestions.push({
        category: '交通',
        suggestion: '多使用地铁和公交',
        saving: Math.min(diff * 0.2, 100)
      });

      suggestions.push({
        category: '景点',
        suggestion: '增加免费景点比例',
        saving: Math.min(diff * 0.1, 100)
      });
    }

    return {
      currentCost,
      targetBudget,
      overBudget: currentCost - targetBudget,
      suggestions: suggestions.filter(s => s.saving > 0),
      potentialSaving: suggestions.reduce((sum, s) => sum + s.saving, 0)
    };
  }

  calculateTotalCost(itinerary) {
    let total = 0;
    itinerary.forEach(day => {
      if (day.dailyCost) {
        total += day.dailyCost.total || 0;
      }
    });
    return total;
  }
}

module.exports = new SmartPlanningService();
