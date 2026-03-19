const axios = require('axios');
const logger = require('../logger');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '..', '.env') });

/**
 * 高德地图服务
 * 直接精确搜索AI返回的地点名称
 */
class AmapService {
  constructor() {
    this.baseUrl = 'https://restapi.amap.com/v3';
  }

  get key() {
    return process.env.AMAP_KEY;
  }

  /**
   * 精确搜索POI
   */
  async searchPOI(keywords, types = '', page = 1, offset = 20) {
    try {
      logger.info(`高德搜索: ${keywords}`);
      
      const params = {
        key: this.key,
        keywords: keywords,
        city: '430100',
        citylimit: true,
        offset: offset,
        page: page,
        extensions: 'all'
      };
      
      if (types) {
        params.types = types;
      }
      
      const response = await axios.get(`${this.baseUrl}/place/text`, {
        params: params,
        timeout: 40000
      });

      if (response.data.status === '1' && response.data.pois && response.data.pois.length > 0) {
        logger.info(`找到: ${keywords} -> ${response.data.pois[0].name}`);
        return response.data.pois.map(poi => this.formatPOI(poi));
      }
      
      logger.warn(`未找到: ${keywords}, status: ${response.data.status}, info: ${response.data.info}`);
      return [];
    } catch (error) {
      logger.error(`搜索失败 [${keywords}]: ${error.message}`);
      return [];
    }
  }

  /**
   * 精确搜索单个地点
   */
  async searchSingle(name, types = '') {
    const pois = await this.searchPOI(name, types, 1, 10);
    return pois.length > 0 ? pois[0] : null;
  }

  /**
   * 批量搜索景点
   */
  async searchAttractions(names) {
    const results = [];
    for (const name of names) {
      const poi = await this.searchSingle(name);
      if (poi) {
        results.push(poi);
      }
      await this.delay(250);
    }
    return results;
  }

  /**
   * 批量搜索餐厅
   */
  async searchRestaurants(names) {
    const results = [];
    for (const name of names) {
      const poi = await this.searchSingle(name);
      if (poi) {
        results.push(poi);
      }
      await this.delay(250);
    }
    return results;
  }

  /**
   * 批量搜索酒店
   */
  async searchHotels(names) {
    const results = [];
    for (const name of names) {
      const poi = await this.searchSingle(name);
      if (poi) {
        results.push(poi);
      }
      await this.delay(250);
    }
    return results;
  }

  /**
   * 批量搜索小吃
   */
  async searchSnacks(names) {
    const results = [];
    for (const name of names) {
      const poi = await this.searchSingle(name);
      if (poi) {
        results.push(poi);
      }
      await this.delay(250);
    }
    return results;
  }

  /**
   * 批量搜索饮品
   */
  async searchDrinks(names) {
    const results = [];
    for (const name of names) {
      const poi = await this.searchSingle(name);
      if (poi) {
        results.push(poi);
      }
      await this.delay(250);
    }
    return results;
  }

  /**
   * 批量搜索打卡点
   */
  async searchCheckInPoints(names) {
    const results = [];
    for (const name of names) {
      const poi = await this.searchSingle(name);
      if (poi) {
        results.push(poi);
      }
      await this.delay(250);
    }
    return results;
  }

  /**
   * 多关键词搜索
   */
  async searchMultiplePOIs(keywordsList, types = '') {
    const results = [];
    for (const keywords of keywordsList) {
      const pois = await this.searchPOI(keywords, types, 1, 10);
      results.push(...pois);
      await this.delay(250);
    }
    return this.deduplicatePOIs(results);
  }

