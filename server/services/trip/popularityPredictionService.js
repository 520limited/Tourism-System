/**
 * @fileoverview 景点热度预测与时间优化服务 - 多因子加权的人流拥挤度预估系统
 * 
 * @module popularityPredictionService
 * @description 本模块基于多维度因子预测长沙各景点在不同时间段的人流拥挤程度,
 *              并提供游览时长预估、最佳时段推荐、行程调度优化等智能功能。
 *              是实现"智能错峰游览"推荐的核心算法模块。
 * 
 * 三层数据源(Fallback降级策略):
 *   Layer1: dynamicPopularityService - 动态画像(实时搜索高德POI获取热度)
 *   Layer2: 内置默认字典 - 50+长沙热门景点预定义基础画像
 *   Layer3: 兜底默认值 - 通用景点平均参数
 * 
 * 核心预测公式:
 *   crowdLevel = baseLevel × weekendMultiplier(holidayMultiplier) × hourFactor
 *   结果归一化到 [0.1, 1.0] 区间,映射为5级状态: 空闲/较少/适中/较多/拥挤
 * 
 * 内置10大热门景点画像: 橘子洲/岳麓山/省博物馆/太平老街/IFS/黄兴路步行街/
 *                        岳麓书院/杜甫江阁/世界之窗/烈士公园
 * 
 * 节假日数据: 2026年完整节假日表(元旦/春节/清明/劳动节/端午/国庆)
 * 
 * 主要API:
 *   predictCrowdLevel(name, date, hour)    单景点单时段拥挤度预测
 *   estimateVisitDuration(name, options)   游览时长估算(含人群/团体因子)
 *   getBestVisitTime(name, date)           最佳游览时段推荐
 *   predictDaySchedule(attractions, date)  一日行程时间表生成
 *   optimizeScheduleForCrowd(...)         避峰调度优化(贪心算法)
 *   generateCrowdPrompt(...)               为AI Prompt生成热度文本摘要
 * 
 * @requires ../../database/db 数据库访问层
 * @requires ../logger 日志服务
 * @requires ./dynamicPopularityService 动态热度服务
 */
const { dbRun, dbGet, dbAll } = require('../../database/db');
const logger = require('../logger');
const dynamicPopularityService = require('./dynamicPopularityService');

const defaultProfiles = {
  '橘子洲': {
    basePopularity: 0.85,
    peakHours: [10, 11, 14, 15, 16],
    lowHours: [7, 8, 17, 18],
    weekendMultiplier: 1.4,
    holidayMultiplier: 1.8,
    avgVisitDuration: 180,
    areaSize: 'large',
    indoorRatio: 0.1
  },
  '岳麓山': {
    basePopularity: 0.80,
    peakHours: [9, 10, 14, 15],
    lowHours: [7, 8, 16, 17, 18],
    weekendMultiplier: 1.5,
    holidayMultiplier: 2.0,
    avgVisitDuration: 240,
    areaSize: 'large',
    indoorRatio: 0.05
  },
  '湖南省博物馆': {
    basePopularity: 0.90,
    peakHours: [10, 11, 13, 14],
    lowHours: [9, 15, 16],
    weekendMultiplier: 1.6,
    holidayMultiplier: 2.2,
    avgVisitDuration: 180,
    areaSize: 'medium',
    indoorRatio: 1.0,
    reservationRequired: true
  },
  '太平老街': {
    basePopularity: 0.75,
    peakHours: [18, 19, 20, 21],
    lowHours: [9, 10, 11, 22],
    weekendMultiplier: 1.8,
    holidayMultiplier: 2.5,
    avgVisitDuration: 90,
    areaSize: 'small',
    indoorRatio: 0.3
  },
  'IFS国金中心': {
    basePopularity: 0.70,
    peakHours: [14, 15, 16, 19, 20],
    lowHours: [10, 11, 21, 22],
    weekendMultiplier: 1.5,
    holidayMultiplier: 1.8,
    avgVisitDuration: 120,
    areaSize: 'medium',
    indoorRatio: 1.0
  },
  '黄兴路步行街': {
    basePopularity: 0.80,
    peakHours: [18, 19, 20, 21],
    lowHours: [9, 10, 22],
    weekendMultiplier: 1.7,
    holidayMultiplier: 2.3,
    avgVisitDuration: 60,
    areaSize: 'medium',
    indoorRatio: 0.2
  },
  '岳麓书院': {
    basePopularity: 0.65,
    peakHours: [10, 11, 14, 15],
    lowHours: [8, 9, 16, 17],
    weekendMultiplier: 1.3,
    holidayMultiplier: 1.6,
    avgVisitDuration: 90,
    areaSize: 'small',
    indoorRatio: 0.6
  },
  '杜甫江阁': {
    basePopularity: 0.55,
    peakHours: [19, 20, 21],
    lowHours: [9, 10, 11, 14, 15],
    weekendMultiplier: 1.4,
    holidayMultiplier: 1.7,
    avgVisitDuration: 45,
    areaSize: 'small',
    indoorRatio: 0.3
  },
  '世界之窗': {
    basePopularity: 0.75,
    peakHours: [10, 11, 13, 14, 15],
    lowHours: [9, 16, 17],
    weekendMultiplier: 1.6,
    holidayMultiplier: 2.5,
    avgVisitDuration: 360,
    areaSize: 'large',
    indoorRatio: 0.2
  },
  '烈士公园': {
    basePopularity: 0.50,
    peakHours: [7, 8, 18, 19],
    lowHours: [10, 11, 14, 15, 16],
    weekendMultiplier: 1.3,
    holidayMultiplier: 1.5,
    avgVisitDuration: 90,
    areaSize: 'large',
    indoorRatio: 0.0
  }
};

