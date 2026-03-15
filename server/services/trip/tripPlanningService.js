const axios = require('axios');
const amapService = require('../external/amapService');
const logger = require('../logger');

/**
 * 智能行程规划服务
 * 1. AI推荐景点、餐厅、酒店名称
 * 2. 高德地图API验证并获取真实数据
 * 3. 地域聚类分组
 * 4. 高德路线规划交通
 */
class TripPlanningService {
  constructor() {
    this.qwenApiKey = process.env.QWEN_API_KEY;
    this.qwenApiUrl = process.env.QWEN_API_URL || 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation';
  }

  /**
   * 生成行程规划
   */
  async generateItinerary(requirements) {
    const { days, crowd, budget, interests = [], foodPreferences = [], hotelArea = '' } = requirements;
    
    logger.info(`开始生成行程规划: ${days}天, ${crowd}, 预算${budget}`);

    // 1. AI推荐景点、餐厅、酒店名称
    const aiRecommendations = await this.getAIRecommendations(requirements);
    
    // 2. 用高德地图验证并获取真实数据
    const [attractions, restaurants, hotels] = await Promise.all([
      this.verifyAttractions(aiRecommendations.attractions),
      this.verifyRestaurants(aiRecommendations.restaurants),
      this.verifyHotels(aiRecommendations.hotels, hotelArea)
    ]);

    logger.info(`验证后的数据: 景点${attractions.length}个, 餐厅${restaurants.length}个, 酒店${hotels.length}个`);

    // 3. 地域聚类
    const clusters = this.clusterByLocation(attractions);
    
    // 4. 生成每日行程
    const itinerary = this.generateDailyItinerary(days, clusters, restaurants, hotels, requirements);

    // 5. 为每日行程添加交通信息
    await this.addTransportation(itinerary);

    return {
      attractions,
      restaurants,
      hotels,
      clusters,
      itinerary
    };
  }

  /**
   * AI推荐景点、餐厅、酒店名称
   */
  async getAIRecommendations(requirements) {
    const prompt = `你是长沙本地旅游专家，请根据用户需求推荐真实存在的长沙景点、餐厅、酒店。

用户需求：
- 出行天数：${requirements.days || 3}天
- 出行人群：${requirements.crowd}
- 预算范围：${requirements.budget}元
- 兴趣偏好：${requirements.interests?.join('、') || '无'}
- 美食偏好：${requirements.foodPreferences?.join('、') || '无'}
- 住宿区域：${requirements.hotelArea || '五一广场'}

请推荐以下内容（必须是真实存在的长沙地点）：

1. 景点（8-12个）：
   - 必须包含：橘子洲、岳麓山、湖南省博物馆
   - 其他推荐：太平老街、IFS国金中心、黄兴路步行街、岳麓书院、湖南大学、杜甫江阁、世界之窗、烈士公园等

2. 餐厅（8-12家）：
   - 湘菜：费大厨辣椒炒肉、一盏灯、炊烟小炒黄牛肉、文和友、火宫殿
   - 小吃：黑色经典臭豆腐、糖油粑粑、口味虾、米粉店
   - 其他：茶颜悦色、果呀呀等

3. 酒店（6-8家）：
   - 五一广场附近：如家、汉庭、全季、亚朵、希尔顿欢朋等
   - 根据预算推荐合适的酒店

请返回JSON格式：
{
  "attractions": ["橘子洲", "岳麓山", "湖南省博物馆", "太平老街", "IFS国金中心", "黄兴路步行街", "岳麓书院", "杜甫江阁"],
  "restaurants": ["费大厨辣椒炒肉", "一盏灯", "炊烟小炒黄牛肉", "文和友", "黑色经典臭豆腐", "茶颜悦色"],
  "hotels": ["长沙五一广场如家酒店", "长沙IFS国金中心全季酒店", "长沙黄兴路步行街亚朵酒店"]
}`;

    try {
      const response = await this.callQwenAPI([
        { role: 'system', content: '你是长沙本地旅游专家，只推荐真实存在的长沙地点。' },
        { role: 'user', content: prompt }
      ]);

      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const data = JSON.parse(jsonMatch[0]);
        return {
          attractions: data.attractions || [],
          restaurants: data.restaurants || [],
          hotels: data.hotels || []
        };
      }
    } catch (error) {
      logger.error(`AI推荐失败: ${error.message}`);
    }