  /**
   * 格式化POI数据
   */
  formatPOI(poi) {
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
      rating: poi.biz_ext?.rating ? parseFloat(poi.biz_ext.rating) : null,
      cost: poi.biz_ext?.cost || null,
      photos: (poi.photos || []).map(p => typeof p === 'string' ? p : (p.url || '')),
      businessArea: poi.business_area || '',
      openingHours: poi.biz_ext?.opening_hours || '',
      description: poi.biz_ext?.comment || '',
      source: 'amap',
      timestamp: new Date()
    };
  }

  /**
   * 去重POI
   */
  deduplicatePOIs(pois) {
    const seen = new Map();
    const unique = [];
    for (const poi of pois) {
      if (!seen.has(poi.id)) {
        seen.set(poi.id, true);
        unique.push(poi);
      }
    }
    return unique;
  }

  /**
   * 获取路线规划（步行）
   */
  async getWalkingRoute(origin, destination) {
    try {
      const response = await axios.get(`${this.baseUrl}/direction/walking`, {
        params: {
          key: this.key,
          origin: `${origin.lng},${origin.lat}`,
          destination: `${destination.lng},${destination.lat}`
        },
        timeout: 40000
      });

      if (response.data.status === '1' && response.data.route) {
        const path = response.data.route.paths[0];
        return {
          distance: path.distance,
          duration: path.duration,
          steps: path.steps.map(step => ({
            instruction: step.instruction,
            distance: step.distance,
            duration: step.duration,
            polyline: step.polyline
          }))
        };
      }
      return null;
    } catch (error) {
      logger.error(`路线规划失败: ${error.message}`);
      return null;
    }
  }

  /**
   * 获取路线规划（公交）
   */
  async getTransitRoute(origin, destination) {
    try {
      const response = await axios.get(`${this.baseUrl}/direction/transit/integrated`, {
        params: {
          key: this.key,
          origin: `${origin.lng},${origin.lat}`,
          destination: `${destination.lng},${destination.lat}`,
          city: '长沙',
          cityd: '长沙'
        },
        timeout: 40000
      });

      if (response.data.status === '1' && response.data.route) {
        const transits = response.data.route.transits;
        if (transits && transits.length > 0) {
          const best = transits[0];
          return {
            distance: best.distance,
            duration: best.duration,
            cost: best.cost,
            segments: best.segments.map(seg => ({
              mode: seg.mode,
              instruction: seg.instruction,
              distance: seg.distance,
              duration: seg.duration
            }))
          };
        }
      }
      return null;
    } catch (error) {
      logger.error(`公交路线规划失败: ${error.message}`);
      return null;
    }
  }

  /**
   * 获取路线规划（驾车）
   */
  async getDrivingRoute(origin, destination) {
    try {
      const response = await axios.get(`${this.baseUrl}/direction/driving`, {
        params: {
          key: this.key,
          origin: `${origin.lng},${origin.lat}`,
          destination: `${destination.lng},${destination.lat}`
        },
        timeout: 40000
      });

      if (response.data.status === '1' && response.data.route) {
        const path = response.data.route.paths[0];
        return {
          distance: path.distance,
          duration: path.duration,
          tolls: path.tolls,
          steps: path.steps.map(step => ({
            instruction: step.instruction,
            distance: step.distance,
            duration: step.duration,
            polyline: step.polyline
          }))
        };
      }
      return null;
    } catch (error) {
      logger.error(`驾车路线规划失败: ${error.message}`);
      return null;
    }
  }

  /**
   * 获取天气
   */
  async getWeather() {
    try {
      const cityCode = '430100';
      const [nowResponse, forecastResponse] = await Promise.all([
        axios.get(`${this.baseUrl}/weather/weatherInfo`, {
          params: { key: this.key, city: cityCode, extensions: 'base' },
          timeout: 40000
        }),
        axios.get(`${this.baseUrl}/weather/weatherInfo`, {
          params: { key: this.key, city: cityCode, extensions: 'all' },
          timeout: 40000
        })
      ]);

      if (nowResponse.data.status === '1' && nowResponse.data.lives?.length > 0) {
        const now = nowResponse.data.lives[0];
        let forecastList = [];
        
        if (forecastResponse.data.status === '1' && forecastResponse.data.forecasts?.length > 0) {
          forecastList = forecastResponse.data.forecasts[0].casts || [];
        }

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
            nightTemp: f.nighttemp
          })),
          source: 'amap',
          timestamp: new Date()
        };
      }
      return null;
    } catch (error) {
      logger.error(`天气获取失败: ${error.message}`);
      return null;
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async searchNearbySubwayStation(lat, lng, radius = 1000) {
    try {
      logger.info(`搜索地铁站: lat=${lat}, lng=${lng}, radius=${radius}`);
      
      const response = await axios.get(`${this.baseUrl}/place/around`, {
        params: {
          key: this.key,
          location: `${lng},${lat}`,
          keywords: '地铁站|地铁',
          types: '150500',
          radius: radius,
          city: '长沙',
          citylimit: true,
          offset: 5,
          extensions: 'base'
        },
        timeout: 20000
      });

      logger.info(`地铁站搜索结果: status=${response.data.status}, count=${response.data.pois?.length || 0}`);
      
      if (response.data.status === '1' && response.data.pois && response.data.pois.length > 0) {
        return response.data.pois.map(poi => {
          const location = poi.location ? poi.location.split(',') : ['0', '0'];
          return {
            name: poi.name,
            distance: poi.distance,
            latitude: parseFloat(location[1]) || 0,
            longitude: parseFloat(location[0]) || 0,
            address: poi.address || ''
          };
        });
      }
      return [];
    } catch (error) {
      logger.error(`搜索地铁站失败: ${error.message}`);
      return [];
    }
  }

  async searchNearbyBusStation(lat, lng, radius = 800) {
    try {
      logger.info(`搜索公交站: lat=${lat}, lng=${lng}, radius=${radius}`);
      
      const response = await axios.get(`${this.baseUrl}/place/around`, {
        params: {
          key: this.key,
          location: `${lng},${lat}`,
          keywords: '公交站|公交',
          types: '150700',
          radius: radius,
          city: '长沙',
          citylimit: true,
          offset: 5,
          extensions: 'base'
        },
        timeout: 20000
      });

      logger.info(`公交站搜索结果: status=${response.data.status}, count=${response.data.pois?.length || 0}`);
      
      if (response.data.status === '1' && response.data.pois && response.data.pois.length > 0) {
        return response.data.pois.map(poi => {
          const location = poi.location ? poi.location.split(',') : ['0', '0'];
          return {
            name: poi.name,
            distance: poi.distance,
            latitude: parseFloat(location[1]) || 0,
            longitude: parseFloat(location[0]) || 0,
            address: poi.address || ''
          };
        });
      }
      return [];
    } catch (error) {
      logger.error(`搜索公交站失败: ${error.message}`);
      return [];
    }
  }

  async checkSubwayAvailable(from, to) {
    logger.info(`检查地铁可用性: from(${from.lat}, ${from.lng}) -> to(${to.lat}, ${to.lng})`);
    
    const [fromStations, toStations] = await Promise.all([
      this.searchNearbySubwayStation(from.lat, from.lng),
      this.searchNearbySubwayStation(to.lat, to.lng)
    ]);

    logger.info(`起点附近地铁站: ${fromStations.length}个, 终点附近地铁站: ${toStations.length}个`);
    if (fromStations.length > 0) {
      logger.info(`起点最近地铁站: ${fromStations[0].name}, 距离${fromStations[0].distance}米`);
    }
    if (toStations.length > 0) {
      logger.info(`终点最近地铁站: ${toStations[0].name}, 距离${toStations[0].distance}米`);
    }

    return {
      fromAvailable: fromStations.length > 0,
      toAvailable: toStations.length > 0,
      fromStation: fromStations[0] || null,
      toStation: toStations[0] || null
    };
  }

  async checkBusAvailable(from, to) {
    logger.info(`检查公交可用性: from(${from.lat}, ${from.lng}) -> to(${to.lat}, ${to.lng})`);
    
    const [fromStations, toStations] = await Promise.all([
      this.searchNearbyBusStation(from.lat, from.lng),
      this.searchNearbyBusStation(to.lat, to.lng)
    ]);

    logger.info(`起点附近公交站: ${fromStations.length}个, 终点附近公交站: ${toStations.length}个`);
    if (fromStations.length > 0) {
      logger.info(`起点最近公交站: ${fromStations[0].name}, 距离${fromStations[0].distance}米`);
    }
    if (toStations.length > 0) {
      logger.info(`终点最近公交站: ${toStations[0].name}, 距离${toStations[0].distance}米`);
    }

    return {
      fromAvailable: fromStations.length > 0,
      toAvailable: toStations.length > 0,
      fromStation: fromStations[0] || null,
      toStation: toStations[0] || null
    };
  }
}

module.exports = new AmapService();