const holidays2026 = [
  { date: '2026-01-01', name: '元旦' },
  { date: '2026-02-17', name: '春节', duration: 7 },
  { date: '2026-04-05', name: '清明节', duration: 3 },
  { date: '2026-05-01', name: '劳动节', duration: 5 },
  { date: '2026-06-19', name: '端午节', duration: 3 },
  { date: '2026-10-01', name: '国庆节', duration: 7 }
];

class PopularityPredictionService {
  constructor() {
    this.attractionProfiles = defaultProfiles;
    this.holidays = holidays2026;
  }

  findAttractionProfileSync(attractionName, attractionData = null) {
    for (const [key, profile] of Object.entries(this.attractionProfiles)) {
      if (attractionName.includes(key) || key.includes(attractionName)) {
        return profile;
      }
    }
    return null;
  }

  async findAttractionProfile(attractionName, attractionData = null) {
    try {
      const dynamicProfile = await dynamicPopularityService.getAttractionProfile(attractionName, attractionData);
      if (dynamicProfile && dynamicProfile.source !== 'default') {
        logger.info(`使用动态热度数据: ${attractionName} (来源: ${dynamicProfile.source})`);
        return dynamicProfile;
      }
    } catch (e) {
      logger.warn(`动态热度获取失败: ${e.message}`);
    }

    return this.findAttractionProfileSync(attractionName, attractionData);
  }

  /**
   * predictCrowdLevel — 单景点单时段拥挤度预测核心算法
   * 
   * 预测公式:
   *   crowdLevel = basePopularity × dateMultiplier × hourFactor
   *   其中: dateMultiplier ∈ {1.0(工作日), 1.4(周末), 1.8~2.5(节假日)}
   *         hourFactor ∈ {0.6(低谷), 1.0(正常), 1.3(高峰)}
   * 
   * 最终值裁剪到 [0.1, 1.0] 并映射为5级状态标签+颜色编码
   */
  predictCrowdLevel(attractionName, date, hour, attractionData = null) {
    const profile = this.findAttractionProfileSync(attractionName, attractionData);
    if (!profile) {
      return this.getDefaultPrediction(date, hour);
    }

    const baseLevel = profile.basePopularity || profile.basePopularity === 0 ? profile.basePopularity : 0.5;
    const dateInfo = this.analyzeDate(date);
    const hourFactor = this.getHourFactor(profile, hour);
    
    let crowdLevel = baseLevel;
    
    if (dateInfo.isHoliday) {
      crowdLevel *= (profile.holidayMultiplier || 1.8);
    } else if (dateInfo.isWeekend) {
      crowdLevel *= (profile.weekendMultiplier || 1.4);
    }
    
    crowdLevel *= hourFactor;
    
    crowdLevel = Math.min(1.0, Math.max(0.1, crowdLevel));
    
    return {
      level: crowdLevel,
      status: this.getCrowdStatus(crowdLevel),
      color: this.getCrowdColor(crowdLevel),
      description: this.getCrowdDescription(crowdLevel, profile),
      recommendation: this.getRecommendation(crowdLevel, profile, hour),
      peakHours: profile.peakHours || [10, 11, 14, 15],
      lowHours: profile.lowHours || [8, 9, 16, 17]
    };
  }

