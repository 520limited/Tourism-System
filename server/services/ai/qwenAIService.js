/**
 * @fileoverview 通义千问AI服务封装 - 行程生成、对话交互、智能推荐的统一接口层
 * 
 * @module qwenAIService
 * @description 本模块是对阿里云通义千问(Qwen)大模型API的完整封装,是整个系统的"AI大脑",
 *              负责将用户自然语言转化为结构化行程数据。所有AI能力均通过此模块对外提供服务。
 * 
 * 三大核心功能:
 * 
 *   ════════════════════════════════════════════════════════
 *   功能一: generateTripFromNaturalLanguage() — AI行程生成(主入口)
 *   ════════════════════════════════════════════════════════
 *   输入: 用户自然语言需求 + 对话历史 + 天气数据 + 用户ID
 *   处理流程:
 *     ① 构造System Prompt(注入天气/日期/用户偏好画像等上下文)
 *     ② 拼接对话历史(最近10轮,保持上下文连贯)
 *     ③ 调用Qwen API (temperature=0.8, 平衡创造性与稳定性)
 *     ④ 解析JSON响应(含中文引号修复/换行符转义/尾逗号清理等多重容错)
 *     ⑤ 增强行程数据(附加热度预测/游览时长/最佳时段等智能字段)
 *   输出: { message, requirements, activities, itinerary[], ready }
 * 
 *   ════════════════════════════════════════════════════════
 *   功能二: chat() — 多轮对话调整(行程修改助手)
 *   ════════════════════════════════════════════════════════
 *   角色设定: "小沙" - 长沙旅游规划助手人格
 *   支持意图: 换景点/调餐饮/改酒店/增减天数等调整指令
 *   输出: { message, adjustmentType, requirements }
 * 
 *   ════════════════════════════════════════════════════════
 *   功能三: generateRecommendations() — "换一批"智能推荐
 *   ════════════════════════════════════════════════════════
 *   场景: 用户不满意当前推荐时请求替换
 *   能力:
 *     - 自动排除已存在的地点名称(去重)
 *     - 支持地理坐标上下文(推荐附近地点)
 *     - 支持分类过滤(湘菜/小吃/西餐; 3星/4星/5星酒店)
 *     - all模式自动覆盖多类别确保多样性
 *   类型: attractions / restaurants / hotels
 * 
 * JSON解析容错体系(三级防御):
 *   Level1: preprocessJSON() - 中文标点替换(引号/冒号/逗号)
 *   Level2: fixJSON() - 深度修复(换行转义/尾逗号/缺逗号/数字去引号)
 *   Level3: 兜底返回 error:true 让上层优雅降级
 * 
 * API配置: 通过环境变量 QWEN_API_KEY / QWEN_API_URL / QWEN_MODEL 配置
 * 默认模型: qwen-plus, 兼容OpenAI接口协议
 * 
 * @requires axios HTTP客户端
 * @requires ../logger 日志服务
 * @requires ../user/preferenceLearningService 用户偏好服务(注入AI提示词)
 * @requires ../trip/popularityPredictionService 热度预测服务(增强行程数据)
 */
const axios = require('axios');
const logger = require('../logger');
const preferenceLearningService = require('../user/preferenceLearningService');
const popularityPredictionService = require('../trip/popularityPredictionService');

class QwenAIService {
  constructor() {
    this.apiKey = process.env.QWEN_API_KEY
    this.baseUrl = process.env.QWEN_API_URL || 'https://dashscope.aliyuncs.com/api/v2/apps/protocols/compatible-mode/v1';
    this.model = process.env.QWEN_MODEL || 'qwen-plus';
  }

