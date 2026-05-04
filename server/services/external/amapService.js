/**
 * @fileoverview 高德地图API服务封装 - POI搜索/路线规划/天气查询/周边站点
 * 
 * @module amapService
 * @description 本模块是对高德地图开放平台REST API的完整封装,是系统获取真实地理数据的
 *              核心外部服务层。所有API调用均经过并发限速器保护以符合高德QPS限制。
 * 
 * 主要功能分类:
 *   1. POI搜索: 文本搜索/批量搜索(景点/餐厅/酒店/小吃/饮品/打卡点)
 *   2. 路线规划: 步行/驾车/公交三种交通方式的路径计算
 *   3. 天气服务: 实况天气 + 4日预报(并行请求)
 *   4. 周边查询: 地铁站/公交站的半径搜索及可用性判断
 * 
 * 性能优化核心 — ConcurrencyLimiter 并发限速器(令牌桶+滑动窗口混合模型):
 *   - maxConcurrent=5  同时运行的最大异步数(防并发过载)
 *   - maxQPS=8        每秒最大请求数(满足高德API限制)
 *   - minInterval=120ms 相邻两次请求最小间隔(防突发)
 *   - maxRetries=3    最大重试次数 + 指数退避(800/1600/2400ms)
 * 
 * 设计模式: 单例导出(module.exports = new AmapService()),全局共享一个实例
 * 
 * @requires axios HTTP客户端
 * @requires ../logger 日志服务
 * @requires dotenv 环境变量(AMAP_KEY)
 */
const axios = require('axios');
const logger = require('../logger');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '..', '.env') });

/**
 * 并发限速器 — 令牌桶+滑动窗口混合模型
 *
 * 三重限制:
 *   1. maxConcurrent: 同时运行的最大异步数(防并发过载)
 *   2. maxQPS: 每秒最大请求数(满足高德API限制)
 *   3. minInterval: 相邻两次请求最小间隔(防突发)
 *
 * 内部队列: 所有 execute(fn) 调用按序排队，_process() 循环消费
 */
class ConcurrencyLimiter {
  /**
   * 并发限速器构造函数 — 初始化三重限制参数
   * 
   * 令牌桶 + 滑动窗口混合模型:
   *   - 并发数限制: 防止同时发起过多请求压垮服务器
   *   - QPS限制: 满足高德API的每秒调用次数配额
   *   - 最小间隔: 防止突发流量穿透QPS窗口
   */
  constructor(maxConcurrent = 5, maxRequestsPerSecond = 8, minInterval = 120) {
    this.maxConcurrent = maxConcurrent;
    this.maxRequestsPerSecond = maxRequestsPerSecond;
    this.minInterval = minInterval;
    this.running = 0;
    this.queue = [];
    this.lastRequestTime = 0;
    this.requestCount = 0;
    this.windowStart = Date.now();
  }

  /**
   * execute — 将异步任务加入限速队列并执行
   * 所有外部API调用都应通过此方法包装,实现自动限流。
   * 内部队列机制: 任务按序入队,_process()循环消费
   */
    return new Promise((resolve, reject) => {
      this.queue.push({ fn, resolve, reject });
      this._process();
    });
  }

  /**
   * _process — 队列消费循环(核心调度逻辑)
   * 
   * 三重检查顺序:
   *   1. 队列空? → 直接返回
   *   2. 达到最大并发? → 等待任务完成回调触发
   *   3. QPS窗口满? → 计算等待时间后延迟重试
   *   4. 最小间隔未满足? → 延迟到满足为止
   *   5. 全部通过 → 出队执行
   */
    if (this.queue.length === 0) return;

    if (this.running >= this.maxConcurrent) return;

    const now = Date.now();

    if (now - this.windowStart > 1000) {
      this.requestCount = 0;
      this.windowStart = now;
    }

    if (this.requestCount >= this.maxRequestsPerSecond) {
      const waitTime = 1000 - (now - this.windowStart) + 10;
      setTimeout(() => this._process(), waitTime);
      return;
    }

    const timeSinceLast = now - this.lastRequestTime;
    if (timeSinceLast < this.minInterval && this.lastRequestTime > 0) {
      setTimeout(() => this._process(), this.minInterval - timeSinceLast);
      return;
    }

    const item = this.queue.shift();
    if (!item) return;

    this.running++;
    this.lastRequestTime = Date.now();
    this.requestCount++;

    const { fn, resolve, reject } = item;
    fn()
      .then(resolve)
      .catch(reject)
      .finally(() => {
        this.running--;
        this._process();
      });
  }
}