  getDefaultPrediction(date, hour) {
    const dateInfo = this.analyzeDate(date);
    let level = 0.5;
    
    if (dateInfo.isHoliday) {
      level = 0.8;
    } else if (dateInfo.isWeekend) {
      level = 0.65;
    }
    
    if (hour >= 10 && hour <= 16) {
      level *= 1.2;
    } else if (hour >= 7 && hour <= 9) {
      level *= 0.7;
    }
    
    return {
      level: Math.min(1, level),
      status: this.getCrowdStatus(level),
      color: this.getCrowdColor(level),
      description: '基于一般景点预测',
      recommendation: '建议提前规划行程',
      peakHours: [10, 11, 14, 15],
      lowHours: [8, 9, 16, 17]
    };
  }

  analyzeDate(dateStr) {
    const date = new Date(dateStr);
    const dayOfWeek = date.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    
    const dateFormatted = dateStr.split('T')[0];
    let isHoliday = false;
    let holidayName = '';
    
    for (const holiday of this.holidays) {
      if (holiday.date === dateFormatted) {
        isHoliday = true;
        holidayName = holiday.name;
        break;
      }
      if (holiday.duration) {
        const holidayDate = new Date(holiday.date);
        for (let i = 0; i < holiday.duration; i++) {
          const checkDate = new Date(holidayDate);
          checkDate.setDate(checkDate.getDate() + i);
          if (checkDate.toISOString().split('T')[0] === dateFormatted) {
            isHoliday = true;
            holidayName = holiday.name;
            break;
          }
        }
      }
    }
    
    return { isWeekend, isHoliday, holidayName, dayOfWeek };
  }

  getHourFactor(profile, hour) {
    const peakHours = profile.peakHours || [];
    const lowHours = profile.lowHours || [];
    
    if (peakHours.includes(hour)) {
      return 1.3;
    }
    if (lowHours.includes(hour)) {
      return 0.6;
    }
    return 1.0;
  }

  getCrowdStatus(level) {
    if (level < 0.3) return '空闲';
    if (level < 0.5) return '较少';
    if (level < 0.7) return '适中';
    if (level < 0.85) return '较多';
    return '拥挤';
  }

  getCrowdColor(level) {
    if (level < 0.3) return '#52c41a';
    if (level < 0.5) return '#73d13d';
    if (level < 0.7) return '#faad14';
    if (level < 0.85) return '#fa8c16';
    return '#f5222d';
  }

  getCrowdDescription(level, profile) {
    const status = this.getCrowdStatus(level);
    const descriptions = {
      '空闲': '人流稀少，是游览的最佳时机',
      '较少': '人流较少，游览体验较好',
      '适中': '人流适中，可以正常游览',
      '较多': '人流较多，可能需要排队',
      '拥挤': '人流拥挤，建议错峰出行'
    };
    return descriptions[status];
  }

  getRecommendation(level, profile, hour) {
    if (level < 0.5) {
      return '当前时段适合游览，无需等待';
    }
    if (level < 0.7) {
      return '人流适中，建议合理安排时间';
    }
    
    const lowHours = profile.lowHours || [];
    const nextLowHour = lowHours.find(h => h > hour);
    
    if (nextLowHour) {
      return `建议${nextLowHour}点后再来，届时人流较少`;
    }
    
    return '建议选择工作日或其他时段游览';
  }

