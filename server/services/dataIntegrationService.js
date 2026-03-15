const axios = require('axios');
const logger = require('./logger');
const aiPromptGenerator = require('./ai/aiPromptGenerator');

class DataIntegrationService {
  constructor() {
    this.qwenApiKey = process.env.QWEN_API_KEY;
    this.qwenApiUrl = process.env.QWEN_API_URL || 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation';
    
    this.indoorTypes = ['博物馆', '展览馆', '商场', '室内', '纪念馆'];
    this.outdoorTypes = ['风景名胜', '公园', '山', '湖', '江', '洲', '广场'];
  }

  async integrateAndOptimize(rawData, requirements) {
    try {
      logger.info('开始数据整合与行程优化');

      if (!rawData || typeof rawData !== 'object') {
        throw new Error('无效的原始数据：数据为空或格式错误');
      }

      const attractions = rawData.attractions || [];
      const restaurants = rawData.restaurants || [];
      const snacks = rawData.snacks || [];
      const drinks = rawData.drinks || [];
      const hotels = rawData.hotels || [];
      const checkInPoints = rawData.checkInPoints || [];
      const guides = rawData.guides || [];

      logger.info(`原始数据: 景点${attractions.length}个, 餐厅${restaurants.length}个, 小吃${snacks.length}个, 酒饮${drinks.length}个, 酒店${hotels.length}个, 打卡点${checkInPoints.length}个, 攻略${guides.length}条`);

      const dedupedAttractions = await this.aiDeduplicateAttractions(attractions);
      const dedupedRestaurants = this.deduplicateRestaurants(restaurants);
      const dedupedSnacks = this.deduplicateRestaurants(snacks);
      const dedupedDrinks = this.deduplicateRestaurants(drinks);
      const dedupedHotels = this.deduplicateHotels(hotels);
      const dedupedCheckInPoints = this.aiDeduplicateAttractions(checkInPoints);

      logger.info(`去重后: 景点${dedupedAttractions.length}个, 餐厅${dedupedRestaurants.length}个, 小吃${dedupedSnacks.length}个, 酒饮${dedupedDrinks.length}个, 酒店${dedupedHotels.length}个, 打卡点${dedupedCheckInPoints.length}个`);

      const scoredAttractions = this.scoreAttractions(dedupedAttractions, requirements);
      const scoredCheckInPoints = this.scoreAttractions(dedupedCheckInPoints, requirements);
      const clusters = this.clusterByLocation([...scoredAttractions, ...scoredCheckInPoints]);

      logger.info(`地域聚类: ${clusters.length}个区域`);

      const itinerary = await this.generateOptimizedItinerary(
        scoredAttractions,
        scoredCheckInPoints,
        clusters,
        dedupedRestaurants,
        dedupedSnacks,
        dedupedDrinks,
        dedupedHotels,
        guides,
        requirements,
        rawData.weather,
        rawData.specialEvents
      );

      const aiRecommendations = await this.generateAIRecommendations(
        scoredAttractions,
        scoredCheckInPoints,
        dedupedRestaurants,
        dedupedSnacks,
        dedupedDrinks,
        dedupedHotels,
        guides,
        itinerary,
        requirements,
        rawData.specialEvents
      );

      return {
        integratedData: {
          attractions: scoredAttractions,
          restaurants: dedupedRestaurants,
          snacks: dedupedSnacks,
          drinks: dedupedDrinks,
          hotels: dedupedHotels,
          checkInPoints: scoredCheckInPoints,
          guides: guides
        },
        filteredData: {
          attractions: scoredAttractions.slice(0, 20),
          restaurants: dedupedRestaurants,
          snacks: dedupedSnacks.slice(0, 10),
          drinks: dedupedDrinks.slice(0, 10),
          hotels: dedupedHotels.slice(0, 5),
          checkInPoints: scoredCheckInPoints.slice(0, 10),
          guides: guides.slice(0, 10)
        },
        itinerary: itinerary,
        weather: rawData.weather,
        specialEvents: rawData.specialEvents,
        aiRecommendations: aiRecommendations,
        clusters: clusters.map(c => ({
          center: c.center,
          count: c.attractions.length,
          names: c.attractions.slice(0, 3).map(a => a.name)
        }))
      };
    } catch (error) {
      logger.error(`数据整合失败: ${error.message}`);
      throw error;
    }
  }

