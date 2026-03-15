const axios = require('axios');
const logger = require('../logger');
const aiPromptGenerator = require('../ai/aiPromptGenerator');

class RateLimiter {
  constructor(maxRequestsPerSecond = 8, minInterval = 150) {
    this.maxRequestsPerSecond = maxRequestsPerSecond;
    this.minInterval = minInterval;
    this.queue = [];
    this.isProcessing = false;
    this.lastRequestTime = 0;
    this.requestCount = 0;
    this.windowStart = Date.now();
  }

  async enqueue(fn) {
    return new Promise((resolve, reject) => {
      this.queue.push({ fn, resolve, reject });
      this.processQueue();
    });
  }

  async processQueue() {
    if (this.isProcessing || this.queue.length === 0) return;
    
    this.isProcessing = true;
    
    while (this.queue.length > 0) {
      const now = Date.now();
      
      if (now - this.windowStart > 1000) {
        this.requestCount = 0;
        this.windowStart = now;
      }
      
      if (this.requestCount >= this.maxRequestsPerSecond) {
        const waitTime = 1000 - (now - this.windowStart) + 50;
        await this.delay(waitTime);
        this.requestCount = 0;
        this.windowStart = Date.now();
      }
      
      const timeSinceLastRequest = now - this.lastRequestTime;
      if (timeSinceLastRequest < this.minInterval) {
        await this.delay(this.minInterval - timeSinceLastRequest);
      }
      
      const { fn, resolve, reject } = this.queue.shift();
      this.lastRequestTime = Date.now();
      this.requestCount++;
      
      try {
        const result = await fn();
        resolve(result);
      } catch (error) {
        reject(error);
      }
    }
    
    this.isProcessing = false;
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

class WebSearchService {
  constructor() {
    this.amapKey = process.env.AMAP_KEY;
    this.amapBaseUrl = 'https://restapi.amap.com/v3';
    this.rateLimiter = new RateLimiter(8, 150);
    this.qwenApiKey = process.env.QWEN_API_KEY;
    this.qwenApiUrl = process.env.QWEN_API_URL || 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation';
  }

  async searchAll(keywords, requirements = {}) {
    logger.info(`开始全网搜索，关键词：${JSON.stringify(keywords)}`);
    const city = requirements.city || '长沙';

    const results = {
      attractions: [],
      restaurants: [],
      snacks: [],
      drinks: [],
      hotels: [],
      guides: [],
      weather: null,
      specialEvents: null,
      checkInPoints: [],
      timestamp: new Date(),
      errors: []
    };

    // 检查是否使用AI模式
    const useAI = requirements.useAI || false;

    if (useAI) {
      logger.info('使用AI模式生成推荐数据');
      try {
        const aiResults = await this.generateAIRecommendations(requirements);
        results.attractions = aiResults.attractions || [];
        results.restaurants = aiResults.restaurants || [];
        results.snacks = aiResults.snacks || [];
        results.drinks = aiResults.drinks || [];
        results.hotels = aiResults.hotels || [];
        results.checkInPoints = aiResults.checkInPoints || [];
        logger.info(`AI生成推荐完成：景点${results.attractions.length}个，餐厅${results.restaurants.length}个，小吃${results.snacks.length}个，酒饮${results.drinks.length}个，酒店${results.hotels.length}个，打卡点${results.checkInPoints.length}个`);
      } catch (error) {
        logger.error(`AI生成推荐失败：${error.message}`);
        results.errors.push(`AI推荐：${error.message}`);
      }
    } else {
      // 传统POI搜索模式
      const searchPromises = [];

      if (keywords.attractions && keywords.attractions.length > 0) {
        searchPromises.push(
          this.searchAttractions(keywords.attractions, city)
            .then(data => { results.attractions = data; })
            .catch(err => { 
              logger.error(`景点搜索失败：${err.message}`);
              results.errors.push(`景点搜索：${err.message}`);
            })
        );
      }

      if (keywords.restaurants && keywords.restaurants.length > 0) {
        searchPromises.push(
          this.searchRestaurants(keywords.restaurants, city)
            .then(data => { results.restaurants = data; })
            .catch(err => { 
              logger.error(`餐厅搜索失败：${err.message}`);
              results.errors.push(`餐厅搜索：${err.message}`);
            })
        );
      }

      if (keywords.snacks && keywords.snacks.length > 0) {
        searchPromises.push(
          this.searchSnacks(keywords.snacks, city)
            .then(data => { results.snacks = data; })
            .catch(err => { 
              logger.error(`小吃搜索失败：${err.message}`);
              results.errors.push(`小吃搜索：${err.message}`);
            })
        );
      }

      if (keywords.drinks && keywords.drinks.length > 0) {
        searchPromises.push(
          this.searchDrinks(keywords.drinks, city)
            .then(data => { results.drinks = data; })
            .catch(err => { 
              logger.error(`酒饮搜索失败：${err.message}`);
              results.errors.push(`酒饮搜索：${err.message}`);
            })
        );
      }

      if (keywords.hotels && keywords.hotels.length > 0) {
        searchPromises.push(
          this.searchHotels(keywords.hotels, city)
            .then(data => { results.hotels = data; })
            .catch(err => { 
              logger.error(`酒店搜索失败：${err.message}`);
              results.errors.push(`酒店搜索：${err.message}`);
            })
        );
      }

      if (keywords.checkInPoints && keywords.checkInPoints.length > 0) {
        searchPromises.push(
          this.searchCheckInPoints(keywords.checkInPoints, city)
            .then(data => { results.checkInPoints = data; })
            .catch(err => { 
              logger.error(`打卡点搜索失败：${err.message}`);
              results.errors.push(`打卡点搜索：${err.message}`);
            })
        );
      }

      await Promise.allSettled(searchPromises);
    }

    // 无论是否使用AI模式，都获取天气和攻略信息
    const additionalPromises = [];

    additionalPromises.push(
      this.getWeather(city)
        .then(data => { results.weather = data; })
        .catch(err => { 
          logger.error(`天气获取失败：${err.message}`);
          results.errors.push(`天气获取：${err.message}`);
        })
    );

    const guideQueries = this.buildGuideQueries(keywords, requirements);
    if (guideQueries.length > 0) {
      additionalPromises.push(
        this.searchGuides(guideQueries)
          .then(data => { 
            results.guides = data;
            results.specialEvents = this.parseSpecialEvents(data, requirements);
          })
          .catch(err => { 
            logger.error(`攻略搜索失败：${err.message}`);
            results.errors.push(`攻略搜索：${err.message}`);
          })
      );
    }

    await Promise.allSettled(additionalPromises);

    const totalResults = results.attractions.length + results.restaurants.length + results.snacks.length + results.drinks.length + results.hotels.length + results.checkInPoints.length;
    logger.info(`搜索完成：景点${results.attractions.length}个，餐厅${results.restaurants.length}个，小吃${results.snacks.length}个，酒饮${results.drinks.length}个，酒店${results.hotels.length}个，打卡点${results.checkInPoints.length}个，攻略${results.guides.length}条`);

    if (totalResults === 0 && results.guides.length === 0) {
      throw new Error('所有数据源均获取失败，请检查网络连接和API配置');
    }

    return results;
  }

  async searchSnacks(keywords, city) {
    const results = [];
    const typeCode = '050400';

    for (const keyword of keywords.slice(0, 8)) {
      try {
        logger.info(`搜索小吃: ${keyword}`);
        const pois = await this.rateLimiter.enqueue(() => 
          this.searchPOI(keyword, city, typeCode)
        );
        
        for (const poi of pois) {
          if (this.isSnack(poi)) {
            results.push(this.parseSnack(poi));
          }
        }
      } catch (e) {
        logger.error(`小吃搜索失败 [${keyword}]: ${e.message}`);
      }
    }

    return this.deduplicatePOIs(results);
  }

  async searchDrinks(keywords, city) {
    const results = [];
    const typeCode = '050400';

    for (const keyword of keywords.slice(0, 8)) {
      try {
        logger.info(`搜索酒饮: ${keyword}`);
        const pois = await this.rateLimiter.enqueue(() => 
          this.searchPOI(keyword, city, typeCode)
        );
        
        for (const poi of pois) {
          if (this.isDrink(poi)) {
            results.push(this.parseDrink(poi));
          }
        }
      } catch (e) {
        logger.error(`酒饮搜索失败 [${keyword}]: ${e.message}`);
      }
    }

    return this.deduplicatePOIs(results);
  }

  async searchCheckInPoints(keywords, city) {
    const results = [];
    const typeCodes = ['110000', '110100', '110200', '110300', '110400', '110500', '050000'];

    for (const keyword of keywords.slice(0, 8)) {
      try {
        logger.info(`搜索打卡点: ${keyword}`);
        const pois = await this.rateLimiter.enqueue(() => 
          this.searchPOI(keyword, city, typeCodes.join('|'))
        );
        
        for (const poi of pois) {
          if (this.isValidAttraction(poi)) {
            results.push(this.parseCheckInPoint(poi));
          }
        }
      } catch (e) {
        logger.error(`打卡点搜索失败 [${keyword}]: ${e.message}`);
      }
    }

    return this.deduplicatePOIs(results);
  }

  isSnack(poi) {
    const name = String(poi.name || '').toLowerCase();
    const type = String(poi.type || '').toLowerCase();
    const allText = `${name} ${type}`;
    
    const snackKeywords = [
      '小吃', '臭豆腐', '糖油粑粑', '米粉', '酸辣粉', '凉皮', '凉面',
      '烧烤', '串串', '炸串', '煎饼', '锅贴', '煎饺', '包子', '馒头',
      '混沌', '汤圆', '粽子', '糍粑', '年糕', '麻圆', '油条', '豆浆',
      '卤味', '鸭脖', '鸭爪', '鸡翅', '鸡爪', '卤菜', '泡菜', '腌菜',
      '果脯', '蜜饯', '糖果', '糕点', '饼干', '蛋糕', '面包', '甜点'
    ];
    
    return snackKeywords.some(kw => allText.includes(kw));
  }

  isDrink(poi) {
    const name = String(poi.name || '').toLowerCase();
    const type = String(poi.type || '').toLowerCase();
    const allText = `${name} ${type}`;
    
    const drinkKeywords = [
      '奶茶', '茶饮', '果茶', '咖啡', '甜品', '蛋糕', '冰淇淋',
      '茶楼', '茶馆', '茶室', '饮品', '果汁', '冷饮', '酒吧',
      '清吧', '酒馆', '酒窖', '啤酒', '红酒', '白酒', '洋酒'
    ];
    
    return drinkKeywords.some(kw => allText.includes(kw));
  }

  parseSnack(poi) {
    const location = poi.location ? poi.location.split(',') : ['0', '0'];
    
    return {
      id: poi.id,
      name: poi.name,
      address: poi.address || '',
      latitude: parseFloat(location[1]) || 0,
      longitude: parseFloat(location[0]) || 0,
      type: poi.type || '',
      tel: poi.tel || '',
      rating: poi.biz_ext?.rating ? parseFloat(poi.biz_ext.rating) : (poi.rating ? parseFloat(poi.rating) : null),
      avgPrice: poi.biz_ext?.cost || poi.cost || null,
      photos: (poi.photos || []).map(p => typeof p === 'string' ? p : (p.url || '')),
      businessArea: poi.business_area || '',
      description: poi.biz_ext?.comment || '',
      source: 'amap',
      timestamp: new Date()
    };
  }

  parseDrink(poi) {
    const location = poi.location ? poi.location.split(',') : ['0', '0'];
    
    return {
      id: poi.id,
      name: poi.name,
      address: poi.address || '',
      latitude: parseFloat(location[1]) || 0,
      longitude: parseFloat(location[0]) || 0,
      type: poi.type || '',
      tel: poi.tel || '',
      rating: poi.biz_ext?.rating ? parseFloat(poi.biz_ext.rating) : (poi.rating ? parseFloat(poi.rating) : null),
      avgPrice: poi.biz_ext?.cost || poi.cost || null,
      photos: (poi.photos || []).map(p => typeof p === 'string' ? p : (p.url || '')),
      businessArea: poi.business_area || '',
      description: poi.biz_ext?.comment || '',
      source: 'amap',
      timestamp: new Date()
    };
  }

  parseCheckInPoint(poi) {
    const location = poi.location ? poi.location.split(',') : ['0', '0'];
    
    return {
      id: poi.id,
      name: poi.name,
      address: poi.address || '',
      latitude: parseFloat(location[1]) || 0,
      longitude: parseFloat(location[0]) || 0,
      type: poi.type || '',
      typecode: poi.typecode || '',
      tel: poi.tel || '',
      rating: poi.biz_ext?.rating ? parseFloat(poi.biz_ext.rating) : (poi.rating ? parseFloat(poi.rating) : null),
      cost: poi.biz_ext?.cost || poi.cost || null,
      photos: (poi.photos || []).map(p => typeof p === 'string' ? p : (p.url || '')),
      businessArea: poi.business_area || '',
      openingHours: poi.biz_ext?.opening_hours || '',
      description: poi.biz_ext?.comment || '',
      popularity: this.calculatePopularity(poi),
      source: 'amap',
      timestamp: new Date()
    };
  }

  buildGuideQueries(keywords, requirements) {
    const queries = [];
    const city = requirements.city || '长沙';
    
    queries.push(`${city}旅游攻略 ${new Date().getFullYear()}`);
    queries.push(`${city}交通出行指南`);
    queries.push(`${city}美食推荐`);
    
    if (requirements.interests?.includes('夜生活') || requirements.constraints?.includes('夜景/烟花')) {
      queries.push(`${city}橘子洲烟花时间 ${new Date().getFullYear()}`);
    }
    
    if (requirements.crowd === '情侣') {
      queries.push(`${city}情侣约会攻略`);
    } else if (requirements.crowd === '亲子') {
      queries.push(`${city}亲子游攻略`);
    }
    
    return [...new Set(queries)].slice(0, 5);
  }

  async searchAttractions(keywords, city) {
    const results = [];
    const typeCodes = ['110000', '110100', '110200', '110300', '110400', '110500'];

    for (const keyword of keywords.slice(0, 8)) {
      try {
        logger.info(`搜索景点: ${keyword}`);
        const pois = await this.rateLimiter.enqueue(() => 
          this.searchPOI(keyword, city, typeCodes.join('|'))
        );
        
        for (const poi of pois) {
          if (this.isValidAttraction(poi)) {
            results.push(this.parseAttraction(poi));
          }
        }
      } catch (e) {
        logger.error(`景点搜索失败 [${keyword}]: ${e.message}`);
      }
    }

    return this.deduplicatePOIs(results);
  }

  async searchRestaurants(keywords, city) {
    const results = [];
    const typeCode = '050400';

    for (const keyword of keywords.slice(0, 8)) {
      try {
        logger.info(`搜索餐厅: ${keyword}`);
        const pois = await this.rateLimiter.enqueue(() => 
          this.searchPOI(keyword, city, typeCode)
        );
        
        for (const poi of pois) {
          if (this.isRealRestaurant(poi)) {
            results.push(this.parseRestaurant(poi));
          }
        }
      } catch (e) {
        logger.error(`餐厅搜索失败 [${keyword}]: ${e.message}`);
      }
    }

    return this.deduplicatePOIs(results);
  }

  async searchHotels(keywords, city) {
    const results = [];
    const typeCode = '100100';

    for (const keyword of keywords.slice(0, 5)) {
      try {
        logger.info(`搜索酒店: ${keyword}`);
        const pois = await this.rateLimiter.enqueue(() => 
          this.searchPOI(keyword, city, typeCode)
        );
        
        for (const poi of pois) {
          results.push(this.parseHotel(poi));
        }
      } catch (e) {
        logger.error(`酒店搜索失败 [${keyword}]: ${e.message}`);
      }
    }

    return this.deduplicatePOIs(results);
  }

  isValidAttraction(poi) {
    if (!poi.name || poi.name.length < 2) return false;
    
    const invalidKeywords = ['售票处', '停车场', '厕所', '入口', '出口', '服务区', '加油站'];
    const name = poi.name.toLowerCase();
    
    return !invalidKeywords.some(kw => name.includes(kw));
  }

  isRealRestaurant(poi) {
    const name = String(poi.name || '').toLowerCase();
    const type = String(poi.type || '').toLowerCase();
    const allText = `${name} ${type}`;
    
    const drinkKeywords = [
      '奶茶', '茶饮', '果茶', '咖啡', '甜品', '蛋糕', '冰淇淋',
      '茶楼', '茶馆', '茶室', '饮品', '果汁', '冷饮',
      '下午茶', '烘焙', '面包', '甜点', '糖水',
      '小杯茶', '人文茶馆', '茶花荟', '美人兮', '整椰椰',
      '良果芭', '茶咖', '茶坊', '果物', '椰椰', '冰淇淋',
      '糖水铺', '墨蘭', '三味至家'
    ];
    
    const mealKeywords = [
      '餐厅', '饭店', '酒楼', '菜馆', '食府', '大排档',
      '火锅', '烧烤', '湘菜', '川菜', '粤菜', '鲁菜',
      '口味虾', '臭豆腐', '小龙虾', '米粉', '面条',
      '家常菜', '土菜', '私房菜', '特色菜', '正餐',
      '酒家', '食街', '美食城'
    ];
    
    const isDrink = drinkKeywords.some(kw => allText.includes(kw));
    const isMeal = mealKeywords.some(kw => allText.includes(kw));
    
    if (isDrink && !isMeal) {
      logger.debug(`过滤茶饮店: ${poi.name}`);
      return false;
    }
    
    return true;
  }

  async searchPOI(keyword, city, types) {
    const maxRetries = 3;
    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await axios.get(
          `${this.amapBaseUrl}/place/text`,
          {
            params: {
              key: this.amapKey,
              keywords: keyword,
              city: city,
              citylimit: true,
              types: types,
              offset: 25,
              page: 1,
              extensions: 'all'
            },
            timeout: 15000
          }
        );

        if (response.data.status === '1' && response.data.pois) {
          logger.info(`POI搜索成功 [${keyword}]，获取 ${response.data.pois.length} 条结果`);
          return response.data.pois;
        }

        if (response.data.info && response.data.info.includes('CUQPS')) {
          throw new Error(`API限流，等待重试`);
        }

        return [];
      } catch (error) {
        lastError = error;
        logger.warn(`POI搜索失败 [${keyword}] 第${attempt}次尝试：${error.message}`);
        if (attempt < maxRetries) {
          await this.delay(1500 * attempt);
        }
      }
    }

    throw lastError || new Error('POI搜索失败');
  }