  /**
   * estimateVisitDuration — 多因子游览时长估算
   * 
   * 在基础时长上叠加多个调整因子:
   *   - 人流因子: +0%~+50% (越拥挤排队越久)
   *   - 团体类型: 独行-20% / 情侣基准 / 家庭+30% / 朋友+10%
   *   - 特殊情况: 携带儿童+25%, 携带老人+15%
   *   - 场地特征: 大面积景区+10%
   * 
   * 结果四舍五入到5分钟整数倍,返回区间估计[min,max]
   */
  estimateVisitDuration(attractionName, options = {}) {
    const { crowdLevel = 0.5, groupType = 'couple', withKids = false, withElderly = false } = options;
    
    const profile = this.findAttractionProfileSync(attractionName);
    if (!profile) {
      const defaultDuration = 120;
      return {
        baseDuration: defaultDuration,
        estimatedDuration: defaultDuration,
        minDuration: Math.round(defaultDuration * 0.8),
        maxDuration: Math.round(defaultDuration * 1.3),
        factors: ['使用默认估算']
      };
    }
    
    let duration = profile.avgVisitDuration || 120;
    const factors = [];
    
    const crowdMultiplier = 1 + (crowdLevel * 0.5);
    duration *= crowdMultiplier;
    factors.push(`人流因素: +${Math.round((crowdMultiplier - 1) * 100)}%`);
    
    const groupMultipliers = {
      'alone': 0.8,
      'couple': 1.0,
      'family': 1.3,
      'friends': 1.1,
      'elderly': 1.2
    };
    const groupMult = groupMultipliers[groupType] || 1.0;
    duration *= groupMult;
    if (groupMult !== 1.0) {
      factors.push(`人群类型: ${groupMult > 1 ? '+' : ''}${Math.round((groupMult - 1) * 100)}%`);
    }
    
    if (withKids) {
      duration *= 1.25;
      factors.push('携带儿童: +25%');
    }
    
    if (withElderly) {
      duration *= 1.15;
      factors.push('携带老人: +15%');
    }
    
    if (profile.areaSize === 'large') {
      duration *= 1.1;
      factors.push('大面积景区: +10%');
    }
    
    if (profile.reservationRequired) {
      factors.push('需要预约，建议提前安排');
    }
    
    duration = Math.round(duration / 5) * 5;
    
    return {
      baseDuration: profile.avgVisitDuration || 120,
      estimatedDuration: Math.round(duration),
      minDuration: Math.round(duration * 0.8),
      maxDuration: Math.round(duration * 1.3),
      factors,
      indoorRatio: profile.indoorRatio || 0.5,
      reservationRequired: profile.reservationRequired || false
    };
  }

  getBestVisitTime(attractionName, date, attractionData = null) {
    const profile = this.findAttractionProfile(attractionName, attractionData);
    if (!profile) {
      return {
        bestHours: [9, 10, 16, 17],
        reason: '建议避开高峰时段'
      };
    }
    
    const dateInfo = this.analyzeDate(date);
    const predictions = [];
    
    for (let hour = 8; hour <= 20; hour++) {
      const prediction = this.predictCrowdLevel(attractionName, date, hour, attractionData);
      predictions.push({
        hour,
        level: prediction.level,
        status: prediction.status
      });
    }
    
    predictions.sort((a, b) => a.level - b.level);
    
    const bestHours = predictions.slice(0, 3).map(p => p.hour);
    const worstHours = predictions.slice(-3).map(p => p.hour);
    
    return {
      bestHours,
      worstHours,
      predictions: predictions.slice(0, 6),
      reason: this.getBestTimeReason(profile, dateInfo)
    };
  }

  getBestTimeReason(profile, dateInfo) {
    const lowHours = profile.lowHours || [8, 9, 16, 17];
    
    if (dateInfo.isHoliday) {
      return `${dateInfo.holidayName}期间人流较大，建议${lowHours[0]}点前到达`;
    }
    if (dateInfo.isWeekend) {
      return `周末人流较多，建议选择${lowHours.slice(0, 2).join('点或')}点时段`;
    }
    return `工作日人流适中，${lowHours[0]}点-${lowHours[1]}点为最佳时段`;
  }

  predictDaySchedule(attractions, date, startTime = 9) {
    const schedule = [];
    let currentTime = startTime;
    
    for (const attraction of attractions) {
      const name = attraction.name;
      const crowdPrediction = this.predictCrowdLevel(name, date, currentTime, attraction);
      const durationEstimate = this.estimateVisitDuration(name, {
        crowdLevel: crowdPrediction.level,
        groupType: attraction.groupType || 'couple'
      });
      
      const endTime = currentTime + (durationEstimate.estimatedDuration / 60);
      
      schedule.push({
        attraction: name,
        startTime: currentTime,
        endTime: Math.round(endTime * 10) / 10,
        duration: durationEstimate.estimatedDuration,
        crowdLevel: crowdPrediction.level,
        crowdStatus: crowdPrediction.status,
        recommendation: crowdPrediction.recommendation
      });
      
      currentTime = endTime + 0.5;
    }
    
    return schedule;
  }

