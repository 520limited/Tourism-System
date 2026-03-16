const axios = require('axios');
const logger = require('../logger');

/**
 * 千问AI服务
 * 使用阿里云百炼平台OpenAI兼容模式API
 */
class QwenAIService {
  constructor() {
    this.apiKey = process.env.QWEN_API_KEY 
    // 使用阿里云百炼平台OpenAI兼容模式API
    this.baseUrl = process.env.QWEN_API_URL || 'https://dashscope.aliyuncs.com/api/v2/apps/protocols/compatible-mode/v1';
    this.model = process.env.QWEN_MODEL || 'qwen-plus'; // 使用qwen-plus模型或从环境变量读取
  }

  /**
   * 处理用户自然语言输入，直接生成行程（优化版：精简prompt，提速）
   */
  async generateTripFromNaturalLanguage(userMessage, conversationHistory = []) {
    const systemPrompt = `你是长沙旅游规划专家"小沙"。你必须直接生成完整行程，不要先确认需求，不要问问题，直接根据用户输入生成行程。

【重要规则】
1. 无论用户输入多么复杂或信息不足，都必须直接生成行程
2. 如果信息不足，自动补充合理的默认值
3. 永远不要回复"请再说一次"或"正在为您生成"等确认消息
4. 直接返回JSON格式的完整行程

【输出格式】必须严格遵循：
{
  "message": "为您生成了X天行程，包含...",
  "requirements": {"days":3,"crowd":"情侣","budget":"1000-2000","interests":["美食"],"foodPreferences":["臭豆腐"],"hotelArea":"五一广场"},
  "activities": ["摄影交流","当地文化体验"],
  "itinerary": [{
    "day":1,"title":"第一天：橘子洲-五一广场",
    "attractions":[{"id":"attr_1","name":"橘子洲","type":"自然风光","rating":4.8,"description":"长沙地标","address":"长沙市岳麓区橘子洲头","latitude":28.1711,"longitude":112.9654,"ticketPrice":0,"estimatedDuration":3,"bestTime":"上午"}],
    "restaurants":[{"id":"rest_1","name":"费大厨辣椒炒肉","cuisine":"湘菜","rating":4.7,"avgPrice":80,"address":"长沙市天心区坡子街","latitude":28.1942,"longitude":112.9723,"specialty":"辣椒炒肉"}],
    "hotels":[{"id":"hotel_1","name":"长沙五一广场如家酒店","starRating":3,"rating":4.5,"pricePerNight":280,"address":"长沙市芙蓉区五一大道","latitude":28.1985,"longitude":112.9712}]
  }]
}

【规则】
1.每天安排的景点要根据用户对“轻松和累”的界定来判断、3家餐厅、3家酒店
2.经纬度必须准确，价格必须真实
3.每日景点按地理位置就近安排，景点可以小众或者可以单单是某一个网红地点（如hibhub长沙公社这种，当然必须得到用户明确指示）
4.推荐内容要多样化，避免重复推荐常见景点，且必须符合用户的特别要求
5.如果用户输入简短或信息不足，则你自己根据用户的输入进行补充完善以及推荐;`

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
      
      const aiResponse = await this.callAPI(messages);
      
      logger.info(`=== AI返回内容 ===`);
      logger.info(aiResponse);
      
      const result = this.parseTripResponse(aiResponse);
      
      logger.info(`AI生成完成: ${result.itinerary ? result.itinerary.length + '天行程' : '未完成'}`);
      
      return result;
    } catch (error) {
      logger.error(`AI生成行程失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 解析AI返回的行程数据
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
    
    // 6. 修复对象或数组后面缺少逗号的情况
    jsonStr = jsonStr.replace(/}(\s*")/g, '},$1');
    jsonStr = jsonStr.replace(/](\s*")/g, '],$1');
    jsonStr = jsonStr.replace(/}(\s*{)/g, '},$1');
    jsonStr = jsonStr.replace(/](\s*\[)/g, '],$1');
    jsonStr = jsonStr.replace(/}(\s*\[)/g, '},$1');
    jsonStr = jsonStr.replace(/](\s*{)/g, '],$1');
    
    // 7. 修复true/false/null后面缺少逗号
    jsonStr = jsonStr.replace(/(true|false|null)(\s*")/g, '$1,$2');
    jsonStr = jsonStr.replace(/(true|false|null)(\s*{)/g, '$1,$2');
    jsonStr = jsonStr.replace(/(true|false|null)(\s*\[)/g, '$1,$2');
    
    // 8. 修复数字后面缺少逗号
    jsonStr = jsonStr.replace(/(\d)(\s*")/g, '$1,$2');
    jsonStr = jsonStr.replace(/(\d)(\s*{)/g, '$1,$2');
    jsonStr = jsonStr.replace(/(\d)(\s*\[)/g, '$1,$2');
    
    // 9. 修复属性名中包含特殊字符的情况
    jsonStr = jsonStr.replace(/"([^"]*)":\s*"([^"]*)"/g, (match, key, value) => {
      // 清理 key 中的特殊字符
      const cleanKey = key.replace(/[\n\r\t]/g, '');
      // 清理 value 中的特殊字符
      const cleanValue = value.replace(/[\n\r\t]/g, '');
      return `"${cleanKey}": "${cleanValue}"`;
    });
    
    // 10. 只修复明显错误的数字格式（如多余的引号）
    // 修复类似 "latitude": "28.1234" 应该 latitude: 28.1234 的情况
    jsonStr = jsonStr.replace(/"(-?\d+\.\d+)"/g, (match, num) => num);
    
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
  async generateRecommendations(type, area, existingNames = [], count = 3) {
    const typeNames = {
      attractions: '景点',
      restaurants: '餐厅',
      hotels: '酒店'
    };

    const systemPrompt = `你是长沙旅游规划专家。用户需要换一批${typeNames[type]}推荐。

【当前地域】${area || '长沙'}

【已存在的地点，不要重复推荐】
${existingNames.length > 0 ? existingNames.map((name, i) => `${i + 1}. ${name}`).join('\n') : '（暂无）'}

【要求】
1. 推荐${count}个新的${typeNames[type]}，不要与已存在的重复
2. 推荐要符合地域特点，真实存在
3. 返回JSON格式

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
      logger.info(`地域: ${area}, 排除: ${existingNames.length}个, 需要: ${count}个`);

      const aiResponse = await this.callAPI([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `请推荐${count}个${area || '长沙'}的${typeNames[type]}` }
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