  async aiDeduplicateAttractions(attractions) {
    if (attractions.length <= 1) return attractions;

    const names = attractions.map(a => a.name);
    
    try {
      const prompt = `你是一个旅游景点去重专家。以下是从高德地图搜索到的景点名称列表，请严格识别并去除重复或高度相似的景点。

严格去重规则：
1. 同一地点的不同名称视为重复（如"橘子洲"、"橘子洲景区"、"橘子洲风景名胜区"视为同一个景点）
2. 同一景区内的子景点视为重复（如"岳麓山"和"岳麓山白鹤泉"视为同一景区）
3. 地理位置相近且名称相似的视为重复
4. 保留最有代表性、名称最完整的主景点，去除子景点和重复项

景点列表：
${names.map((n, i) => `${i + 1}. ${n}`).join('\n')}

请返回需要保留的景点序号（去重后），只输出JSON数组格式，例如：[1,3,5,7,9]`;

      const response = await this.callQwenAPI([
        { role: 'system', content: '你是旅游景点去重专家，只输出JSON数组格式的序号列表。' },
        { role: 'user', content: prompt }
      ]);

      const jsonMatch = response.match(/\[[\s\S]*?\]/);
      if (jsonMatch) {
        const indices = JSON.parse(jsonMatch[0]);
        const deduped = indices
          .map(i => attractions[i - 1])
          .filter(a => a !== undefined);
        
        logger.info(`AI去重: ${attractions.length} -> ${deduped.length}个景点`);
        return deduped;
      }
    } catch (error) {
      logger.warn(`AI去重失败，使用规则去重: ${error.message}`);
    }

    return this.ruleBasedDeduplicate(attractions);
  }

  ruleBasedDeduplicate(attractions) {
    const seen = new Map();
    const unique = [];

    const sortedAttractions = [...attractions].sort((a, b) => (b.rating || 0) - (a.rating || 0));

    for (const attr of sortedAttractions) {
      let isDuplicate = false;

      for (const [key, existingAttr] of seen) {
        if (this.isSimilarAttraction(attr, existingAttr)) {
          isDuplicate = true;
          break;
        }
      }

      if (!isDuplicate) {
        seen.set(attr.id, attr);
        unique.push(attr);
      }
    }

    logger.info(`规则去重: ${attractions.length} -> ${unique.length}个景点`);
    return unique;
  }

  isSimilarAttraction(attr1, attr2) {
    const name1 = (attr1.name || '').replace(/景区|风景名胜区|旅游区|公园|景点|风景区/g, '').trim();
    const name2 = (attr2.name || '').replace(/景区|风景名胜区|旅游区|公园|景点|风景区/g, '').trim();

    if (name1 === name2) return true;

    if (name1.includes(name2) || name2.includes(name1)) {
      const shorter = name1.length < name2.length ? name1 : name2;
      if (shorter.length >= 2) return true;
    }

    if (attr1.latitude && attr1.longitude && attr2.latitude && attr2.longitude) {
      const distance = this.calculateDistance(
        attr1.latitude, attr1.longitude,
        attr2.latitude, attr2.longitude
      );
      if (distance < 0.3) return true;
    }

    return false;
  }

  deduplicateRestaurants(restaurants) {
    const seen = new Map();
    const unique = [];

    for (const restaurant of restaurants) {
      const key = `${restaurant.name}_${restaurant.address}`.toLowerCase();
      if (!seen.has(key)) {
        seen.set(key, true);
        unique.push(restaurant);
      }
    }

    return unique;
  }

  deduplicateHotels(hotels) {
    const seen = new Map();
    const unique = [];

    for (const hotel of hotels) {
      const key = `${hotel.name}_${hotel.address}`.toLowerCase();
      if (!seen.has(key)) {
        seen.set(key, true);
        unique.push(hotel);
      }
    }

    return unique;
  }