  /**
   * generateTripFromNaturalLanguage — AI行程生成主入口(最核心方法)
   * 
   * 完整处理链路:
   *   ┌────────────────────────────────────────────────────┐
   *   │ 1. 构造上下文增强System Prompt                      │
   *   │    ├─ 天气信息(实况+预报)                            │
   *   │    ├─ 用户偏好画像(generatePreferencePrompt)         │
   *   │    └─ 日期特殊提示(节假日/周末人流警告)              │
   *   │ 2. 拼接消息数组(system + 最近10轮历史 + 当前输入)    │
   *   │ 3. callAPI → 发送至通义千问大模型                    │
   *   │ 4. parseTripResponse → JSON解析(含容错修复)          │
   *   │ 5. enhanceWithPopularityData → 附加热度预测字段       │
   *   │ 6. 返回结构化行程结果                                │
   *   └────────────────────────────────────────────────────┘
   * 
   * @param {string} userMessage 用户自然语言输入
   * @param {Array} conversationHistory 对话历史[{role,content}]
   * @param {Object|null} weatherData 天气数据(chat接口预获取)
   * @param {string|null} userId 用户ID(加载偏好画像)
   */
  async generateTripFromNaturalLanguage(userMessage, conversationHistory = [], weatherData = null, userId = null) {
    let weatherInfo = '';
    if (weatherData) {
      const now = weatherData.now;
      const forecast = weatherData.forecast || [];
      weatherInfo = `\n【天气】当前${now.temperature}°C，${now.weather}`;
      forecast.slice(0, 5).forEach(f => {
        weatherInfo += `；${f.date} ${f.dayWeather}${f.dayTemp}°C`;
      });
    }

    let preferencePrompt = '';
    if (userId) {
      try {
        preferencePrompt = await preferenceLearningService.generatePreferencePrompt(userId);
      } catch (e) {
        logger.warn(`获取用户偏好失败: ${e.message}`);
      }
    }

    const today = new Date().toISOString().split('T')[0];
    const dateInfo = popularityPredictionService.analyzeDate(today);
    let datePrompt = '';
    if (dateInfo.isHoliday) {
      datePrompt = `\n【今日特殊】${dateInfo.holidayName}假期，景区人流较大，建议提前预约`;
    } else if (dateInfo.isWeekend) {
      datePrompt = '\n【今日提示】周末人流中等偏多，建议错峰游览';
    }

    const systemPrompt = `你是长沙旅游规划专家。直接返回JSON行程，不要确认。
${weatherInfo}${preferencePrompt}${datePrompt}
雨天优先室内景点（如博物馆、商场），晴天可户外（所有地点只限长沙）。
${preferencePrompt ? '根据用户偏好画像调整推荐内容，优先推荐用户偏好的景点类型、菜系和酒店档次。' : ''}

返回格式(如果用户未给出具体日期默认从次日开始)：
{"message":"行程简介","requirements":{"days":3.23,"crowd":"情侣","budget":"1000-2000","interests":["美食"],"hotelArea":"五一广场"},"activities":["特殊活动"],"itinerary":[{"day":3.23,"title":"第一天","attractions":[{"name":"景点名","type":"类型","rating":4.8,"description":"描述","address":"地址","latitude":28.17,"longitude":112.96,"ticketPrice":0,"estimatedDuration":2,"bestTime":"上午"}],"restaurants":[{"name":"餐厅名","cuisine":"湘菜","rating":4.7,"avgPrice":80,"address":"地址","latitude":28.19,"longitude":112.97,"specialty":"招牌菜"}],"hotels":[{"name":"酒店名","starRating":3,"rating":4.5,"pricePerNight":280,"address":"地址","latitude":28.19,"longitude":112.97}]}]}

规则：每天至少3景点（优先根据用户需求理解），3餐厅3酒店随机；坐标准确价格真实；就近安排；提取用户特殊活动到activities字段；根据热度预测合理安排游览时间，避开高峰时段`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.slice(-10)
    ];

    const lastMessage = conversationHistory[conversationHistory.length - 1];
    if (!lastMessage || lastMessage.role !== 'user' || lastMessage.content !== userMessage) {
      messages.push({ role: 'user', content: userMessage });
    }

