const amapService = require('./amapService');
const logger = require('../logger');

/**
 * 酒店搜索服务
 * 实时从高德地图API获取真实酒店数据
 */
class HotelSearchService {
  /**
   * 根据区域和预算搜索酒店
   */
  async searchHotelsByAreaAndBudget(area, budget, count = 3) {
    logger.info(`搜索酒店: 区域=${area}, 预算=${budget}, 数量=${count}`);
    
    // 构建搜索关键词
    const keywords = this.buildHotelKeywords(area, budget);
    
    // 从高德地图搜索酒店
    const hotels = await amapService.searchHotels(keywords);
    
    // 根据预算筛选
    const filteredHotels = this.filterByBudget(hotels, budget);
    
    // 格式化并返回指定数量
    return this.formatHotels(filteredHotels.slice(0, count));
  }

  /**
   * 构建酒店搜索关键词
   */
  buildHotelKeywords(area, budget) {
    const keywords = [];
    
    // 根据区域构建关键词
    if (area && area !== '不限') {
      keywords.push(`${area}酒店`);
      keywords.push(`${area}宾馆`);
      
      // 根据预算添加档次关键词
      if (budget) {
        const budgetNum = this.parseBudget(budget);
        if (budgetNum >= 500) {
          keywords.push(`${area}高档酒店`);
          keywords.push(`${area}星级酒店`);
        } else if (budgetNum >= 300) {
          keywords.push(`${area}舒适型酒店`);
          keywords.push(`${area}连锁酒店`);
        } else {
          keywords.push(`${area}经济型酒店`);
          keywords.push(`${area}快捷酒店`);
        }
      }
    } else {
      // 默认搜索长沙热门区域
      keywords.push('长沙五一广场酒店');
      keywords.push('长沙黄兴路酒店');
      keywords.push('长沙火车站酒店');
    }
    
    return keywords;
  }

  /**
   * 解析预算字符串为数字
   */
  parseBudget(budget) {
    if (!budget) return 300;
    
    // 处理 "1000-2000" 格式
    if (budget.includes('-')) {
      const parts = budget.split('-');
      return parseInt(parts[0]) || 300;
    }
    
    // 处理 "2000+" 格式
    if (budget.includes('+')) {
      return parseInt(budget.replace('+', '')) || 500;
    }
    
    // 处理纯数字
    const num = parseInt(budget);
    return isNaN(num) ? 300 : num;
  }

  /**
   * 根据预算筛选酒店
   */
  filterByBudget(hotels, budget) {
    if (!budget) return hotels;
    
    const budgetNum = this.parseBudget(budget);
    
    return hotels.filter(hotel => {
      // 如果高德返回了价格信息，使用它
      if (hotel.cost) {
        const cost = parseInt(hotel.cost);
        if (!isNaN(cost)) {
          // 根据预算范围筛选
          if (budgetNum < 300) return cost <= 300;
          if (budgetNum < 500) return cost >= 200 && cost <= 500;
          return cost >= 400;
        }
      }
      
      // 如果没有价格信息，根据酒店名称推测
      return this.estimateHotelPrice(hotel.name, budgetNum);
    });
  }

  /**
   * 估算酒店价格
   */
  estimateHotelPrice(name, budgetNum) {
    if (!name) return true;
    
    const name_lower = name.toLowerCase();
    
    // 高端酒店关键词
    const luxury = ['希尔顿', '万豪', '洲际', '喜来登', '香格里拉', '君悦', '瑞吉', 'w酒店', '尼依格罗'];
    // 中端酒店关键词
    const mid = ['亚朵', '全季', '桔子', '麗枫', '维也纳', '锦江之星', '如家精选', '汉庭优佳'];
    // 经济型酒店关键词
    const budgetHotels = ['如家', '汉庭', '7天', '格林豪泰', '速8', '布丁', '易佰'];
    
    if (luxury.some(k => name_lower.includes(k))) return budgetNum >= 500;
    if (mid.some(k => name_lower.includes(k))) return budgetNum >= 200 && budgetNum < 800;
    if (budgetHotels.some(k => name_lower.includes(k))) return budgetNum < 500;
    
    return true; // 未知类型，默认包含
  }

  /**
   * 格式化酒店数据
   */
  formatHotels(hotels) {
    return hotels.map((hotel, index) => ({
      id: hotel.id || `hotel_${index}`,
      name: hotel.name,
      starRating: this.detectStarRating(hotel.name),
      rating: hotel.rating || 4.0,
      pricePerNight: this.estimatePrice(hotel.name),
      description: hotel.description || `${hotel.businessArea || ''} ${hotel.type || '酒店'}`,
      address: hotel.address,
      latitude: hotel.latitude,
      longitude: hotel.longitude,
      tel: hotel.tel,
      source: 'amap_realtime',
      timestamp: new Date()
    }));
  }

  /**
   * 检测酒店星级
   */
  detectStarRating(name) {
    if (!name) return 3;
    
    const name_lower = name.toLowerCase();
    
    if (name_lower.includes('五星级') || name_lower.includes('5星级') || 
        /希尔顿|万豪|洲际|喜来登|香格里拉|君悦|瑞吉|w酒店|尼依格罗/.test(name)) {
      return 5;
    }
    
    if (name_lower.includes('四星级') || name_lower.includes('4星级') ||
        /亚朵|全季|桔子|麗枫|维也纳国际/.test(name)) {
      return 4;
    }
    
    if (name_lower.includes('三星级') || name_lower.includes('3星级') ||
        /如家|汉庭|锦江之星|7天|维也纳/.test(name)) {
      return 3;
    }
    
    return 3;
  }

  /**
   * 估算价格
   */
  estimatePrice(name) {
    const star = this.detectStarRating(name);
    if (star === 5) return 600 + Math.floor(Math.random() * 400);
    if (star === 4) return 300 + Math.floor(Math.random() * 200);
    return 150 + Math.floor(Math.random() * 150);
  }
}

module.exports = new HotelSearchService();