  scoreAttractions(attractions, requirements) {
    return attractions.map(attr => {
      let score = 0;
      const weights = {
        rating: 30,
        popularity: 25,
        ticketPrice: 15,
        match: 20,
        completeness: 10
      };

      if (attr.rating && attr.rating > 0) {
        score += (attr.rating / 5) * weights.rating;
      } else {
        score += weights.rating * 0.6;
      }

      score += (attr.popularity || 50) / 100 * weights.popularity;

      if (requirements.budget) {
        const budgetRanges = {
          '0-500': 100,
          '500-1000': 200,
          '1000-2000': 300,
          '2000+': Infinity
        };
        const maxPrice = budgetRanges[requirements.budget] || 200;
        if ((attr.cost || 0) <= maxPrice) {
          score += weights.ticketPrice;
        } else {
          score += weights.ticketPrice * 0.3;
        }
      } else {
        score += weights.ticketPrice * 0.7;
      }

      if (requirements.interests && requirements.interests.length > 0) {
        const name = (attr.name || '').toLowerCase();
        const type = (attr.type || '').toLowerCase();
        const allText = `${name} ${type}`;
        
        let matchCount = 0;
        for (const interest of requirements.interests) {
          if (allText.includes(interest.toLowerCase())) {
            matchCount++;
          }
        }
        score += (matchCount / requirements.interests.length) * weights.match;
      } else {
        score += weights.match * 0.5;
      }

      let completenessScore = 0;
      if (attr.name) completenessScore += 25;
      if (attr.latitude && attr.longitude) completenessScore += 25;
      if (attr.address) completenessScore += 20;
      if (attr.rating) completenessScore += 15;
      if (attr.openingHours) completenessScore += 15;
      score += (completenessScore / 100) * weights.completeness;

      return {
        ...attr,
        score: Math.round(score * 10) / 10
      };
    }).sort((a, b) => b.score - a.score);
  }

  clusterByLocation(attractions) {
    if (attractions.length === 0) return [];

    const clusters = [];
    const used = new Set();
    const clusterRadius = 2.0;

    const sortedAttractions = [...attractions].sort((a, b) => b.score - a.score);

    for (const attraction of sortedAttractions) {
      if (used.has(attraction.id)) continue;

      const cluster = {
        center: { lat: attraction.latitude, lng: attraction.longitude },
        attractions: [attraction],
        avgScore: attraction.score
      };
      used.add(attraction.id);

      for (const other of sortedAttractions) {
        if (used.has(other.id)) continue;

        const distance = this.calculateDistance(
          cluster.center.lat, cluster.center.lng,
          other.latitude, other.longitude
        );

        if (distance <= clusterRadius) {
          cluster.attractions.push(other);
          used.add(other.id);
        }
      }

      const totalScore = cluster.attractions.reduce((sum, a) => sum + a.score, 0);
      cluster.avgScore = totalScore / cluster.attractions.length;

      cluster.attractions.sort((a, b) => b.score - a.score);

      clusters.push(cluster);
    }

    clusters.sort((a, b) => b.avgScore - a.avgScore);

    logger.info(`地域聚类完成: ${clusters.length}个区域, ${used.size}个景点`);

    return clusters;
  }

  calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = this.toRad(lat2 - lat1);
    const dLng = this.toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  toRad(deg) {
    return deg * (Math.PI / 180);
  }