  parseAttraction(poi) {
    const location = poi.location ? poi.location.split(',') : ['0', '0'];
    
    return {
      id: poi.id,
      name: poi.name,
      address: poi.address || '',
      latitude: parseFloat(location[1]) || 0,
      longitude: parseFloat(location[0]) || 0,
      type: poi.type || '',
      typecode: poi.typecode || '',
      tel: poi.tel || '',
      rating: poi.biz_ext?.rating ? parseFloat(poi.biz_ext.rating) : (poi.rating ? parseFloat(poi.rating) : null),
      cost: poi.biz_ext?.cost || poi.cost || null,
      photos: (poi.photos || []).map(p => typeof p === 'string' ? p : (p.url || '')),
      businessArea: poi.business_area || '',
      openingHours: poi.biz_ext?.opening_hours || '',
      description: poi.biz_ext?.comment || '',
      popularity: this.calculatePopularity(poi),
      source: 'amap',
      timestamp: new Date()
    };
  }

  parseRestaurant(poi) {
    const location = poi.location ? poi.location.split(',') : ['0', '0'];
    
    return {
      id: poi.id,
      name: poi.name,
      address: poi.address || '',
      latitude: parseFloat(location[1]) || 0,
      longitude: parseFloat(location[0]) || 0,
      type: poi.type || '',
      tel: poi.tel || '',
      rating: poi.biz_ext?.rating ? parseFloat(poi.biz_ext.rating) : (poi.rating ? parseFloat(poi.rating) : null),
      avgPrice: poi.biz_ext?.cost || poi.cost || null,
      photos: (poi.photos || []).map(p => typeof p === 'string' ? p : (p.url || '')),
      businessArea: poi.business_area || '',
      cuisine: this.extractCuisine(poi),
      source: 'amap',
      timestamp: new Date()
    };
  }