    // 默认推荐
    return {
      attractions: ['橘子洲', '岳麓山', '湖南省博物馆', '太平老街', 'IFS国金中心', '黄兴路步行街', '岳麓书院', '杜甫江阁', '世界之窗', '烈士公园'],
      restaurants: ['费大厨辣椒炒肉', '一盏灯', '炊烟小炒黄牛肉', '文和友', '黑色经典臭豆腐', '茶颜悦色', '火宫殿', '口味虾'],
      hotels: ['长沙五一广场如家酒店', '长沙IFS国金中心全季酒店', '长沙黄兴路步行街亚朵酒店', '长沙希尔顿欢朋酒店']
    };
  }

  /**
   * 验证景点（高德地图）
   */
  async verifyAttractions(attractionNames) {
    const results = [];
    for (const name of attractionNames) {
      const pois = await amapService.searchAttractions([name]);
      if (pois.length > 0) {
        results.push({
          ...pois[0],
          order: results.length + 1,
          ticketPrice: this.estimateTicketPrice(pois[0].name),
          estimatedDuration: this.estimateDuration(pois[0].name),
          bestTime: this.suggestBestTime(pois[0].name)
        });
      }
      await this.delay(100);
    }
    return results;
  }

  /**
   * 验证餐厅（高德地图）
   */
  async verifyRestaurants(restaurantNames) {
    const results = [];
    for (const name of restaurantNames) {
      const pois = await amapService.searchRestaurants([name]);
      if (pois.length > 0) {
        results.push({
          ...pois[0],
          cuisine: this.detectCuisine(pois[0].name, pois[0].type),
          avgPrice: this.estimateRestaurantPrice(pois[0].name),
          specialty: this.getSpecialty(pois[0].name)
        });
      }
      await this.delay(100);
    }
    return results;
  }

  /**
   * 验证酒店（高德地图）
   */
  async verifyHotels(hotelNames, area = '') {
    const results = [];
    const searchNames = area ? hotelNames.map(name => `${area} ${name}`) : hotelNames;
    
    for (const name of searchNames) {
      const pois = await amapService.searchHotels([name]);
      if (pois.length > 0) {
        results.push({
          ...pois[0],
          starRating: this.detectStarRating(pois[0].name),
          pricePerNight: this.estimateHotelPrice(pois[0].name)
        });
      }
      await this.delay(100);
    }
    return results;
  }

  /**
   * 地域聚类 - 按地理位置分组
   */
  clusterByLocation(attractions) {
    // 定义长沙主要区域
    const regions = {
      '橘子洲-岳麓山': { center: { lat: 28.185, lng: 112.95 }, radius: 3000 },
      '五一广场-黄兴路': { center: { lat: 28.195, lng: 112.975 }, radius: 2000 },
      '太平老街-坡子街': { center: { lat: 28.19, lng: 112.97 }, radius: 1500 },
      '省博物馆-烈士公园': { center: { lat: 28.21, lng: 112.985 }, radius: 2000 },
      '世界之窗-广电': { center: { lat: 28.235, lng: 113.04 }, radius: 2500 }
    };

    const clusters = {};
    
    for (const [regionName, region] of Object.entries(regions)) {
      clusters[regionName] = attractions.filter(attr => {
        const distance = this.calculateDistance(
          attr.latitude, attr.longitude,
          region.center.lat, region.center.lng
        );
        return distance <= region.radius;
      });
    }

    // 未分组的景点
    const assignedAttractions = new Set(Object.values(clusters).flat().map(a => a.id));
    const unassigned = attractions.filter(attr => !assignedAttractions.has(attr.id));
    if (unassigned.length > 0) {
      clusters['其他区域'] = unassigned;
    }

    return clusters;
  }

  /**
   * 生成每日行程
   */
  generateDailyItinerary(days, clusters, restaurants, hotels, requirements) {
    const itinerary = [];
    const clusterNames = Object.keys(clusters).filter(name => clusters[name].length > 0);
    
    // 每天安排2-3个景点，按区域组合
    let attractionIndex = 0;
    const allAttractions = Object.values(clusters).flat();
    
    for (let day = 1; day <= days; day++) {
      const dayAttractions = allAttractions.slice(attractionIndex, attractionIndex + 3);
      attractionIndex += 3;

      // 为每天分配餐厅（2-3家）
      const dayRestaurants = restaurants.slice((day - 1) * 2, day * 2);

      // 为每天分配酒店（第1天分配，后续沿用）
      const dayHotels = day === 1 ? hotels.slice(0, 2) : [];

      itinerary.push({
        day,
        date: this.getDateString(day),
        title: `第${day}天：${dayAttractions[0]?.name || '长沙游览'}`,
        attractions: dayAttractions.map((attr, idx) => ({
          ...attr,
          order: idx + 1
        })),
        restaurants: dayRestaurants,
        hotels: dayHotels,
        dailyCost: this.calculateDailyCost(dayAttractions, dayRestaurants, dayHotels)
      });
    }

    return itinerary;
  }

  /**
   * 添加交通信息
   */
  async addTransportation(itinerary) {
    for (const day of itinerary) {
      if (day.attractions.length < 2) continue;

      const transportation = [];
      for (let i = 0; i < day.attractions.length - 1; i++) {
        const from = day.attractions[i];
        const to = day.attractions[i + 1];

        // 获取步行路线
        const walkingRoute = await amapService.getWalkingRoute(
          { lat: from.latitude, lng: from.longitude },
          { lat: to.latitude, lng: to.longitude }
        );

        if (walkingRoute) {
          transportation.push({
            from: from.name,
            to: to.name,
            mode: walkingRoute.distance < 1000 ? '步行' : '地铁/公交',
            distance: walkingRoute.distance,
            duration: walkingRoute.duration,
            cost: walkingRoute.distance < 1000 ? 0 : 4, // 步行免费，公交4元
            steps: walkingRoute.steps
          });
        }

        await this.delay(200);
      }

      day.transportation = transportation;
    }
  }

  /**
   * 计算两点距离（米）
   */
  calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371000; // 地球半径（米）
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * 估算门票价格
   */
  estimateTicketPrice(name) {
    const free = ['橘子洲', '太平老街', '黄兴路步行街', '湖南省博物馆', '烈士公园'];
    if (free.some(f => name.includes(f))) return 0;
    if (name.includes('岳麓书院')) return 40;
    if (name.includes('世界之窗')) return 200;
    if (name.includes('杜甫江阁')) return 11;
    return 0;
  }

  /**
   * 估算游览时长
   */
  estimateDuration(name) {
    if (name.includes('博物馆')) return 3;
    if (name.includes('岳麓山')) return 4;
    if (name.includes('橘子洲')) return 3;
    if (name.includes('世界之窗')) return 6;
    return 2;
  }

  /**
   * 建议最佳游览时间
   */
  suggestBestTime(name) {
    if (name.includes('岳麓山')) return '上午';
    if (name.includes('橘子洲')) return '傍晚';
    if (name.includes('博物馆')) return '下午';
    return '全天';
  }

  /**
   * 检测菜系
   */
  detectCuisine(name, type) {
    if (name.includes('湘') || type.includes('湘菜')) return '湘菜';
    if (name.includes('火锅')) return '火锅';
    if (name.includes('烧烤')) return '烧烤';
    if (name.includes('茶') || name.includes('奶茶')) return '饮品';
    if (name.includes('臭豆腐') || name.includes('小吃')) return '小吃';
    return '湘菜';
  }

  /**
   * 估算餐厅价格
   */
  estimateRestaurantPrice(name) {
    if (name.includes('文和友')) return 120;
    if (name.includes('费大厨') || name.includes('炊烟') || name.includes('一盏灯')) return 80;
    if (name.includes('茶颜悦色') || name.includes('果呀呀')) return 20;
    if (name.includes('臭豆腐') || name.includes('小吃')) return 15;
    return 60;
  }

  /**
   * 获取招牌菜
   */
  getSpecialty(name) {
    const specialties = {
      '费大厨': '辣椒炒肉',
      '炊烟': '小炒黄牛肉',
      '一盏灯': '鸭掌筋',
      '文和友': '口味虾',
      '火宫殿': '臭豆腐',
      '茶颜悦色': '幽兰拿铁'
    };
    for (const [key, value] of Object.entries(specialties)) {
      if (name.includes(key)) return value;
    }
    return '';
  }

  /**
   * 检测酒店星级
   */
  detectStarRating(name) {
    if (name.includes('希尔顿') || name.includes('万豪') || name.includes('洲际')) return 5;
    if (name.includes('亚朵') || name.includes('全季') || name.includes('桔子')) return 4;
    if (name.includes('如家') || name.includes('汉庭') || name.includes('7天')) return 3;
    return 3;
  }

  /**
   * 估算酒店价格
   */
  estimateHotelPrice(name) {
    const star = this.detectStarRating(name);
    if (star === 5) return 600;
    if (star === 4) return 350;
    return 200;
  }

  /**
   * 计算每日花费
   */
  calculateDailyCost(attractions, restaurants, hotels) {
    const attractionsCost = attractions.reduce((sum, a) => sum + (a.ticketPrice || 0), 0);
    const foodCost = restaurants.reduce((sum, r) => sum + (r.avgPrice || 0), 0);
    const hotelCost = hotels.length > 0 ? (hotels[0].pricePerNight || 0) : 0;
    
    return {
      attractions: attractionsCost,
      food: foodCost,
      transportation: 20,
      accommodation: hotelCost,
      total: attractionsCost + foodCost + 20 + hotelCost
    };
  }

  /**
   * 获取日期字符串
   */
  getDateString(dayOffset) {
    const date = new Date();
    date.setDate(date.getDate() + dayOffset);
    return date.toISOString().split('T')[0];
  }

  /**
   * 调用千问API
   */
  async callQwenAPI(messages) {
    const payload = {
      model: 'qwen-turbo',
      input: { messages },
      parameters: {
        result_format: 'message',
        temperature: 0.7,
        max_tokens: 2000
      }
    };

    const response = await axios.post(
      this.qwenApiUrl,
      payload,
      {
        headers: {
          'Authorization': `Bearer ${this.qwenApiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    if (response.data?.output?.choices?.[0]?.message?.content) {
      return response.data.output.choices[0].message.content;
    }
    throw new Error('AI API响应格式异常');
  }

  /**
   * 获取新的景点（换一批）
   */
  async getNewAttractions(requirements, usedNames = []) {
    const prompt = `你是长沙本地旅游专家，请推荐新的长沙景点（排除已推荐的）。

已推荐的景点：${usedNames.join('、')}

请推荐3-5个新的长沙景点（必须是真实存在的），返回JSON格式：
{
  "attractions": ["景点1", "景点2", "景点3"]
}`;

    try {
      const response = await this.callQwenAPI([
        { role: 'system', content: '你是长沙本地旅游专家，只推荐真实存在的长沙景点。' },
        { role: 'user', content: prompt }
      ]);

      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const data = JSON.parse(jsonMatch[0]);
        return data.attractions || [];
      }
    } catch (error) {
      logger.error(`获取新景点失败: ${error.message}`);
    }

    // 备用推荐
    const allAttractions = [
      '天心阁', '贾谊故居', '简牍博物馆', '白沙古井', '开福寺',
      '梅溪湖', '洋湖湿地公园', '石燕湖', '大围山', '沩山',
      '靖港古镇', '铜官窑古镇', '关山古镇', '道林古镇'
    ];
    return allAttractions.filter(name => !usedNames.includes(name)).slice(0, 3);
  }

  /**
   * 获取新的餐厅（换一批）
   */
  async getNewRestaurants(requirements, usedNames = []) {
    const prompt = `你是长沙本地美食专家，请推荐新的长沙餐厅（排除已推荐的）。

已推荐的餐厅：${usedNames.join('、')}

请推荐3-5个新的长沙餐厅（必须是真实存在的），返回JSON格式：
{
  "restaurants": ["餐厅1", "餐厅2", "餐厅3"]
}`;

    try {
      const response = await this.callQwenAPI([
        { role: 'system', content: '你是长沙本地美食专家，只推荐真实存在的长沙餐厅。' },
        { role: 'user', content: prompt }
      ]);

      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const data = JSON.parse(jsonMatch[0]);
        return data.restaurants || [];
      }
    } catch (error) {
      logger.error(`获取新餐厅失败: ${error.message}`);
    }

    // 备用推荐
    const allRestaurants = [
      '费大厨辣椒炒肉', '一盏灯', '炊烟小炒黄牛肉', '文和友', '火宫殿',
      '黑色经典臭豆腐', '茶颜悦色', '果呀呀', '墨茉点心局', '虎头局',
      '天宝兄弟', '虾小龙', '盟重烧烤', '冬瓜山香肠', '金记糖油佗佗'
    ];
    return allRestaurants.filter(name => !usedNames.includes(name)).slice(0, 3);
  }

  /**
   * 获取新的酒店（换一批）
   */
  async getNewHotels(requirements, usedNames = []) {
    const area = requirements.hotelArea || '五一广场';
    const prompt = `你是长沙本地酒店专家，请推荐新的长沙酒店（排除已推荐的）。

住宿区域：${area}
已推荐的酒店：${usedNames.join('、')}

请推荐3-5个新的长沙酒店（必须是真实存在的），返回JSON格式：
{
  "hotels": ["酒店1", "酒店2", "酒店3"]
}`;

    try {
      const response = await this.callQwenAPI([
        { role: 'system', content: '你是长沙本地酒店专家，只推荐真实存在的长沙酒店。' },
        { role: 'user', content: prompt }
      ]);

      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const data = JSON.parse(jsonMatch[0]);
        return data.hotels || [];
      }
    } catch (error) {
      logger.error(`获取新酒店失败: ${error.message}`);
    }

    // 备用推荐
    const allHotels = [
      `长沙${area}如家酒店`, `长沙${area}汉庭酒店`, `长沙${area}全季酒店`,
      `长沙${area}亚朵酒店`, `长沙${area}桔子酒店`, `长沙${area}希尔顿欢朋酒店`,
      `长沙${area}维也纳酒店`, `长沙${area}7天酒店`, `长沙${area}锦江之星`
    ];
    return allHotels.filter(name => !usedNames.includes(name)).slice(0, 3);
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = new TripPlanningService();