  async generateOptimizedItinerary(attractions, checkInPoints, clusters, restaurants, snacks, drinks, hotels, guides, requirements, weather, specialEvents) {
    const days = requirements.days || 3;
    
    if (attractions.length === 0 && checkInPoints.length === 0) {
      throw new Error('没有可用的景点或打卡点数据来生成行程');
    }

    const itinerary = [];
    const weatherForecast = weather?.forecast || [];
    const usedAttractionIds = new Set();
    const usedCheckInIds = new Set();
    
    let minPerDay = 3;
    let maxPerDay = 4;
    
    if (requirements.attractionsPerDay) {
      minPerDay = requirements.attractionsPerDay.min || 3;
      maxPerDay = requirements.attractionsPerDay.max || 4;
    }
    
    logger.info(`行程规划：${days}天，每天${minPerDay}-${maxPerDay}个景点/打卡点`);

    for (let day = 1; day <= days; day++) {
      const dayWeather = weatherForecast[day - 1] || null;
      
      const availableAttractions = attractions.filter(a => !usedAttractionIds.has(a.id));
      const availableCheckInPoints = checkInPoints.filter(c => !usedCheckInIds.has(c.id));
      
      const remainingDays = days - day + 1;
      const remainingActivities = availableAttractions.length + availableCheckInPoints.length;
      const targetForToday = Math.min(maxPerDay, Math.max(minPerDay, Math.ceil(remainingActivities / remainingDays)));
      
      let dayAttractions = this.selectAttractionsForDay(
        availableAttractions,
        day,
        days,
        dayWeather,
        Math.floor(targetForToday * 0.7)
      );
      
      let dayCheckInPoints = this.selectCheckInPointsForDay(
        availableCheckInPoints,
        day,
        days,
        dayWeather,
        targetForToday - dayAttractions.length
      );
      
      dayAttractions.forEach(a => usedAttractionIds.add(a.id));
      dayCheckInPoints.forEach(c => usedCheckInIds.add(c.id));

      const allActivities = [...dayAttractions, ...dayCheckInPoints];

      const dayRestaurants = this.selectRestaurantsForDay(
        restaurants,
        allActivities,
        day,
        requirements
      );

      const daySnacks = this.selectSnacksForDay(
        snacks,
        allActivities,
        day
      );

      const dayDrinks = this.selectDrinksForDay(
        drinks,
        allActivities,
        day
      );

      const optimizedRoute = this.optimizeRoute(allActivities);

      const daySpecialEvents = this.getDaySpecialEvents(day, specialEvents);

      const dayPlan = {
        day: day,
        date: this.getDateString(day - 1),
        weather: dayWeather,
        weatherAdvice: this.getWeatherAdvice(dayWeather),
        attractions: optimizedRoute.map((attr, idx) => ({
          ...attr,
          order: idx + 1,
          bestTime: this.getBestTimeSlot(idx, attr, dayWeather),
          estimatedDuration: this.getEstimatedDuration(attr),
          isIndoor: this.isIndoorAttraction(attr),
          transportInfo: idx > 0 ? this.getTransportInfo(optimizedRoute[idx - 1], attr) : null
        })),
        restaurants: dayRestaurants,
        snacks: daySnacks,
        drinks: dayDrinks,
        hotels: this.recommendHotelsForDay(hotels, allActivities, requirements),
        guides: this.selectGuidesForDay(guides, allActivities),
        totalDistance: this.calculateTotalDistance(optimizedRoute),
        summary: this.generateDaySummary(day, allActivities, dayWeather),
        specialEvents: daySpecialEvents
      };
      
      itinerary.push(dayPlan);
    }

    return itinerary;
  }

  selectCheckInPointsForDay(availableCheckInPoints, currentDay, totalDays, weather, targetCount) {
    const minCount = 0;
    const maxCount = 2;
    const actualTarget = Math.min(maxCount, Math.max(minCount, targetCount, availableCheckInPoints.length));
    
    let candidates = [...availableCheckInPoints];

    if (weather) {
      const isBadWeather = this.isBadWeather(weather);
      
      if (isBadWeather) {
        const indoorCheckIn = candidates.filter(c => this.isIndoorAttraction(c));
        const outdoorCheckIn = candidates.filter(c => !this.isIndoorAttraction(c));
        
        if (indoorCheckIn.length > 0) {
          candidates = [...indoorCheckIn, ...outdoorCheckIn];
        }
      }
    }

    candidates = candidates.sort((a, b) => b.score - a.score);

    return candidates.slice(0, actualTarget);
  }

  selectSnacksForDay(snacks, dayActivities, currentDay) {
    if (snacks.length === 0 || dayActivities.length === 0) return [];

    const snacksWithScore = snacks.map(s => {
      let score = 0;
      let minDistance = Infinity;
      
      for (const activity of dayActivities) {
        const distance = this.calculateDistance(
          activity.latitude,
          activity.longitude,
          parseFloat(s.latitude) || 0,
          parseFloat(s.longitude) || 0
        );
        minDistance = Math.min(minDistance, distance);
      }
      
      score += (s.rating || 0) * 10;
      score -= minDistance * 5;
      
      return {
        ...s,
        distance: minDistance,
        score
      };
    });

    const sortedSnacks = snacksWithScore.sort((a, b) => b.score - a.score);
    
    const result = [];
    const usedIds = new Set();
    
    for (const s of sortedSnacks) {
      if (usedIds.has(s.id)) continue;
      if (s.distance > 2) continue;
      
      result.push({
        ...s,
        type: '小吃'
      });
      usedIds.add(s.id);
    }

    return result.slice(0, 3);
  }