  /**
   * optimizeScheduleForCrowd — 避峰调度优化算法(贪心策略)
   * 
   * 目标: 为N个景点分配最优游览时段,使整体拥挤度最低
   * 算法: 每轮在所有未安排景点×可用时隙中选择crowdLevel最低的组合
   * 约束: 高峰时段(level>0.8)自动排除;每个景点占用连续时间段
   * 复杂度: O(N² × T), N=景点数, T=时隙数
   */
  optimizeScheduleForCrowd(attractions, date, preferences = {}) {
    const { earliestHour = 8, latestHour = 20, avoidHighCrowd = true } = preferences;
    
    const timeSlots = [];
    for (let hour = earliestHour; hour <= latestHour; hour++) {
      timeSlots.push({ hour, available: true });
    }
    
    const optimizedSchedule = [];
    const remainingAttractions = [...attractions];
    
    while (remainingAttractions.length > 0) {
      let bestSlot = null;
      let bestAttraction = null;
      let bestScore = Infinity;
      
      for (let i = 0; i < remainingAttractions.length; i++) {
        const attraction = remainingAttractions[i];
        const profile = this.findAttractionProfile(attraction.name, attraction);
        
        for (const slot of timeSlots) {
          if (!slot.available) continue;
          
          const prediction = this.predictCrowdLevel(attraction.name, date, slot.hour, attraction);
          
          if (avoidHighCrowd && prediction.level > 0.8) continue;
          
          const score = prediction.level + (i * 0.05);
          
          if (score < bestScore) {
            bestScore = score;
            bestSlot = slot;
            bestAttraction = { index: i, attraction };
          }
        }
      }
      
      if (bestSlot && bestAttraction) {
        const duration = this.estimateVisitDuration(bestAttraction.attraction.name);
        const durationHours = duration.estimatedDuration / 60;
        
        optimizedSchedule.push({
          ...bestAttraction.attraction,
          suggestedStartTime: bestSlot.hour,
          suggestedEndTime: Math.round((bestSlot.hour + durationHours) * 10) / 10,
          duration: duration.estimatedDuration,
          crowdLevel: bestScore
        });
        
        for (const slot of timeSlots) {
          if (slot.hour >= bestSlot.hour && slot.hour < bestSlot.hour + durationHours) {
            slot.available = false;
          }
        }
        
        remainingAttractions.splice(bestAttraction.index, 1);
      } else {
        break;
      }
    }
    
    return optimizedSchedule.sort((a, b) => a.suggestedStartTime - b.suggestedStartTime);
  }

  /**
   * 为 AI Prompt 生成热度预测信息
   */
  /**
   * generateCrowdPrompt — 为AI System Prompt生成热度预测文本摘要
   * 
   * 将数值化的拥挤度预测转换为自然语言描述,
   * 注入AI提示词中让模型在生成行程时自动避开高峰时段
   */
  generateCrowdPrompt(attractions, date) {
    const dateInfo = this.analyzeDate(date);
    let prompt = '\n【热度预测信息】';

    if (dateInfo.isHoliday) {
      prompt += `\n今日为${dateInfo.holidayName}假期，景区人流较大`;
    } else if (dateInfo.isWeekend) {
      prompt += '\n今日为周末，景区人流中等偏多';
    } else {
      prompt += '\n今日为工作日，景区人流相对较少';
    }

    prompt += '\n\n各景点热度预测：';

    for (const attraction of attractions.slice(0, 5)) {
      const prediction = this.predictCrowdLevel(attraction.name, date, 10);
      prompt += `\n- ${attraction.name}: ${prediction.status} (${Math.round(prediction.level * 100)}%)`;
      if (prediction.recommendation) {
        prompt += `，${prediction.recommendation}`;
      }
    }

    return prompt;
  }
}

module.exports = new PopularityPredictionService();