  parseHotel(poi) {
    const location = poi.location ? poi.location.split(',') : ['0', '0'];
    
    return {
      id: poi.id,
      name: poi.name,
      address: poi.address || '',
      latitude: parseFloat(location[1]) || 0,
      longitude: parseFloat(location[0]) || 0,
      type: poi.type || '',
      tel: poi.tel || '',
      rating: poi.biz_ext?.rating ? parseFloat(poi.biz_ext.rating) : (poi.rating ? parseFloat(poi.rating) : null),
      pricePerNight: poi.biz_ext?.cost || poi.cost || null,
      photos: (poi.photos || []).map(p => typeof p === 'string' ? p : (p.url || '')),
      businessArea: poi.business_area || '',
      starRating: this.extractStarRating(poi),
      amenities: this.extractAmenities(poi),
      source: 'amap',
      timestamp: new Date()
    };
  }

  extractCuisine(poi) {
    const type = poi.type || '';
    const name = poi.name || '';
    
    if (type.includes('湘菜') || name.includes('湘')) return '湘菜';
    if (type.includes('川菜') || name.includes('川')) return '川菜';
    if (type.includes('火锅') || name.includes('火锅')) return '火锅';
    if (type.includes('烧烤') || name.includes('烧烤')) return '烧烤';
    if (type.includes('海鲜') || name.includes('海鲜')) return '海鲜';
    if (type.includes('小龙虾') || name.includes('口味虾')) return '小龙虾';
    
    return '湘菜';
  }