  selectDrinksForDay(drinks, dayActivities, currentDay) {
    if (drinks.length === 0 || dayActivities.length === 0) return [];

    const drinksWithScore = drinks.map(d => {
      let score = 0;
      let minDistance = Infinity;
      
      for (const activity of dayActivities) {
        const distance = this.calculateDistance(
          activity.latitude,
          activity.longitude,
          parseFloat(d.latitude) || 0,
          parseFloat(d.longitude) || 0
        );
        minDistance = Math.min(minDistance, distance);
      }
      
      score += (d.rating || 0) * 10;
      score -= minDistance * 5;
      
      return {
        ...d,
        distance: minDistance,
        score
      };
    });

    const sortedDrinks = drinksWithScore.sort((a, b) => b.score - a.score);
    
    const result = [];
    const usedIds = new Set();
    
    for (const d of sortedDrinks) {
      if (usedIds.has(d.id)) continue;
      if (d.distance > 2) continue;
      
      result.push({
        ...d,
        type: '酒饮'
      });
      usedIds.add(d.id);
    }

    return result.slice(0, 2);
  }

  selectAttractionsForDay(availableAttractions, currentDay, totalDays, weather, targetCount) {
    const minPerDay = 3;
    const maxPerDay = 4;
    const actualTarget = Math.min(maxPerDay, Math.max(minPerDay, targetCount, availableAttractions.length));
    
    let candidates = [...availableAttractions];

    if (weather) {
      const isBadWeather = this.isBadWeather(weather);
      
      if (isBadWeather) {
        const indoorAttractions = candidates.filter(a => this.isIndoorAttraction(a));
        const outdoorAttractions = candidates.filter(a => !this.isIndoorAttraction(a));
        
        if (indoorAttractions.length >= 2) {
          candidates = [...indoorAttractions, ...outdoorAttractions];
        }
      }
    }

    candidates = candidates.sort((a, b) => b.score - a.score);

    return candidates.slice(0, actualTarget);
  }

  isBadWeather(weather) {
    if (!weather) return false;
    
    const badWeatherKeywords = ['雨', '雪', '暴雨', '大雨', '雷', '雾', '霾'];
    const dayWeather = (weather.dayWeather || '').toLowerCase();
    const nightWeather = (weather.nightWeather || '').toLowerCase();
    
    return badWeatherKeywords.some(kw => 
      dayWeather.includes(kw) || nightWeather.includes(kw)
    );
  }

  isIndoorAttraction(attraction) {
    const name = attraction.name || '';
    const type = attraction.type || '';
    const allText = `${name} ${type}`.toLowerCase();

    return this.indoorTypes.some(t => allText.includes(t.toLowerCase()));
  }

  selectRestaurantsForDay(restaurants, dayAttractions, currentDay, requirements) {
    if (restaurants.length === 0 || dayAttractions.length === 0) return [];

    const foodPreferences = requirements?.foodPreferences || [];
    const allAttractions = dayAttractions;
    
    const restaurantsWithScore = restaurants.map(r => {
      let score = 0;
      let minDistance = Infinity;
      
      for (const attraction of allAttractions) {
        const distance = this.calculateDistance(
          attraction.latitude,
          attraction.longitude,
          parseFloat(r.latitude) || 0,
          parseFloat(r.longitude) || 0
        );
        minDistance = Math.min(minDistance, distance);
      }
      
      score += (r.rating || 0) * 10;
      score -= minDistance * 3;
      
      if (foodPreferences.length > 0) {
        const restName = String(r.name || '').toLowerCase();
        const restType = String(r.type || '').toLowerCase();
        const allText = `${restName} ${restType}`;
        
        for (const food of foodPreferences) {
          if (allText.includes(food.toLowerCase())) {
            score += 30;
          }
        }
      }
      
      return {
        ...r,
        distance: minDistance,
        score
      };
    });

    const sortedRestaurants = restaurantsWithScore.sort((a, b) => b.score - a.score);
    
    const result = [];
    const usedIds = new Set();
    
    for (const r of sortedRestaurants) {
      if (usedIds.has(r.id)) continue;
      if (r.distance > 3) continue;
      
      result.push({
        ...r,
        mealType: r.distance < 1 ? '午餐推荐' : '晚餐推荐'
      });
      usedIds.add(r.id);
    }

    return result;
  }

  selectGuidesForDay(guides, dayAttractions) {
    if (guides.length === 0) return [];
    
    const attractionNames = dayAttractions.map(a => a.name);
    const relevantGuides = guides.filter(g => {
      const title = (g.title || '').toLowerCase();
      return attractionNames.some(name => title.includes(name.toLowerCase()));
    });
    
    return relevantGuides.length > 0 ? relevantGuides.slice(0, 3) : guides.slice(0, 3);
  }