    try {
      logger.info(`=== AI生成行程请求 ===`);
      logger.info(`用户输入: ${userMessage}`);
      logger.info(`历史消息数: ${conversationHistory.length}`);
      if (preferencePrompt) {
        logger.info(`已加载用户偏好画像`);
      }

      const aiResponse = await this.callAPI(messages);

      logger.info(`=== AI返回内容 ===`);
      logger.info(aiResponse);

      const result = this.parseTripResponse(aiResponse);

      if (result.itinerary && result.itinerary.length > 0) {
        result.itinerary = this.enhanceWithPopularityData(result.itinerary);
      }

      logger.info(`AI生成完成: ${result.itinerary ? result.itinerary.length + '天行程' : '未完成'}`);

      return result;
    } catch (error) {
      logger.error(`AI生成行程失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * enhanceWithPopularityData — 为AI生成的行程附加热度预测和时长估算
   * 
   * 在AI返回的基础行程上追加智能字段:
   *   - crowdPrediction: {level,status,color,recommendation}
   *   - smartDuration: {estimated,min,max,factors}
   *   - suggestedTime / bestTimeReason: 高峰景点的最佳时段建议
   *   - date: 自动计算每天的日期(基于今天+偏移量)
   * 
   * 这些额外信息让前端能够展示更丰富的智能推荐内容
   */
  enhanceWithPopularityData(itinerary) {
    const today = new Date();

    for (let dayIdx = 0; dayIdx < itinerary.length; dayIdx++) {
      const day = itinerary[dayIdx];

      // 添加日期
      if (!day.date) {
        const date = new Date(today);
        date.setDate(date.getDate() + dayIdx);
        day.date = date.toISOString().split('T')[0];
      }

      if (day.attractions && day.attractions.length > 0) {
        for (let i = 0; i < day.attractions.length; i++) {
          const attr = day.attractions[i];
          const suggestedHour = 9 + i * 3;

          const prediction = popularityPredictionService.predictCrowdLevel(attr.name, today.toISOString().split('T')[0], suggestedHour);
          const duration = popularityPredictionService.estimateVisitDuration(attr.name, {
            crowdLevel: prediction.level
          });

          attr.crowdPrediction = {
            level: prediction.level,
            status: prediction.status,
            color: prediction.color,
            recommendation: prediction.recommendation
          };

          attr.smartDuration = {
            estimated: duration.estimatedDuration,
            min: duration.minDuration,
            max: duration.maxDuration,
            factors: duration.factors
          };

          if (!attr.estimatedDuration || attr.estimatedDuration < 30) {
            attr.estimatedDuration = Math.round(duration.estimatedDuration / 60);
          }

          if (prediction.level > 0.7 && !attr.bestTime) {
            const bestTime = popularityPredictionService.getBestVisitTime(attr.name, today.toISOString().split('T')[0]);
            if (bestTime.bestHours && bestTime.bestHours.length > 0) {
              attr.suggestedTime = `${bestTime.bestHours[0]}:00`;
              attr.bestTimeReason = bestTime.reason;
            }
          }
        }
      }
    }

    return itinerary;
  }

  /**
   * 解析AI返回的行程数据
   */
  /**
   * parseTripResponse — AI响应JSON解析(含三级容错机制)
   * 
   * AI返回的文本中提取JSON的三级防御:
   *   Level1: 正则提取{}块 → JSON.parse
   *   Level2: preprocessJSON → 中文标点替换 → 重试parse
   *   Level3: fixJSON → 深度修复(换行/尾逗号/缺逗号) → 最后尝试
   *   全部失败 → 返回error:true让上层优雅降级
   */
  parseTripResponse(aiResponse) {
    try {
      // 尝试提取JSON
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        let jsonStr = jsonMatch[0];

        // 预处理：修复中文引号和其他常见问题
        jsonStr = this.preprocessJSON(jsonStr);

        // 尝试解析JSON
        try {
          const data = JSON.parse(jsonStr);

          // 输出解析后的数据摘要
          logger.info(`解析成功 - 需求: ${JSON.stringify(data.requirements || {})}`);
          logger.info(`解析成功 - activities: ${JSON.stringify(data.activities || [])}`);
          logger.info(`解析成功 - 行程天数: ${data.itinerary ? data.itinerary.length : 0}`);
          if (data.itinerary && data.itinerary.length > 0) {
            const firstDay = data.itinerary[0];
            logger.info(`第一天景点数: ${firstDay.attractions ? firstDay.attractions.length : 0}`);
            logger.info(`第一天餐厅数: ${firstDay.restaurants ? firstDay.restaurants.length : 0}`);
            logger.info(`第一天酒店数: ${firstDay.hotels ? firstDay.hotels.length : 0}`);
          }

          return {
            message: data.message || '行程已生成',
            requirements: data.requirements || {},
            activities: data.activities || [],
            itinerary: data.itinerary || [],
            ready: true
          };
        } catch (parseError) {
          // JSON解析失败，尝试修复
          logger.warn(`JSON解析失败，尝试修复: ${parseError.message}`);
          logger.warn(`问题位置附近内容: ${jsonStr.substring(Math.max(0, 270), 300)}`);

          // 尝试修复常见的JSON错误
          jsonStr = this.fixJSON(jsonStr);

          try {
            const data = JSON.parse(jsonStr);
            logger.info(`JSON修复成功`);

            return {
              message: data.message || '行程已生成',
              requirements: data.requirements || {},
              activities: data.activities || [],
              itinerary: data.itinerary || [],
              ready: true
            };
          } catch (fixError) {
            logger.error(`JSON修复失败: ${fixError.message}`);
          }
        }
      }
    } catch (error) {
      logger.error(`JSON解析失败: ${error.message}`);
      logger.error(`AI响应: ${aiResponse.substring(0, 500)}`);
    }

    // 解析失败，返回错误
    return {
      message: '行程生成失败，请重试',
      requirements: {},
      itinerary: [],
      ready: false,
      error: true
    };
  }

  /**
   * 预处理JSON字符串
   */
  preprocessJSON(jsonStr) {
    // 1. 替换中文引号为英文引号
    jsonStr = jsonStr.replace(/[""]/g, '"');

    // 2. 替换中文冒号为英文冒号
    jsonStr = jsonStr.replace(/：/g, ':');

    // 3. 替换中文逗号为英文逗号（在JSON结构中）
    // 注意：不要替换字符串内部的中文逗号
    let result = '';
    let inString = false;
    let escaped = false;

    for (let i = 0; i < jsonStr.length; i++) {
      const char = jsonStr[i];

      if (!inString) {
        if (char === '"') {
          inString = true;
        }
        // 在JSON结构中替换中文逗号
        if (char === '，') {
          result += ',';
        } else {
          result += char;
        }
      } else {
        if (escaped) {
          result += char;
          escaped = false;
        } else if (char === '\\') {
          result += char;
          escaped = true;
        } else if (char === '"') {
          inString = false;
          result += char;
        } else {
          // 字符串内部保持原样
          result += char;
        }
      }
    }

    return result;
  }

  /**
   * 修复常见的JSON格式错误
   */
  fixJSON(jsonStr) {
    logger.info(`开始修复JSON，原始长度: ${jsonStr.length}`);

    // 1. 首先尝试找到最外层的大括号
    const firstBrace = jsonStr.indexOf('{');
    const lastBrace = jsonStr.lastIndexOf('}');

    if (firstBrace === -1 || lastBrace === -1 || firstBrace >= lastBrace) {
      logger.error('无法找到有效的JSON边界');
      return jsonStr;
    }

    // 提取核心JSON内容
    jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);

    // 2. 修复字符串中的特殊字符（在属性值中）
    // 先保护已经正确转义的字符
    const placeholder = '\u0000';
    const protectedChars = [];

    // 保护已经转义的字符
    jsonStr = jsonStr.replace(/\\"/g, (match) => {
      protectedChars.push(match);
      return placeholder + (protectedChars.length - 1) + placeholder;
    });

    // 保护 Unicode 转义序列
    jsonStr = jsonStr.replace(/\\u[0-9a-fA-F]{4}/g, (match) => {
      protectedChars.push(match);
      return placeholder + (protectedChars.length - 1) + placeholder;
    });

    // 3. 修复字符串中的换行符和制表符（只在字符串值中）
    let inString = false;
    let escaped = false;
    let result = '';

    for (let i = 0; i < jsonStr.length; i++) {
      const char = jsonStr[i];
      const nextChar = jsonStr[i + 1];

      if (!inString) {
        if (char === '"') {
          inString = true;
        }
        result += char;
      } else {
        if (escaped) {
          result += char;
          escaped = false;
        } else if (char === '\\') {
          result += char;
          escaped = true;
        } else if (char === '"') {
          inString = false;
          result += char;
        } else if (char === '\n') {
          result += '\\n';
        } else if (char === '\t') {
          result += '\\t';
        } else if (char === '\r') {
          result += '';
        } else {
          result += char;
        }
      }
    }

    jsonStr = result;

    // 4. 恢复保护的字符
    protectedChars.forEach((char, index) => {
      jsonStr = jsonStr.replace(placeholder + index + placeholder, char);
    });

    // 5. 修复末尾多余的逗号
    jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1');

    // 6. 先修复明显错误的数字格式（如多余的引号），避免后续补逗号误判
    // 修复类似 "latitude": "28.1234" 应该 latitude: 28.1234 的情况
    jsonStr = jsonStr.replace(/"(-?\d+\.\d+)"/g, (match, num) => num);

    // 7. 修复对象或数组后面缺少逗号的情况
    jsonStr = jsonStr.replace(/}(\s*")/g, '},$1');
    jsonStr = jsonStr.replace(/](\s*")/g, '],$1');
    jsonStr = jsonStr.replace(/}(\s*{)/g, '},$1');
    jsonStr = jsonStr.replace(/](\s*\[)/g, '],$1');
    jsonStr = jsonStr.replace(/}(\s*\[)/g, '},$1');
    jsonStr = jsonStr.replace(/](\s*{)/g, '],$1');

    // 8. 修复true/false/null后面缺少逗号
    jsonStr = jsonStr.replace(/(true|false|null)(\s*")/g, '$1,$2');
    jsonStr = jsonStr.replace(/(true|false|null)(\s*{)/g, '$1,$2');
    jsonStr = jsonStr.replace(/(true|false|null)(\s*\[)/g, '$1,$2');

    // 9. 修复数字后面缺少逗号
    jsonStr = jsonStr.replace(/(\d)(\s*")/g, '$1,$2');
    jsonStr = jsonStr.replace(/(\d)(\s*{)/g, '$1,$2');
    jsonStr = jsonStr.replace(/(\d)(\s*\[)/g, '$1,$2');

    // 10. 修复属性名中包含特殊字符的情况
    jsonStr = jsonStr.replace(/"([^"]*)":\s*"([^"]*)"/g, (match, key, value) => {
      // 清理 key 中的特殊字符
      const cleanKey = key.replace(/[\n\r\t]/g, '');
      // 清理 value 中的特殊字符
      const cleanValue = value.replace(/[\n\r\t]/g, '');
      return `"${cleanKey}": "${cleanValue}"`;
    });

    logger.info(`JSON修复完成，新长度: ${jsonStr.length}`);

    return jsonStr;
  }

  /**
   * 简单的对话（用于调整行程）
   */
  async chat(message, conversationHistory = []) {
    const systemPrompt = `你是长沙旅游规划助手"小沙"。

用户可能会要求调整行程，如：
- "换一批景点"
- "我想吃更多小吃"
- "酒店太贵了，换便宜点的"
- "增加博物馆"

请理解用户意图，返回调整建议。

返回JSON格式：
{
  "message": "回复用户的话",
  "adjustmentType": "attractions|restaurants|hotels|all",
  "requirements": {
    // 更新后的需求
  }
}`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.slice(-10)
    ];

    const lastMessage = conversationHistory[conversationHistory.length - 1];
    if (!lastMessage || lastMessage.role !== 'user' || lastMessage.content !== message) {
      messages.push({ role: 'user', content: message });
    }

    try {
      logger.info(`=== AI对话请求 ===`);
      logger.info(`用户消息: ${message}`);
      logger.info(`历史消息数: ${conversationHistory.length}`);

      const aiResponse = await this.callAPI(messages);

      logger.info(`=== AI对话返回 ===`);
      logger.info(aiResponse);

      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const data = JSON.parse(jsonMatch[0]);
        return {
          message: data.message || aiResponse,
          adjustmentType: data.adjustmentType || null,
          requirements: data.requirements || {}
        };
      }

      return {
        message: aiResponse,
        adjustmentType: null,
        requirements: {}
      };
    } catch (error) {
      logger.error(`对话失败: ${error.message}`);
      return {
        message: '抱歉，我理解错了，请再说一次',
        adjustmentType: null,
        requirements: {}
      };
    }
  }

  /**
   * 调用千问API (阿里云百炼平台OpenAI兼容模式)
   */
  /**
   * callAPI — 通义千问API底层调用封装
   * 
   * 发送POST请求到阿里云百炼平台OpenAI兼容接口
   * 超时设置: 120秒(AI生成行程需要较长思考时间)
   * 可选启用: web_search/web_extractor 工具(联网搜索能力)
   */
  async callAPI(messages, options = {}) {
    const payload = {
      model: this.model,
      messages: messages,
      temperature: 0.8,
      enable_thinking: false
    };

    if (options.enableWebSearch) {
      payload.tools = [
        { type: 'web_search' },
        { type: 'web_extractor' }
      ];
    }

    logger.info(`调用API - URL: ${this.baseUrl}/chat/completions`);
    logger.info(`调用API - Model: ${this.model}`);
    logger.info(`调用API - Messages数量: ${messages.length}`);
    logger.info(`=== 发送给AI的完整Messages ===`);
    messages.forEach((msg, index) => {
      const content = msg.content;
      if (content.length > 500) {
        logger.info(`[${index}] ${msg.role}: ${content.substring(0, 500)}... (共${content.length}字符)`);
      } else {
        logger.info(`[${index}] ${msg.role}: ${content}`);
      }
    });

    try {
      const response = await axios.post(
        `${this.baseUrl}/chat/completions`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 120000
        }
      );

      if (response.data?.choices?.[0]?.message?.content) {
        return response.data.choices[0].message.content;
      }

      throw new Error('API 响应格式异常');
    } catch (error) {
      if (error.response) {
        logger.error(`API错误状态码: ${error.response.status}`);
        logger.error(`API错误详情: ${JSON.stringify(error.response.data)}`);
      }
      throw error;
    }
  }

  /**
   * 生成推荐地点（换一批功能）
   * @param {string} type - 类型: attractions, restaurants, hotels
   * @param {string} area - 地域
   * @param {string[]} existingNames - 已存在的地点名称
   * @param {number} count - 需要推荐的数量
   */
  async generateRecommendations(type, area, existingNames = [], count = 3, locationContext = '', filterPreference = '') {
    const typeNames = {
      attractions: '景点',
      restaurants: '餐厅',
      hotels: '酒店'
    };

    // 构建精确地理上下文描述
    const locationInfo = locationContext
      ? `\n\n【当前行程中第${typeNames[type]}的精确位置信息（请基于这些坐标推荐附近的新${typeNames[type]}）】\n${locationContext}\n请优先推荐距离上述地点步行或短途公交可达的新${typeNames[type]}，确保地理分布合理。`
      : '';

    // 构建分类偏好描述
    let filterInfo = '';
    if (filterPreference) {
      if (type === 'restaurants') {
        if (filterPreference === 'all') {
          filterInfo = `\n\n【美食多样性要求 — 必须严格满足】
你推荐的所有餐厅必须覆盖以下菜系类别（每类至少推荐2-3家），确保口味丰富多样：
- 🌶️ **菜馆**（至少3家）：正宗湖南菜馆，如剁椒鱼头、辣椒炒肉、臭豆腐等经典菜品
- 🥟 **小吃/本地特色**（至少3家）：长沙地道小吃、粉面馆、糖油粑粑等街头美食
- 🍝 **西餐**（至少3-4家）：披萨店、汉堡店、日韩料理、泰餐、越南菜等平价异国餐厅
- 总计推荐 ${count} 家餐厅，确保以上3个类别全覆盖
- 每家餐厅的 cuisine 字段必须准确标注其所属菜系分类（仅限：湘菜/小吃/西餐）`;
        } else {
          const cuisineMap = {
            '湘菜': '🌶️ 菜馆（正宗湖南菜：剁椒鱼头、辣椒炒肉、臭豆腐等经典菜品）',
            '小吃': '🥟 小吃/本地特色（长沙街头美食：粉面馆、糖油粑粑、口味虾、臭豆腐等）',
            '西餐': '🍝 西餐（披萨店、汉堡店、日韩料理、泰餐、越南菜、沙拉轻食等，人均30-80元的平价餐厅）'
          };
          filterInfo = `\n\n【用户指定的菜系偏好 — 必须严格满足】
你推荐的餐厅必须全部属于"${filterPreference}"这个菜系分类。
每家餐厅的 cuisine 字段必须标注为"${filterPreference}"。
推荐 ${count} 家该菜系下的优质餐厅。`;
        }
      } else if (type === 'hotels') {
        if (filterPreference === 'all') {
          filterInfo = `\n\n【酒店多样性要求 — 必须严格满足】
你推荐的酒店应覆盖不同档次，确保选择丰富：
- ⭐⭐⭐⭐⭐ 五星级（1-2家）：豪华型酒店
- ⭐⭐⭐⭐ 四星级（3-4家）：高档型舒适酒店
- ⭐⭐⭐ 三星级（3-4家）：经济实惠型酒店
- 总计推荐 ${count} 家酒店
- 每家酒店的 starRating 字段必须准确标注星级`;
        } else {
          const starMap = {
            '5': '⭐⭐⭐⭐⭐ 五星级（豪华型酒店，设施完善，服务周到）',
            '4': '⭐⭐⭐⭐ 四星级（高档型酒店，舒适体验）',
            '3': '⭐⭐⭐ 三星级（经济实惠型酒店）'
          };
          filterInfo = `\n\n【用户指定的星级偏好 — 必须严格满足】
你推荐的酒店必须全部为 ${filterPreference || ''} 星级标准。
${starMap[filterPreference] || ''}
每家酒店的 starRating 字段必须标注为 "${filterPreference}"。
推荐 ${count} 家该星级下的优质酒店。`;
        }
      }
    }

    const systemPrompt = `你是长沙旅游规划专家。用户需要换一批${typeNames[type]}推荐。

【当前地域】${area || '长沙'}${locationInfo}${filterInfo}

【已存在的地点，不要重复推荐】
${existingNames.length > 0 ? existingNames.map((name, i) => `${i + 1}. ${name}`).join('\n') : '（暂无）'}

【要求】
1. 推荐${count}个新的${typeNames[type]}，不要与已存在的重复
2. 推荐要符合地域特点，真实存在${locationContext ? '，且与当前行程中的地点地理位置接近' : ''}
${!filterPreference ? '3. 返回JSON格式' : ''}

【输出格式】
${type === 'attractions' ? `{
  "recommendations": [
    {"name": "景点名称", "type": "景点类型", "rating": 4.8, "description": "简介", "address": "地址", "latitude": 28.1234, "longitude": 112.5678, "ticketPrice": 0, "estimatedDuration": 2, "bestTime": "上午"}
  ]
}` : type === 'restaurants' ? `{
  "recommendations": [
    {"name": "餐厅名称", "cuisine": "湘菜", "rating": 4.7, "avgPrice": 80, "description": "简介", "address": "地址", "latitude": 28.1234, "longitude": 112.5678, "specialty": "招牌菜"}
  ]
}` : `{
  "recommendations": [
    {"name": "酒店名称", "starRating": 3, "rating": 4.5, "pricePerNight": 280, "description": "简介", "address": "地址", "latitude": 28.1234, "longitude": 112.5678}
  ]
}`}`;

    try {
      logger.info(`=== AI推荐${typeNames[type]}请求 ===`);
      logger.info(`地域: ${area}, 排除: ${existingNames.length}个, 需要: ${count}个, 分类偏好: ${filterPreference || '无'}, 精确坐标: ${locationContext ? '已提供' : '未提供'}`);

      const userMsg = filterPreference === 'all'
        ? `请推荐${count}个${area || '长沙'}的${typeNames[type]}，必须覆盖多种${type === 'restaurants' ? '菜系' : '星级'}类别确保丰富多样${locationContext ? '\n请确保推荐地点与已有地点在地理上相近' : ''}`
        : filterPreference
          ? `请基于当前位置推荐${count}个"${filterPreference}"类型的${area || '长沙'}的${typeNames[type]}，必须严格满足用户指定的分类要求${locationContext ? '\n请确保新推荐与已有地点在地理上相近' : ''}`
          : `请基于当前位置推荐${count}个${area || '长沙'}的${typeNames[type]}${locationContext ? '\n请确保新推荐的地点与上述已有地点在地理上相近' : ''}`;

      const aiResponse = await this.callAPI([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMsg }
      ]);

      logger.info(`=== AI推荐返回 ===`);
      logger.info(aiResponse);

      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const data = JSON.parse(jsonMatch[0]);
        const recommendations = data.recommendations || [];

        // 为每个推荐添加ID
        recommendations.forEach((item, index) => {
          item.id = `${type.slice(0, 4)}_${Date.now()}_${index}`;
          item.source = 'ai_recommend';
        });

        logger.info(`AI推荐完成: ${recommendations.length}个${typeNames[type]}`);
        return recommendations;
      }

      return [];
    } catch (error) {
      logger.error(`AI推荐失败: ${error.message}`);
      return [];
    }
  }
}

module.exports = new QwenAIService();