  extractStarRating(poi) {
    const type = poi.type || '';
    const name = poi.name || '';
    
    if (type.includes('五星级') || name.includes('五星级') || name.includes('豪华')) return 5;
    if (type.includes('四星级') || name.includes('四星级') || name.includes('高档')) return 4;
    if (type.includes('三星级') || name.includes('三星级') || name.includes('舒适')) return 3;
    if (type.includes('经济') || name.includes('快捷')) return 2;
    return 0;
  }

  extractAmenities(poi) {
    const amenities = [];
    const type = poi.type || '';
    const name = poi.name || '';
    
    if (type.includes('温泉') || name.includes('温泉')) amenities.push('温泉');
    if (type.includes('度假') || name.includes('度假')) amenities.push('度假设施');
    if (type.includes('商务') || name.includes('商务')) amenities.push('商务中心');
    if (name.includes('亲子') || name.includes('家庭')) amenities.push('亲子设施');
    if (name.includes('情侣') || name.includes('主题')) amenities.push('主题房');
    
    return amenities;
  }

  calculatePopularity(poi) {
    let score = 50;
    
    if (poi.rating) {
      score += (parseFloat(poi.rating) - 3) * 20;
    }
    
    const popularKeywords = ['橘子洲', '岳麓山', '博物馆', '太平街', '五一广场', 'IFS', '岳麓书院'];
    if (popularKeywords.some(kw => poi.name?.includes(kw))) {
      score += 30;
    }
    
    return Math.min(100, Math.max(0, score));
  }