  recommendHotelsForDay(hotels, dayAttractions, requirements) {
    if (hotels.length === 0) return [];

    const hotelArea = requirements?.hotelArea;
    
    if (hotelArea) {
      const areaHotels = hotels.filter(h => {
        const hotelAddress = String(h.address || '').toLowerCase();
        const hotelBusinessArea = String(h.businessArea || '').toLowerCase();
        return hotelAddress.includes(hotelArea.toLowerCase()) || 
               hotelBusinessArea.includes(hotelArea.toLowerCase());
      });
      
      if (areaHotels.length > 0) {
        return areaHotels.slice(0, 5);
      }
    }

    if (dayAttractions && dayAttractions.length > 0) {
      const allAttractions = dayAttractions;
      const hotelsWithScore = hotels.map(h => {
        let minDistance = Infinity;
        
        for (const attraction of allAttractions) {
          const distance = this.calculateDistance(
            attraction.latitude,
            attraction.longitude,
            parseFloat(h.latitude) || 0,
            parseFloat(h.longitude) || 0
          );
          minDistance = Math.min(minDistance, distance);
        }
        
        return {
          ...h,
          distance: minDistance,
          score: (h.rating || 0) * 10 - minDistance * 2
        };
      });

      return hotelsWithScore
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);
    }

