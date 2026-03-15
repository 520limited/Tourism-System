const logger = require('../logger');

/**
 * 费用计算服务
 * 基于AI返回的真实价格数据计算，禁止固定价格表
 */
class CostCalculatorService {
  /**
   * 计算每日费用详情
   * 只使用传入的实际价格数据
   */
  calculateDailyCost(dayTrip, dayIndex, totalDays) {
    const costs = {
      attractions: this.calculateAttractionsCost(dayTrip.attractions),
      restaurants: this.calculateRestaurantsCost(dayTrip.restaurants),
      hotels: this.calculateHotelsCost(dayTrip.hotels, dayIndex, totalDays),
      transportation: this.calculateTransportationCost(dayTrip.transportation),
      snacks: 50, // 预估小吃费用
      other: 0
    };

    costs.subtotal = Object.values(costs).reduce((sum, cost) => sum + cost, 0);
    costs.emergencyFund = Math.round(costs.subtotal * 0.1);
    costs.total = costs.subtotal + costs.emergencyFund;

    return costs;
  }

  /**
   * 计算景点门票费用
   * 使用AI返回的真实价格
   */
  calculateAttractionsCost(attractions) {
    if (!attractions || attractions.length === 0) return 0;
    
    return attractions.reduce((total, attraction) => {
      const price = this.getAttractionTicketPrice(attraction);
      return total + price;
    }, 0);
  }

  /**
   * 获取景点门票价格
   * 优先使用AI返回的价格
   */
  getAttractionTicketPrice(attraction) {
    if (attraction?.ticketPrice !== undefined && attraction.ticketPrice !== null) {
      return parseFloat(attraction.ticketPrice) || 0;
    }
    
    if (attraction?.cost) {
      return parseFloat(attraction.cost) || 0;
    }

    return 0;
  }

  /**
   * 计算餐饮费用
   * 使用AI返回的真实价格
   */
  calculateRestaurantsCost(restaurants) {
    if (!restaurants || restaurants.length === 0) return 0;
    
    return restaurants.reduce((total, restaurant) => {
      const price = this.getRestaurantPrice(restaurant);
      return total + price;
    }, 0);
  }

  /**
   * 获取餐厅人均消费
   * 优先使用AI返回的价格
   */
  getRestaurantPrice(restaurant) {
    if (restaurant?.avgPrice !== undefined && restaurant.avgPrice !== null) {
      return parseFloat(restaurant.avgPrice) || 0;
    }
    
    if (restaurant?.cost) {
      return parseFloat(restaurant.cost) || 0;
    }

    return 0;
  }

  /**
   * 计算酒店费用
   * 使用AI返回的真实价格
   */
  calculateHotelsCost(hotels, dayIndex, totalDays) {
    if (!hotels || hotels.length === 0) return 0;
    
    if (dayIndex !== 0) return 0;

    const hotel = hotels[0];
    const pricePerNight = this.getHotelPrice(hotel);
    
    return pricePerNight * totalDays;
  }

  /**
   * 获取酒店价格
   * 优先使用AI返回的价格
   */
  getHotelPrice(hotel) {
    if (hotel?.pricePerNight !== undefined && hotel.pricePerNight !== null) {
      return parseFloat(hotel.pricePerNight) || 0;
    }
    
    if (hotel?.cost) {
      return parseFloat(hotel.cost) || 0;
    }

    return 0;
  }

  /**
   * 计算交通费用
   * 使用实际传入的交通费用
   */
  calculateTransportationCost(transportation) {
    if (!transportation || transportation.length === 0) {
      return 50;
    }

    return transportation.reduce((total, trans) => {
      return total + (trans.cost || 0);
    }, 0);
  }

  /**
   * 计算整个行程的总费用
   */
  calculateTotalCost(itinerary, requirements) {
    if (!itinerary || itinerary.length === 0) {
      return null;
    }

    const totalDays = itinerary.length;
    const dailyCosts = [];
    
    let totalAttractions = 0;
    let totalRestaurants = 0;
    let totalHotels = 0;
    let totalTransportation = 0;
    let totalSnacks = 0;
    let totalEmergency = 0;

    itinerary.forEach((day, index) => {
      const costs = this.calculateDailyCost(day, index, totalDays);
      dailyCosts.push(costs);

      totalAttractions += costs.attractions;
      totalRestaurants += costs.restaurants;
      totalHotels += costs.hotels;
      totalTransportation += costs.transportation;
      totalSnacks += costs.snacks;
      totalEmergency += costs.emergencyFund;
    });

    const grandTotal = totalAttractions + totalRestaurants + totalHotels + 
                       totalTransportation + totalSnacks + totalEmergency;

    return {
      dailyCosts,
      summary: {
        attractions: totalAttractions,
        restaurants: totalRestaurants,
        hotels: totalHotels,
        transportation: totalTransportation,
        snacks: totalSnacks,
        emergencyFund: totalEmergency,
        total: grandTotal,
        perPerson: Math.round(grandTotal / (requirements?.peopleCount || 2)),
        perDay: Math.round(grandTotal / totalDays)
      }
    };
  }

  /**
   * 生成费用明细报告
   */
  generateCostReport(costData) {
    if (!costData) return '暂无费用信息';

    const { summary } = costData;
    
    return {
      title: '行程费用明细',
      items: [
        { label: '景点门票', amount: summary.attractions, icon: '🎫' },
        { label: '餐饮费用', amount: summary.restaurants, icon: '🍽️' },
        { label: '住宿费用', amount: summary.hotels, icon: '🏨' },
        { label: '交通费用', amount: summary.transportation, icon: '🚇' },
        { label: '小吃零食', amount: summary.snacks, icon: '🍢' },
        { label: '应急备用', amount: summary.emergencyFund, icon: '💰' }
      ],
      total: summary.total,
      perPerson: summary.perPerson,
      perDay: summary.perDay
    };
  }
}

module.exports = new CostCalculatorService();