  async searchGuides(queries) {
    const results = [];
    
    for (const query of queries.slice(0, 5)) {
      try {
        logger.info(`搜索攻略: ${query}`);
        const searchResults = await this.crawlSearchEngine(query);
        results.push(...searchResults);
      } catch (err) {
        logger.error(`攻略搜索失败 [${query}]: ${err.message}`);
      }
    }
    
    return this.deduplicateGuides(results);
  }

  async crawlSearchEngine(query) {
    const encodedQuery = encodeURIComponent(query);
    const results = [];
    
    try {
      const response = await axios.get(`https://www.bing.com/search?q=${encodedQuery}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
        },
        timeout: 20000
      });

      const html = response.data;
      const allLinks = html.matchAll(/<a[^>]*href="(https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi);
      const seenUrls = new Set();
      
      for (const match of allLinks) {
        const url = match[1];
        const anchorContent = match[2];
        
        if (seenUrls.has(url)) continue;
        if (url.includes('bing.com') || url.includes('microsoft.com') || url.includes('go.microsoft.com')) continue;
        
        let title = this.stripHtmlTags(anchorContent).trim();
        title = title.replace(/^https?:\/\/[^\s]+/i, '').trim();
        title = title.replace(/^[a-z0-9\-]+\.[a-z]+(\s*›\s*)?/i, '').trim();
        
        if (title.length < 5 || title.length > 200) continue;
        if (title.includes('搜索') && title.length < 20) continue;
        
        seenUrls.add(url);
        
        results.push({
          title: title,
          snippet: '',
          url: url,
          query: query,
          source: 'web'
        });
        
        if (results.length >= 15) break;
      }
      
      const pMatches = html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi);
      const snippets = [];
      
      for (const match of pMatches) {
        const text = this.stripHtmlTags(match[1]).trim();
        if (text.length > 30 && text.length < 500) {
          snippets.push(text);
        }
        if (snippets.length >= 15) break;
      }
      
      for (let i = 0; i < results.length && i < snippets.length; i++) {
        if (!results[i].snippet) {
          results[i].snippet = snippets[i];
        }
      }
      
      logger.info(`攻略搜索获取 ${results.length} 条结果`);
      
    } catch (error) {
      logger.error(`爬虫搜索异常: ${error.message}`);
      return this.getFallbackGuides(query);
    }
    
    return results;
  }

  getFallbackGuides(query) {
    const results = [];
    
    if (query.includes('烟花') || query.includes('橘子洲')) {
      results.push({
        title: '橘子洲烟花表演时间安排',
        snippet: '橘子洲烟花通常在5月至10月的周六晚上20:30举行，节假日可能有加场。建议提前关注官方公告确认具体时间。',
        url: 'https://www.hunan.gov.cn',
        query: query,
        source: 'web'
      });
    }
    
    if (query.includes('攻略') || query.includes('旅游')) {
      results.push({
        title: '长沙旅游攻略指南',
        snippet: '长沙是一座充满活力的城市，有橘子洲、岳麓山、太平老街等著名景点，美食以湘菜和小吃闻名。',
        url: 'https://www.mafengwo.cn',
        query: query,
        source: 'web'
      });
    }
    
    return results;
  }

  deduplicateGuides(guides) {
    const seen = new Map();
    const unique = [];
    
    for (const guide of guides) {
      const key = guide.title.toLowerCase().replace(/\s+/g, '');
      if (!seen.has(key)) {
        seen.set(key, true);
        unique.push(guide);
      }
    }
    
    return unique;
  }

  parseSpecialEvents(guides, requirements) {
    const events = {
      fireworks: null,
      others: []
    };
    
    for (const guide of guides) {
      const content = (guide.title + ' ' + (guide.snippet || '')).toLowerCase();
      
      if (content.includes('烟花') || content.includes('焰火')) {
        events.fireworks = {
          found: true,
          source: guide.url,
          title: guide.title,
          summary: guide.snippet,
          recommendation: this.generateFireworkRecommendation(guide)
        };
      } else if (guide.query?.includes('攻略') || guide.query?.includes('交通')) {
        events.others.push({
          title: guide.title,
          summary: guide.snippet,
          url: guide.url
        });
      }
    }
    
    return events;
  }

  generateFireworkRecommendation(searchResult) {
    const content = (searchResult.title + ' ' + (searchResult.snippet || '')).toLowerCase();
    
    if (content.includes('周六') || content.includes('周末')) {
      return '建议周六晚上安排橘子洲周边行程，可在湘江步道或杜甫江阁观赏烟花';
    } else if (content.includes('节假日') || content.includes('节日')) {
      return '节假日有烟花表演，建议提前关注官方公告，安排相应行程';
    } else if (content.includes('取消') || content.includes('暂停')) {
      return '当前烟花表演可能暂停，建议出行前确认最新信息';
    }
    
    return '建议出行前通过官方渠道确认烟花表演时间，安排橘子洲周边夜游行程';
  }

  stripHtmlTags(html) {
    if (!html) return '';
    return html
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&ensp;/g, ' ')
      .replace(/&#0183;/g, '·')
      .replace(/\s+/g, ' ')
      .trim();
  }

  async getWeather(city = '长沙') {
    if (!this.amapKey) {
      logger.warn('高德地图API密钥未配置');
      return this.getWeatherUnavailable('API密钥未配置');
    }

    const cityCode = '430100';
    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const [nowResponse, forecastResponse] = await Promise.all([
          axios.get(`${this.amapBaseUrl}/weather/weatherInfo`, {
            params: { key: this.amapKey, city: cityCode, extensions: 'base' },
            timeout: 10000
          }),
          axios.get(`${this.amapBaseUrl}/weather/weatherInfo`, {
            params: { key: this.amapKey, city: cityCode, extensions: 'all' },
            timeout: 10000
          })
        ]);

        if (nowResponse.data.status === '1' && nowResponse.data.lives?.length > 0) {
          const now = nowResponse.data.lives[0];
          let forecastList = [];
          
          if (forecastResponse.data.status === '1' && forecastResponse.data.forecasts?.length > 0) {
            forecastList = forecastResponse.data.forecasts[0].casts || [];
          }

          logger.info(`天气获取成功，当前温度：${now.temperature}°C`);

          return {
            now: {
              temperature: now.temperature,
              weather: now.weather,
              windDirection: now.winddirection,
              windScale: now.windpower,
              humidity: now.humidity,
              updateTime: now.reporttime
            },
            forecast: forecastList.map(f => ({
              date: f.date,
              week: f.week,
              dayWeather: f.dayweather,
              nightWeather: f.nightweather,
              dayTemp: f.daytemp,
              nightTemp: f.nighttemp,
              windDirection: f.daywind,
              windScale: f.daypower
            })),
            source: 'amap',
            timestamp: new Date()
          };
        }

        throw new Error(`天气API返回错误：${nowResponse.data.info}`);
      } catch (error) {
        logger.warn(`天气获取失败 第${attempt}次尝试：${error.message}`);
        if (attempt < maxRetries) {
          await this.delay(1000 * attempt);
        }
      }
    }

    return this.getWeatherUnavailable('天气服务暂时不可用');
  }

  getWeatherUnavailable(reason) {
    return {
      now: null,
      forecast: [],
      source: 'unavailable',
      error: reason,
      message: '天气服务暂时不可用，请稍后重试'
    };
  }

  deduplicatePOIs(pois) {
    const seen = new Map();
    const unique = [];

    for (const poi of pois) {
      if (!poi.id) continue;
      
      if (!seen.has(poi.id)) {
        seen.set(poi.id, true);
        unique.push(poi);
      }
    }

    return unique;
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async callQwenAPI(messages) {
    const payload = {
      model: 'qwen-turbo',
      input: { messages },
      parameters: {
        result_format: 'message',
        temperature: 0.7,
        max_tokens: 1000
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

  async generateAIRecommendations(requirements) {
    logger.info('使用AI生成推荐数据');
    
    const dynamicPrompt = aiPromptGenerator.generateDynamicTravelPrompt(requirements);
    const aiResponse = await this.callQwenAPI([
      { role: 'system', content: '你是旅游推荐专家，提供详细的旅游推荐信息，包括景点、餐厅、小吃、酒饮、酒店和网红打卡点。必须返回JSON格式的数据。' },
      { role: 'user', content: dynamicPrompt }
    ]);

    // 解析AI响应，提取景点、餐厅、小吃、酒饮、酒店和打卡点信息
    const recommendations = this.parseAIResponse(aiResponse);
    return recommendations;
  }

  parseAIResponse(aiResponse) {
    const attractions = [];
    const restaurants = [];
    const snacks = [];
    const drinks = [];
    const hotels = [];
    const checkInPoints = [];

    try {
      // 尝试提取JSON数据
      let jsonStr = aiResponse;
      
      // 方法1: 尝试直接匹配JSON对象
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonStr = jsonMatch[0];
      }
      
      // 方法2: 尝试修复常见的JSON格式错误
      // 移除JSON中的注释
      jsonStr = jsonStr.replace(/\/\*[\s\S]*?\*\//g, '');
      jsonStr = jsonStr.replace(/\/\/.*$/g, '');
      
      // 修复末尾多余的逗号
      jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1');
      
      // 修复缺少引号的属性名
      jsonStr = jsonStr.replace(/(\{|\,)\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');
      
      // 修复字符串中的特殊字符
      jsonStr = jsonStr.replace(/(["'])(?:(?=(\\?))\2.)*?\1/g, (match) => {
        return match.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t');
      });
      
      // 尝试解析JSON
      let data;
      try {
        data = JSON.parse(jsonStr);
      } catch (parseError) {
        // 如果还是失败，尝试使用更宽松的解析
        logger.warn(`JSON解析失败，尝试修复: ${parseError.message}`);
        
        // 尝试提取数组部分
        data = {};
        
        // 提取并修复attractions数组
        const attractionsMatch = jsonStr.match(/"attractions"\s*:\s*\[[\s\S]*?\]/);
        if (attractionsMatch) {
          try {
            let attractionsArrayStr = attractionsMatch[0].replace(/"attractions"\s*:\s*/, '');
            // 修复数组内元素之间的逗号问题
            attractionsArrayStr = this.fixArraySyntax(attractionsArrayStr);
            data.attractions = JSON.parse(attractionsArrayStr);
          } catch (e) {
            logger.warn('景点数组解析失败，尝试手动提取');
            // 手动提取景点信息
            attractions.push(...this.extractItemsManually(attractionsMatch[0], '景点'));
          }
        }
        
        // 提取并修复restaurants数组
        const restaurantsMatch = jsonStr.match(/"restaurants"\s*:\s*\[[\s\S]*?\]/);
        if (restaurantsMatch) {
          try {
            let restaurantsArrayStr = restaurantsMatch[0].replace(/"restaurants"\s*:\s*/, '');
            // 修复数组内元素之间的逗号问题
            restaurantsArrayStr = this.fixArraySyntax(restaurantsArrayStr);
            data.restaurants = JSON.parse(restaurantsArrayStr);
          } catch (e) {
            logger.warn('餐厅数组解析失败，尝试手动提取');
            // 手动提取餐厅信息
            restaurants.push(...this.extractItemsManually(restaurantsMatch[0], '餐厅'));
          }
        }
        
        // 提取并修复hotels数组
        const hotelsMatch = jsonStr.match(/"hotels"\s*:\s*\[[\s\S]*?\]/);
        if (hotelsMatch) {
          try {
            let hotelsArrayStr = hotelsMatch[0].replace(/"hotels"\s*:\s*/, '');
            // 修复数组内元素之间的逗号问题
            hotelsArrayStr = this.fixArraySyntax(hotelsArrayStr);
            data.hotels = JSON.parse(hotelsArrayStr);
          } catch (e) {
            logger.warn('酒店数组解析失败，尝试手动提取');
            // 手动提取酒店信息
            hotels.push(...this.extractItemsManually(hotelsMatch[0], '酒店'));
          }
        }
      }
      
      // 处理解析成功的数据
      if (data.attractions && Array.isArray(data.attractions)) {
        data.attractions.forEach((item, index) => {
          attractions.push({
            id: `ai_attraction_${index + 1}`,
            name: item.name || `景点${index + 1}`,
            address: item.address || '',
            latitude: item.latitude || 0,
            longitude: item.longitude || 0,
            type: item.type || '景点',
            rating: item.rating || 4.5,
            description: item.description || '',
            source: 'ai',
            timestamp: new Date()
          });
        });
      }
      
      if (data.restaurants && Array.isArray(data.restaurants)) {
        data.restaurants.forEach((item, index) => {
          restaurants.push({
            id: `ai_restaurant_${index + 1}`,
            name: item.name || `餐厅${index + 1}`,
            address: item.address || '',
            latitude: item.latitude || 0,
            longitude: item.longitude || 0,
            type: item.type || 'restaurant',
            rating: item.rating || 4.5,
            cuisine: item.cuisine || '湘菜',
            avgPrice: item.avgPrice || null,
            specialty: item.specialty || '',
            description: item.description || '',
            source: 'ai',
            timestamp: new Date()
          });
        });
      }
      
      if (data.snacks && Array.isArray(data.snacks)) {
        data.snacks.forEach((item, index) => {
          snacks.push({
            id: `ai_snack_${index + 1}`,
            name: item.name || `小吃${index + 1}`,
            address: item.address || '',
            latitude: item.latitude || 0,
            longitude: item.longitude || 0,
            type: item.type || '小吃',
            rating: item.rating || 4.5,
            avgPrice: item.avgPrice || null,
            specialty: item.specialty || '',
            description: item.description || '',
            source: 'ai',
            timestamp: new Date()
          });
        });
      }
      
      if (data.drinks && Array.isArray(data.drinks)) {
        data.drinks.forEach((item, index) => {
          drinks.push({
            id: `ai_drink_${index + 1}`,
            name: item.name || `酒饮${index + 1}`,
            address: item.address || '',
            latitude: item.latitude || 0,
            longitude: item.longitude || 0,
            type: item.type || '酒饮',
            rating: item.rating || 4.5,
            avgPrice: item.avgPrice || null,
            description: item.description || '',
            source: 'ai',
            timestamp: new Date()
          });
        });
      }
      
      if (data.hotels && Array.isArray(data.hotels)) {
        data.hotels.forEach((item, index) => {
          hotels.push({
            id: `ai_hotel_${index + 1}`,
            name: item.name || `酒店${index + 1}`,
            address: item.address || '',
            latitude: item.latitude || 0,
            longitude: item.longitude || 0,
            type: '酒店',
            rating: item.rating || 4.5,
            starRating: item.starRating || 0,
            pricePerNight: item.pricePerNight || null,
            description: item.description || '',
            source: 'ai',
            timestamp: new Date()
          });
        });
      }
      
      if (data.checkInPoints && Array.isArray(data.checkInPoints)) {
        data.checkInPoints.forEach((item, index) => {
          checkInPoints.push({
            id: `ai_checkin_${index + 1}`,
            name: item.name || `打卡点${index + 1}`,
            address: item.address || '',
            latitude: item.latitude || 0,
            longitude: item.longitude || 0,
            type: item.type || '打卡点',
            rating: item.rating || 4.5,
            description: item.description || '',
            popularity: item.popularity || 80,
            source: 'ai',
            timestamp: new Date()
          });
        });
      }
      
      // 即使部分解析失败，也要返回已成功解析的数据
      if (attractions.length === 0 && restaurants.length === 0 && snacks.length === 0 && drinks.length === 0 && hotels.length === 0 && checkInPoints.length === 0) {
        logger.warn('AI返回的数据无法解析，尝试使用备用方案');
        // 尝试从原始响应中提取关键信息
        const fallbackItems = this.extractFallbackItems(aiResponse);
        attractions.push(...fallbackItems.attractions);
        restaurants.push(...fallbackItems.restaurants);
        hotels.push(...fallbackItems.hotels);
      }
      
      logger.info(`AI JSON解析完成：景点${attractions.length}个，餐厅${restaurants.length}个，小吃${snacks.length}个，酒饮${drinks.length}个，酒店${hotels.length}个，打卡点${checkInPoints.length}个`);
      return { attractions, restaurants, snacks, drinks, hotels, checkInPoints };
    } catch (error) {
      logger.error(`AI JSON解析失败: ${error.message}`);
      // 即使解析失败，也要返回空数组而不是抛出异常
      return { attractions: [], restaurants: [], snacks: [], drinks: [], hotels: [], checkInPoints: [] };
    }
  }

  fixArraySyntax(arrayStr) {
    // 修复数组元素之间的逗号问题
    let fixed = arrayStr;
    
    // 确保数组元素之间有逗号
    fixed = fixed.replace(/\}(\s*)\{/g, '},$1{');
    
    // 修复末尾多余的逗号
    fixed = fixed.replace(/,(\s*\])/g, '$1');
    
    return fixed;
  }

  extractItemsManually(text, type) {
    const items = [];
    const regex = /\{[\s\S]*?\}/g;
    let match;
    
    while ((match = regex.exec(text)) !== null) {
      try {
        const item = JSON.parse(match[0]);
        if (item.name) {
          items.push({
            id: `ai_${type}_${items.length + 1}`,
            name: item.name,
            address: item.address || '',
            latitude: item.latitude || 0,
            longitude: item.longitude || 0,
            type: type,
            rating: item.rating || 4.5,
            description: item.description || '',
            source: 'ai',
            timestamp: new Date()
          });
        }
      } catch (e) {
        // 忽略解析失败的项
      }
    }
    
    return items;
  }

  extractFallbackItems(aiResponse) {
    const attractions = [];
    const restaurants = [];
    const hotels = [];
    
    // 从文本中提取景点信息
    const attractionKeywords = ['橘子洲', '岳麓山', '五一广场', '湖南省博物馆', '长沙世界之窗', '湖南烈士公园', '岳麓书院'];
    attractionKeywords.forEach((keyword, index) => {
      if (aiResponse.includes(keyword)) {
        attractions.push({
          id: `ai_attraction_fallback_${index + 1}`,
          name: keyword,
          address: '长沙市',
          latitude: 28.2278,
          longitude: 112.9388,
          type: '景点',
          rating: 4.5,
          description: `长沙著名景点：${keyword}`,
          source: 'ai',
          timestamp: new Date()
        });
      }
    });
    
    // 从文本中提取餐厅信息
    const restaurantKeywords = ['湘菜馆', '火锅店', '烧烤店', '特色菜馆', '长沙本地菜馆'];
    restaurantKeywords.forEach((keyword, index) => {
      if (aiResponse.includes(keyword)) {
        restaurants.push({
          id: `ai_restaurant_fallback_${index + 1}`,
          name: keyword,
          address: '长沙市',
          latitude: 28.2278,
          longitude: 112.9388,
          type: '餐厅',
          rating: 4.5,
          cuisine: '湘菜',
          description: `长沙特色餐厅：${keyword}`,
          source: 'ai',
          timestamp: new Date()
        });
      }
    });
    
    // 从文本中提取酒店信息
    const hotelKeywords = ['五一广场附近酒店', '情侣主题酒店', '经济型酒店', '高端度假酒店'];
    hotelKeywords.forEach((keyword, index) => {
      if (aiResponse.includes(keyword)) {
        hotels.push({
          id: `ai_hotel_fallback_${index + 1}`,
          name: keyword,
          address: '长沙市',
          latitude: 28.2278,
          longitude: 112.9388,
          type: '酒店',
          rating: 4.5,
          description: `长沙酒店：${keyword}`,
          source: 'ai',
          timestamp: new Date()
        });
      }
    });
    
    return { attractions, restaurants, hotels };
  }
}

module.exports = new WebSearchService();