    return hotels.slice(0, 5);
  }

  optimizeRoute(attractions) {
    if (attractions.length <= 2) return attractions;

    const optimized = [attractions[0]];
    const remaining = attractions.slice(1);

    while (remaining.length > 0) {
      const current = optimized[optimized.length - 1];
      
      let nearestIdx = 0;
      let nearestDist = Infinity;

      for (let i = 0; i < remaining.length; i++) {
        const dist = this.calculateDistance(
          current.latitude, current.longitude,
          remaining[i].latitude, remaining[i].longitude
        );
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestIdx = i;
        }
      }

      optimized.push(remaining[nearestIdx]);
      remaining.splice(nearestIdx, 1);
    }

    return optimized;
  }

  getBestTimeSlot(index, attraction, weather) {
    const isIndoor = this.isIndoorAttraction(attraction);
    
    if (weather && this.isBadWeather(weather) && !isIndoor) {
      const indoorSlots = ['中午', '下午'];
      return indoorSlots[index % indoorSlots.length];
    }

    const slots = ['上午', '中午', '下午', '傍晚'];
    return slots[index % slots.length];
  }

  getEstimatedDuration(attraction) {
    const name = attraction.name || '';
    const type = attraction.type || '';
    
    if (name.includes('山') || type.includes('山')) return 4;
    if (name.includes('公园') || type.includes('公园')) return 3;
    if (name.includes('博物馆') || type.includes('博物馆')) return 3;
    if (name.includes('街') || name.includes('广场')) return 2;
    if (name.includes('洲') || name.includes('岛')) return 3;
    
    return 2;
  }

  getTransportInfo(from, to) {
    const distance = this.calculateDistance(
      from.latitude, from.longitude,
      to.latitude, to.longitude
    );

    let transport = '步行';
    let duration = Math.round(distance * 15);

    if (distance > 2) {
      transport = '公交/地铁';
      duration = Math.round(distance * 3 + 10);
    } else if (distance > 0.5) {
      transport = '步行/骑行';
      duration = Math.round(distance * 15);
    }

    return {
      distance: `${Math.round(distance * 10) / 10}公里`,
      transport,
      duration: `${duration}分钟`
    };
  }

  calculateTotalDistance(attractions) {
    if (attractions.length < 2) return 0;

    let total = 0;
    for (let i = 1; i < attractions.length; i++) {
      total += this.calculateDistance(
        attractions[i - 1].latitude,
        attractions[i - 1].longitude,
        attractions[i].latitude,
        attractions[i].longitude
      );
    }

    return Math.round(total * 10) / 10;
  }

  getWeatherAdvice(weather) {
    if (!weather) return null;

    const advices = [];
    const dayWeather = weather.dayWeather || '';
    const dayTemp = parseInt(weather.dayTemp) || 20;
    const nightTemp = parseInt(weather.nightTemp) || 15;

    if (this.isBadWeather(weather)) {
      advices.push('建议携带雨具，多安排室内景点');
    }

    if (dayTemp > 30) {
      advices.push('天气炎热，注意防暑降温');
    } else if (dayTemp < 10) {
      advices.push('天气较冷，注意保暖');
    }

    if (dayTemp - nightTemp > 10) {
      advices.push('昼夜温差大，建议携带外套');
    }

    return advices.length > 0 ? advices.join('；') : '天气适宜出行';
  }

  getDaySpecialEvents(day, specialEvents) {
    if (!specialEvents) return null;
    
    const events = [];
    
    if (specialEvents.fireworks && specialEvents.fireworks.found) {
      events.push({
        type: '烟花表演',
        title: specialEvents.fireworks.title,
        summary: specialEvents.fireworks.summary,
        recommendation: specialEvents.fireworks.recommendation,
        source: specialEvents.fireworks.source
      });
    }
    
    if (specialEvents.others && specialEvents.others.length > 0) {
      for (const event of specialEvents.others.slice(0, 2)) {
        events.push({
          type: '活动',
          title: event.title,
          summary: event.summary,
          source: event.url
        });
      }
    }
    
    return events.length > 0 ? events : null;
  }

  async generateAIRecommendations(attractions, checkInPoints, restaurants, snacks, drinks, hotels, guides, itinerary, requirements, specialEvents) {
    const recommendations = {
      highlights: [],
      tips: [],
      budget: null,
      transportation: null,
      specialNotes: [],
      summary: ''
    };

    const topAttractions = attractions.slice(0, 3);
    const topCheckInPoints = checkInPoints.slice(0, 2);
    const topRestaurants = restaurants.slice(0, 2);
    const topSnacks = snacks.slice(0, 2);
    const topDrinks = drinks.slice(0, 1);

    recommendations.highlights = topAttractions.map(a => ({
      name: a.name,
      reason: this.getHighlightReason(a, requirements),
      rating: a.rating
    }));

    if (topCheckInPoints.length > 0) {
      recommendations.highlights.push(...topCheckInPoints.map(c => ({
        name: c.name,
        reason: '网红打卡地，拍照出片',
        rating: c.rating,
        type: 'checkin'
      })));
    }

    if (topRestaurants.length > 0) {
      recommendations.highlights.push(...topRestaurants.map(r => ({
        name: r.name,
        reason: `评分${r.rating || '未知'}，${r.cuisine || '特色美食'}`,
        rating: r.rating,
        type: 'restaurant'
      })));
    }

    if (topSnacks.length > 0) {
      recommendations.highlights.push(...topSnacks.map(s => ({
        name: s.name,
        reason: '当地特色小吃',
        rating: s.rating,
        type: 'snack'
      })));
    }

    if (topDrinks.length > 0) {
      recommendations.highlights.push(...topDrinks.map(d => ({
        name: d.name,
        reason: '特色饮品/酒吧',
        rating: d.rating,
        type: 'drink'
      })));
    }

    if (requirements.budget) {
      recommendations.budget = this.generateBudgetAdvice(requirements.budget, itinerary);
    }

    recommendations.transportation = this.generateTransportationAdvice(itinerary);

    if (specialEvents?.fireworks) {
      recommendations.specialNotes.push({
        type: '烟花活动',
        content: specialEvents.fireworks.recommendation || '建议提前确认烟花表演时间，安排橘子洲周边夜游行程'
      });
    }

    if (requirements.crowd === '情侣') {
      recommendations.tips.push('推荐傍晚时分游览橘子洲，夜景浪漫适合拍照');
      recommendations.tips.push('五一广场周边有很多氛围好的情侣餐厅');
    }

    if (requirements.constraints?.includes('轻松行程')) {
      recommendations.tips.push('行程安排较为轻松，建议预留充足时间休息');
      recommendations.tips.push('可以选择打车代替公共交通，更加舒适');
    }

    try {
      const dynamicPrompt = aiPromptGenerator.generateDynamicTravelPrompt(requirements);
      recommendations.summary = await this.callQwenAPI([
        { role: 'system', content: '你是旅游行程总结专家，输出简洁友好的总结文字。' },
        { role: 'user', content: dynamicPrompt }
      ]);
    } catch (error) {
      logger.warn(`AI生成总结失败: ${error.message}`);
      recommendations.summary = this.generateSummary(attractions, restaurants, itinerary, requirements);
    }

    return recommendations;
  }

  async generateSummaryWithAI(attractions, restaurants, itinerary, requirements) {
    const prompt = `请为以下旅游行程生成一段简洁的总结（100字以内）：

目的地：长沙
天数：${requirements.days || 3}天
人群：${requirements.crowd || '未指定'}
主要景点：${attractions.slice(0, 5).map(a => a.name).join('、')}
特色餐厅：${restaurants.slice(0, 3).map(r => r.name).join('、')}

请用热情友好的语气，突出行程亮点和特色体验。`;

    try {
      const response = await this.callQwenAPI([
        { role: 'system', content: '你是旅游行程总结专家，输出简洁友好的总结文字。' },
        { role: 'user', content: prompt }
      ]);
      
      return response.trim();
    } catch (error) {
      return this.generateSummary(attractions, restaurants, itinerary, requirements);
    }
  }

  generateSummary(attractions, restaurants, itinerary, requirements) {
    const days = requirements.days || 3;
    const crowd = requirements.crowd || '游客';
    const topAttractions = attractions.slice(0, 3).map(a => a.name).join('、');
    
    return `为您精心规划${days}天${crowd}行程，涵盖${topAttractions}等热门景点，搭配地道美食体验，祝您旅途愉快！`;
  }

  getHighlightReason(attraction, requirements) {
    const reasons = [];
    
    if (attraction.rating >= 4.5) {
      reasons.push('高评分景点');
    }
    
    if (requirements.interests) {
      for (const interest of requirements.interests) {
        const name = (attraction.name || '').toLowerCase();
        const type = (attraction.type || '').toLowerCase();
        
        if (interest === '拍照打卡' && (name.includes('网红') || name.includes('打卡'))) {
          reasons.push('网红打卡地');
        }
        if (interest === '自然风光' && (name.includes('山') || name.includes('洲') || name.includes('公园'))) {
          reasons.push('自然风光优美');
        }
        if (interest === '历史文化' && (name.includes('博物馆') || name.includes('书院') || name.includes('古'))) {
          reasons.push('历史文化底蕴深厚');
        }
      }
    }
    
    return reasons.length > 0 ? reasons.join('，') : '热门推荐景点';
  }

  generateBudgetAdvice(budget, itinerary) {
    const budgetMap = {
      '0-500': { level: '经济', dailyBudget: 150, tips: ['选择免费景点为主', '推荐街边小吃'] },
      '500-1000': { level: '适中', dailyBudget: 300, tips: ['可适当选择收费景点', '推荐性价比餐厅'] },
      '1000-2000': { level: '舒适', dailyBudget: 600, tips: ['景点门票无压力', '可尝试特色餐厅'] },
      '2000+': { level: '豪华', dailyBudget: 1000, tips: ['可体验高端项目', '推荐精品酒店和餐厅'] }
    };
    
    const budgetInfo = budgetMap[budget] || budgetMap['1000-2000'];
    
    return {
      level: budgetInfo.level,
      dailyBudget: budgetInfo.dailyBudget,
      tips: budgetInfo.tips,
      estimatedTotal: budgetInfo.dailyBudget * (itinerary.length || 3)
    };
  }

  generateTransportationAdvice(itinerary) {
    const advice = {
      mainMode: '地铁+步行',
      tips: []
    };
    
    let totalDistance = 0;
    for (const day of itinerary) {
      totalDistance += day.totalDistance || 0;
    }
    
    if (totalDistance > 20) {
      advice.mainMode = '地铁+打车';
      advice.tips.push('行程跨度较大，建议地铁为主，远距离打车');
    } else if (totalDistance > 10) {
      advice.tips.push('建议办理地铁日票，方便出行');
    } else {
      advice.tips.push('景点相对集中，步行+地铁即可');
    }
    
    advice.tips.push('长沙地铁覆盖主要景点，推荐使用地铁出行');
    advice.tips.push('五一广场是交通枢纽，住宿选择此处出行便利');
    
    return advice;
  }

  getDateString(offset) {
    const date = new Date();
    date.setDate(date.getDate() + offset);
    return date.toISOString().split('T')[0];
  }

  generateDaySummary(day, attractions, weather) {
    const count = attractions.length;
    const names = attractions.slice(0, 2).map(a => a.name).join('、');
    const weatherText = weather ? `${weather.dayWeather}，${weather.dayTemp}°C` : '天气未知';
    
    return `第${day}天：游览${count}个景点（${names}等），${weatherText}`;
  }

  async callQwenAPI(messages) {
    const payload = {
      model: 'qwen-turbo',
      input: { messages },
      parameters: {
        result_format: 'message',
        temperature: 0.7,
        max_tokens: 500
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
}

module.exports = new DataIntegrationService();