/**
 * 高德地图服务
 * 优化：统一批量搜索、并发限速、自动重试、减少冗余代码
 */
class AmapService {
  constructor() {
    this.baseUrl = 'https://restapi.amap.com/v3';
    this.limiter = new ConcurrencyLimiter(5, 8, 120);
    this.maxRetries = 3;
    this.retryBaseDelay = 800;
  }

  get key() {
    return process.env.AMAP_KEY;
  }

  // ==================== 基础 POI 搜索 ====================

  /**
   * 高德POI文本搜索 (带重试+限流)
   *
   * @param {string} keywords - 搜索关键词(景点名/餐厅名等)
   * @param {string} types - 高德POI类型编码(如'风景名胜'|'餐饮服务')
   * @returns {Array} 格式化后的POI列表 [{name,address,latitude,longitude,tel,...}]
   */
  async searchPOI(keywords, types = '', page = 1, offset = 20) {
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        logger.info(`高德搜索: ${keywords}${attempt > 1 ? ` (第${attempt}次)` : ''}`);

        const params = {
          key: this.key,
          keywords,
          city: '430100',
          citylimit: true,
          offset,
          page,
          extensions: 'all'
        };

        if (types) params.types = types;

        const response = await axios.get(`${this.baseUrl}/place/text`, {
          params,
          timeout: 40000
        });

        if (response.data.status === '1' && response.data.pois && response.data.pois.length > 0) {
          logger.info(`找到: ${keywords} -> ${response.data.pois[0].name}`);
          return response.data.pois.map(poi => this.formatPOI(poi));
        }

        if (response.data.info && response.data.info.includes('CUQPS')) {
          throw new Error('API限流 CUQPS');
        }

        logger.warn(`未找到: ${keywords}, status: ${response.data.status}, info: ${response.data.info}`);
        return [];
      } catch (error) {
        if (error.response) {
          logger.error(`搜索失败 [${keywords}]: HTTP ${error.response.status} ${error.message}`);
          return [];
        }
        logger.warn(`搜索失败 [${keywords}] 第${attempt}次: ${error.message}`);
        if (attempt < this.maxRetries) {
          await this.delay(this.retryBaseDelay * attempt);
        } else {
          logger.error(`搜索最终失败 [${keywords}]: ${error.message}`);
          return [];
        }
      }
    }
    return [];
  }

  async searchSingle(name, types = '') {
    const pois = await this.searchPOI(name, types, 1, 10);
    return pois.length > 0 ? pois[0] : null;
  }

  // ==================== 统一批量搜索 ====================
  // 替代原来6个完全重复的方法，性能提升：串行→并发（受控）

  /**
   * 统一批量搜索入口 — N个地点名 → 并行搜索 + limiter控制速率
   *
   * @param {Array} names - 待搜索的地点名称数组
   * @param {string} label - 日志标签(如"景点"/"餐厅")
   * @param {string} types - 高德POI类型编码
   * @returns {Array} 与输入同序的结果数组
   */
  /**
   * batchSearchPOIs — 统一批量搜索入口(消除6个重复方法的代码冗余)
   * 
   * 设计改进: 原来每个类型(景点/餐厅/酒店...)都有几乎相同的批量搜索逻辑,
   *           现在统一委托到此方法,通过参数差异化,减少约200行重复代码。
   * 
   * 并发策略: 所有搜索任务同时发起,由ConcurrencyLimiter控制实际执行速率
   */
    if (!names || names.length === 0) return [];

    const results = [];

    // 并发执行所有搜索任务，由 limiter 控制速率
    const searchTasks = names.slice(0, limit).map(async (name) => {
      try {
        const poi = await this.limiter.execute(() => this.searchSingle(name, types));
        if (poi && (!filterFn || filterFn(poi))) {
          results.push({ ...poi, _searchName: name });
        }
      } catch (e) {
        logger.warn(`${label}搜索异常 [${name}]: ${e.message}`);
      }
    });

    await Promise.all(searchTasks);

    if (results.length > 0) {
      logger.info(`批量${label}搜索完成: ${results.length}/${names.length} 个成功`);
    }
    // 移除内部标记字段
    return results.map(r => {
      const { _searchName, ...rest } = r;
      return rest;
    });
  }

  // 向后兼容的便捷方法
  async searchAttractions(names)   { return this.batchSearchPOIs(names, '景点'); }
  async searchRestaurants(names)   { return this.batchSearchPOIs(names, '餐厅'); }
  async searchHotels(names)       { return this.batchSearchPOIs(names, '酒店'); }
  async searchSnacks(names)       { return this.batchSearchPOIs(names, '小吃'); }
  async searchDrinks(names)       { return this.batchSearchPOIs(names, '饮品'); }
  async searchCheckInPoints(names){ return this.batchSearchPOIs(names, '打卡点'); }

  async searchMultiplePOIs(keywordsList, types = '') {
    const tasks = keywordsList.map(kw =>
      this.limiter.execute(() => this.searchPOI(kw, types, 1, 10))
    );
    const allResults = await Promise.all(tasks);
    return this.deduplicatePOIs(allResults.flat());
  }

  // ==================== 格式化与工具方法 ====================

  static parseLocation(locationStr) {
    const parts = (locationStr || '').split(',');
    return {
      latitude: parseFloat(parts[1]) || 0,
      longitude: parseFloat(parts[0]) || 0
    };
  }

  formatPOI(poi) {
    const loc = AmapService.parseLocation(poi.location);
    return {
      id: poi.id,
      name: poi.name,
      address: poi.address || '',
      latitude: loc.latitude,
      longitude: loc.longitude,
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

  // ==================== 路线规划（提取公共逻辑）====================

  /**
   * 通用路线规划（步行/驾车共用结构）
   */
  async _getRoute(endpoint, origin, destination, extraParams = {}) {
    try {
      const params = {
        key: this.key,
        origin: `${origin.lng},${origin.lat}`,
        destination: `${destination.lng},${destination.lat}`,
        ...extraParams
      };

      const response = await this.limiter.execute(() =>
        axios.get(`${this.baseUrl}/${endpoint}`, { params, timeout: 40000 })
      );

      if (response.data.status === '1' && response.data.route) {
        const path = response.data.route.paths[0];
        return {
          distance: path.distance,
          duration: path.duration,
          tolls: path.tolls || null,
          steps: (path.steps || []).map(step => ({
            instruction: step.instruction,
            distance: step.distance,
            duration: step.duration,
            polyline: step.polyline
          }))
        };
      }
      return null;
    } catch (error) {
      logger.error(`路线规划(${endpoint})失败: ${error.message}`);
      return null;
    }
  }

  async getWalkingRoute(origin, destination) {
    return this._getRoute('direction/walking', origin, destination);
  }

  async getDrivingRoute(origin, destination) {
    return this._getRoute('direction/driving', origin, destination);
  }

  async getTransitRoute(origin, destination) {
    try {
      const response = await this.limiter.execute(() =>
        axios.get(`${this.baseUrl}/direction/transit/integrated`, {
          params: {
            key: this.key,
            origin: `${origin.lng},${origin.lat}`,
            destination: `${destination.lng},${destination.lat}`,
            city: '长沙',
            cityd: '长沙'
          },
          timeout: 40000
        })
      );

      if (response.data.status === '1' && response.data.route) {
        const transits = response.data.route.transits;
        if (transits && transits.length > 0) {
          const best = transits[0];
          return {
            distance: best.distance,
            duration: best.duration,
            cost: best.cost,
            segments: (best.segments || []).map(seg => ({
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

  // ==================== 天气 ====================

  /**
   * 获取长沙天气 — 实况+4日预报(并行请求)
   *
   * @returns {{ current:{temp,weather,...}, forecast:[{date,high,low,...}] }}
   */
  async getWeather() {
    try {
      const cityCode = '430100';
      const [nowResponse, forecastResponse] = await Promise.all([
        axios.get(`${this.baseUrl}/weather/weatherInfo`, {
          params: { key: this.key, city: cityCode, extensions: 'base' },
          timeout: 20000
        }),
        axios.get(`${this.baseUrl}/weather/weatherInfo`, {
          params: { key: this.key, city: cityCode, extensions: 'all' },
          timeout: 20000
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

  // ==================== 周边搜索（地铁/公交合并公共逻辑）====================

  /**
   * 通用周边搜索（地铁站/公交站共用）
   */
  async _searchNearbyStation(lat, lng, keywords, types, radius, label) {
    try {
      logger.info(`搜索${label}: lat=${lat}, lng=${lng}, radius=${radius}`);

      const response = await this.limiter.execute(() =>
        axios.get(`${this.baseUrl}/place/around`, {
          params: {
            key: this.key,
            location: `${lng},${lat}`,
            keywords,
            types,
            radius,
            city: '长沙',
            citylimit: true,
            offset: 5,
            extensions: 'base'
          },
          timeout: 20000
        })
      );

      if (response.data.status === '1' && response.data.pois && response.data.pois.length > 0) {
        return response.data.pois.map(poi => {
          const loc = AmapService.parseLocation(poi.location);
          return {
            name: poi.name,
            distance: poi.distance,
            latitude: loc.latitude,
            longitude: loc.longitude,
            address: poi.address || ''
          };
        });
      }
      return [];
    } catch (error) {
      logger.error(`搜索${label}失败: ${error.message}`);
      return [];
    }
  }

  async searchNearbySubwayStation(lat, lng, radius = 1000) {
    return this._searchNearbyStation(lat, lng, '地铁站|地铁', '150500', radius, '地铁站');
  }

  async searchNearbyBusStation(lat, lng, radius = 800) {
    return this._searchNearbyStation(lat, lng, '公交站|公交', '150700', radius, '公交站');
  }

  /**
   * 通用交通可用性检查（地铁/公交共用）
   */
  async _checkTransportAvailable(from, to, stationLabel, searchFn) {
    logger.info(`检查${stationLabel}可用性: from(${from.lat}, ${from.lng}) -> to(${to.lat}, ${to.lng})`);

    const [fromStations, toStations] = await Promise.all([
      searchFn(from.lat, from.lng),
      searchFn(to.lat, to.lng)
    ]);

    logger.info(`起点附近${stationLabel}: ${fromStations.length}个, 终点附近${stationLabel}: ${toStations.length}个`);
    if (fromStations.length > 0) logger.info(`起点最近${stationLabel}: ${fromStations[0].name}, 距离${fromStations[0].distance}米`);
    if (toStations.length > 0) logger.info(`终点最近${stationLabel}: ${toStations[0].name}, 距离${toStations[0].distance}米`);

    return {
      fromAvailable: fromStations.length > 0,
      toAvailable: toStations.length > 0,
      fromStation: fromStations[0] || null,
      toStation: toStations[0] || null
    };
  }

  async checkSubwayAvailable(from, to) {
    return this._checkTransportAvailable(from, to, '地铁站', this.searchNearbySubwayStation.bind(this));
  }

  async checkBusAvailable(from, to) {
    return this._checkTransportAvailable(from, to, '公交站', this.searchNearbyBusStation.bind(this));
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = new AmapService();
