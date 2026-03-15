class AIPromptGenerator {
  /**
   * 根据用户需求动态生成旅游推荐提示词
   * @param {Object} requirements - 用户需求
   * @returns {string} 生成的提示词
   */
  generateDynamicTravelPrompt(requirements) {
    const { 
      location = '长沙', 
      days = 3, 
      crowd = '情侣', 
      budget = '1000-2000', 
      interests = [], 
      foodPreferences = [], 
      preferredAreas = [],
      constraints = []
    } = requirements;

    const foodPrefsText = foodPreferences.length > 0 ? 
      `\n- 特别要求：用户明确提到想吃${foodPreferences.join('、')}，请务必在餐厅推荐中包含这些美食` : '';
    
    const areasText = preferredAreas.length > 0 ?
      `\n- 偏好区域：用户希望去${preferredAreas.join('、')}，请优先推荐这些区域的景点和餐厅` : '';

    return `你是一位专业的${location}旅游推荐专家。请根据以下用户需求，生成${location}的景点、餐厅和酒店推荐。

用户需求：
- 旅行天数：${days}天
- 旅行人群：${crowd}
- 预算范围：${budget}
- 兴趣爱好：${interests.length > 0 ? interests.join('、') : '无'}${foodPrefsText}${areasText}
- 其他需求：${constraints || '无'}

请严格按照以下JSON格式输出推荐数据，不要输出任何其他文字：

{
  "attractions": [
    {"name": "景点名称", "type": "景点类型", "rating": 4.5, "description": "推荐理由", "address": "详细地址", "latitude": 28.1234, "longitude": 112.5678}
  ],
  "restaurants": [
    {"name": "餐厅/小吃店名称", "cuisine": "菜系类型", "rating": 4.5, "avgPrice": 80, "description": "推荐理由", "specialty": "招牌菜/特色小吃", "type": "restaurant/snack", "address": "详细地址", "latitude": 28.1234, "longitude": 112.5678}
  ],
  "hotels": [
    {"name": "酒店名称", "starRating": 4, "rating": 4.5, "pricePerNight": 300, "description": "推荐理由", "address": "详细地址", "latitude": 28.1234, "longitude": 112.5678}
  ]
}

要求：
1. 景点至少推荐10个，包括${location}的著名景点和网红打卡地
2. 餐厅和小吃至少推荐15个，必须包含：
   - 用户特别提到的美食（如口味虾、臭豆腐等）的专门餐厅或小吃店
   - 正餐餐厅（湘菜、火锅、烧烤等）
   - 特色小吃店（臭豆腐、糖油粑粑、茶颜悦色等）
   - type字段：正餐餐厅用"restaurant"，小吃店用"snack"
3. 酒店推荐5个，包括不同价位和风格的选择
4. 所有推荐都要符合用户的需求和偏好
5. 必须包含真实的经纬度坐标（latitude和longitude），用于地图显示
6. 只输出JSON数据，不要输出任何其他文字`;
  }

  /**
   * 生成岳麓区特定的推荐提示词
   * @param {Object} requirements - 用户需求
   * @returns {string} 生成的提示词
   */
  generateYueluRecommendationPrompt(requirements) {
    const { 
      crowd = '情侣', 
      interests = [], 
      foodPreferences = []
    } = requirements;

    return `你是一位专业的长沙旅游推荐专家，擅长为${crowd}提供个性化的旅游建议。请按照以下要求为长沙岳麓区生成详细的推荐：

## 任务要求
1. 推荐岳麓区的优秀酒店，包括不同类型和价位的选择
2. 推荐岳麓区的美食小吃，涵盖街头小吃、特色餐厅等
3. 每个推荐都要给出具体的理由和特色
4. 确保信息准确，符合当地实际情况

## 用户需求
- 旅行人群：${crowd}
- 兴趣爱好：${interests.length > 0 ? interests.join('、') : '无'}
- 美食偏好：${foodPreferences.length > 0 ? foodPreferences.join('、') : '无'}

## 推荐内容要求
### 酒店推荐
- 岳麓山脚下/大学城区域的酒店
- 汽车西站/达美中心区域的主题酒店
- 不同价位和风格的选择
- 具体位置和特色描述

### 美食小吃推荐
- 岳麓山脚下和麓山南路的小吃
- 大学城周边的特色美食
- 本地人推荐的宝藏店铺
- 特色正餐推荐

## 格式要求
- 使用友好亲切的语气
- 分点清晰，层次分明
- 加入适当的emoji增强可读性
- 最后提供游玩小贴士

请按照上述要求，为岳麓区的${crowd}游客生成一份详细的推荐清单。`;
  }

  /**
   * 生成特定区域的周边推荐提示词
   * @param {string} area - 区域名称
   * @param {Object} requirements - 用户需求
   * @returns {string} 生成的提示词
   */
  generateAreaRecommendationPrompt(area, requirements) {
    const { 
      crowd = '游客', 
      interests = [], 
      foodPreferences = []
    } = requirements;

    return `你是一位专业的长沙旅游推荐专家，擅长为${crowd}提供个性化的旅游建议。请按照以下要求为长沙${area}周边生成详细的推荐：

## 任务要求
1. 推荐${area}周边的景点
2. 推荐${area}周边的美食小吃和餐厅
3. 推荐${area}周边的酒店住宿
4. 每个推荐都要给出具体的理由和特色
5. 确保信息准确，符合当地实际情况

## 用户需求
- 旅行人群：${crowd}
- 兴趣爱好：${interests.length > 0 ? interests.join('、') : '无'}
- 美食偏好：${foodPreferences.length > 0 ? foodPreferences.join('、') : '无'}

## 推荐内容要求
### 景点推荐
- ${area}周边的主要景点
- 每个景点的特色和推荐理由
- 适合${crowd}的游玩体验

### 美食推荐
- ${area}周边的特色美食
- 街头小吃和特色餐厅
- 本地人推荐的宝藏店铺

### 酒店推荐
- ${area}周边的住宿选择
- 不同价位和风格的酒店
- 具体位置和特色描述

## 格式要求
- 使用友好亲切的语气
- 分点清晰，层次分明
- 加入适当的emoji增强可读性
- 最后提供游玩小贴士

请按照上述要求，为${area}周边的${crowd}游客生成一份详细的推荐清单。`;
  }

  /**
   * 生成美食专项推荐提示词
   * @param {string} location - 地点
   * @param {Object} requirements - 用户需求
   * @returns {string} 生成的提示词
   */
  generateFoodRecommendationPrompt(location, requirements) {
    const { 
      foodPreferences = [], 
      crowd = '游客',
      budget = '适中'
    } = requirements;

    return `你是一位专业的${location}美食推荐专家，擅长为${crowd}提供个性化的美食建议。请按照以下要求生成详细的美食推荐：

## 任务要求
1. 推荐${location}的特色美食和餐厅
2. 涵盖不同类型和价位的选择
3. 每个推荐都要给出具体的理由和特色
4. 确保信息准确，符合当地实际情况

## 用户需求
- 美食偏好：${foodPreferences.length > 0 ? foodPreferences.join('、') : '无'}
- 旅行人群：${crowd}
- 预算水平：${budget}

## 推荐内容要求
### 特色美食
- ${location}的代表性美食
- 必吃小吃和特色菜品
- 每个美食的特色和推荐理由

### 餐厅推荐
- 不同类型的餐厅（小吃店、特色餐厅、网红餐厅等）
- 不同价位的选择
- 具体位置和特色描述

### 美食路线
- 合理的美食打卡路线
- 推荐的用餐时间和顺序
- 适合${crowd}的用餐体验

## 格式要求
- 使用友好亲切的语气
- 分点清晰，层次分明
- 加入适当的emoji增强可读性
- 最后提供美食小贴士

请按照上述要求，为${crowd}游客生成一份详细的${location}美食推荐清单。`;
  }

  /**
   * 生成酒店专项推荐提示词
   * @param {string} location - 地点
   * @param {Object} requirements - 用户需求
   * @returns {string} 生成的提示词
   */
  generateHotelRecommendationPrompt(location, requirements) {
    const { 
      crowd = '游客', 
      budget = '1000-2000',
      hotelArea = '',
      interests = []
    } = requirements;

    return `你是一位专业的${location}酒店推荐专家，擅长为${crowd}提供个性化的住宿建议。请按照以下要求生成详细的酒店推荐：

## 任务要求
1. 推荐${location}的优秀酒店，包括不同类型和价位的选择
2. 每个推荐都要给出具体的理由和特色
3. 确保信息准确，符合当地实际情况

## 用户需求
- 旅行人群：${crowd}
- 预算范围：${budget}
- 偏好区域：${hotelArea || '无'}
- 兴趣爱好：${interests.length > 0 ? interests.join('、') : '无'}

## 推荐内容要求
### 酒店推荐
- 不同类型的酒店（主题酒店、商务酒店、民宿等）
- 不同价位的选择
- 具体位置和特色描述
- 适合${crowd}的住宿体验

### 区域推荐
- ${location}的主要住宿区域
- 每个区域的特点和适合人群
- 交通便利性和周边配套

## 格式要求
- 使用友好亲切的语气
- 分点清晰，层次分明
- 加入适当的emoji增强可读性
- 最后提供住宿小贴士

请按照上述要求，为${crowd}游客生成一份详细的${location}酒店推荐清单。`;
  }

  /**
   * 生成行程调整提示词
   * @param {Object} originalRequirements - 原始需求
   * @param {Object} newRequirements - 新需求
   * @param {Array} originalItinerary - 原始行程
   * @returns {string} 生成的提示词
   */
  generateItineraryAdjustmentPrompt(originalRequirements, newRequirements, originalItinerary) {
    const changes = [];
    
    // 检测变化
    if (newRequirements.days && newRequirements.days !== originalRequirements.days) {
      changes.push(`天数从${originalRequirements.days}天调整为${newRequirements.days}天`);
    }
    
    if (newRequirements.crowd && newRequirements.crowd !== originalRequirements.crowd) {
      changes.push(`人群从${originalRequirements.crowd}调整为${newRequirements.crowd}`);
    }
    
    if (newRequirements.budget && newRequirements.budget !== originalRequirements.budget) {
      changes.push(`预算从${originalRequirements.budget}调整为${newRequirements.budget}`);
    }
    
    if (newRequirements.attractionsPerDay) {
      changes.push(`每天景点数量调整为${newRequirements.attractionsPerDay.min}-${newRequirements.attractionsPerDay.max}个`);
    }
    
    if (newRequirements.interests?.length > 0) {
      changes.push(`新增兴趣偏好：${newRequirements.interests.join('、')}`);
    }
    
    if (newRequirements.foodPreferences?.length > 0) {
      changes.push(`新增美食偏好：${newRequirements.foodPreferences.join('、')}`);
    }
    
    if (newRequirements.preferredAreas?.length > 0) {
      changes.push(`新增偏好区域：${newRequirements.preferredAreas.join('、')}`);
    }
    
    if (newRequirements.constraints) {
      changes.push(`新增特殊要求：${newRequirements.constraints}`);
    }

    return `用户提出了行程调整请求，请根据新的需求重新规划行程。

## 原始行程概览
${originalItinerary.map((day, index) => 
  `第${index + 1}天：${day.attractions.map(a => a.name).join(' → ')}`
).join('\n')}

## 调整内容
${changes.join('\n')}

## 调整要求
1. 保持原有的优质景点和餐厅
2. 根据新需求调整行程安排
3. 确保行程更加合理和舒适
4. 添加新的景点或餐厅以满足用户的新需求

请生成调整后的行程规划。`;
  }

  /**
   * 生成景点换一批提示词
   * @param {Object} requirements - 用户需求
   * @param {Array} currentAttractions - 当前景点列表
   * @returns {string} 生成的提示词
   */
  generateAttractionsRefreshPrompt(requirements, currentAttractions) {
    const location = requirements.location || '长沙';
    const currentNames = currentAttractions.map(a => a.name).join('、');
    
    return `请为${location}推荐一批新的景点，不要包含以下已推荐的景点：${currentNames}。

用户需求：
- 旅行人群：${requirements.crowd || '游客'}
- 兴趣爱好：${requirements.interests?.join('、') || '无'}
- 偏好区域：${requirements.preferredAreas?.join('、') || '无'}

请推荐10个不同类型的景点，包括：
1. 著名景点
2. 网红打卡地
3. 文化古迹
4. 自然风光
5. 特色街区

每个景点请提供：
- 名称
- 类型
- 评分
- 描述
- 详细地址
- 经纬度坐标
- 建议游览时间
- 门票价格
- 开放时间

请严格按照JSON格式输出，不要输出任何其他文字。`;
  }

  /**
   * 生成美食换一批提示词
   * @param {Object} requirements - 用户需求
   * @param {Array} currentRestaurants - 当前餐厅列表
   * @returns {string} 生成的提示词
   */
  generateRestaurantsRefreshPrompt(requirements, currentRestaurants) {
    const location = requirements.location || '长沙';
    const currentNames = currentRestaurants.map(r => r.name).join('、');
    
    return `请为${location}推荐一批新的美食，不要包含以下已推荐的餐厅：${currentNames}。

用户需求：
- 旅行人群：${requirements.crowd || '游客'}
- 美食偏好：${requirements.foodPreferences?.join('、') || '无'}
- 预算范围：${requirements.budget || '适中'}

请推荐10个不同类型的美食，分类展示：
1. 湘菜正餐（3个）
2. 特色小吃（3个）
3. 火锅烧烤（2个）
4. 网红美食（2个）

每个餐厅请提供：
- 名称
- 菜系类型
- 评分
- 人均价格
- 描述
- 招牌菜
- 详细地址
- 经纬度坐标
- 用餐类型（午餐/晚餐）

请严格按照JSON格式输出，不要输出任何其他文字。`;
  }

  /**
   * 生成住宿换一批提示词
   * @param {Object} requirements - 用户需求
   * @param {Array} currentHotels - 当前酒店列表
   * @returns {string} 生成的提示词
   */
  generateHotelsRefreshPrompt(requirements, currentHotels) {
    const location = requirements.location || '长沙';
    const currentNames = currentHotels.map(h => h.name).join('、');
    
    return `请为${location}推荐一批新的住宿，不要包含以下已推荐的酒店：${currentNames}。

用户需求：
- 旅行人群：${requirements.crowd || '游客'}
- 预算范围：${requirements.budget || '1000-2000'}
- 偏好区域：${requirements.preferredAreas?.join('、') || '无'}

请按等级分类推荐5个酒店：
1. 高端酒店（1个）
2. 中端酒店（2个）
3. 经济型酒店（2个）

每个酒店请提供：
- 名称
- 星级
- 评分
- 每晚价格
- 描述
- 详细地址
- 经纬度坐标
- 配套设施

请严格按照JSON格式输出，不要输出任何其他文字。`;
  }

  /**
   * 生成交通方案提示词
   * @param {Object} requirements - 用户需求
   * @param {Array} itinerary - 行程安排
   * @returns {string} 生成的提示词
   */
  generateTransportationPrompt(requirements, itinerary) {
    const location = requirements.location || '长沙';
    const transportation = requirements.transportation || '公共交通';
    
    return `请为${location}的行程生成详细的交通方案，交通方式以${transportation}为主。

行程安排：
${itinerary.map((day, index) => 
  `第${index + 1}天：${day.attractions.map(a => a.name).join(' → ')}`
).join('\n')}

请为每天的行程提供：
1. 详细的交通路线
2. 交通方式选择
3. 预计时间
4. 费用估算
5. 距离信息
6. 交通小贴士

请严格按照JSON格式输出，不要输出任何其他文字。`;
  }

  /**
   * 从自然语言提取标签并生成全面的行程规划提示词
   * @param {string} userInput - 用户的自然语言输入
   * @returns {Object} 包含提取的标签和生成的提示词
   */
  generateComprehensiveItineraryPrompt(userInput) {
    // 提取标签
    const extractedTags = this.extractTagsFromNaturalLanguage(userInput);
    
    const {
      location = '长沙',
      days = 3,
      crowd = '游客',
      budget = '1000-2000',
      interests = [],
      foodPreferences = [],
      preferredAreas = [],
      constraints = [],
      transportation = '公共交通',
      accommodationType = '酒店'
    } = extractedTags;

    return {
      tags: extractedTags,
      prompt: `你是一位专业的${location}旅游行程规划专家。请根据用户的自然语言需求，生成一份全面的${days}天${crowd}行程规划。

用户需求：${userInput}

提取的关键信息：
- 目的地：${location}
- 旅行天数：${days}天
- 旅行人群：${crowd}
- 预算范围：${budget}
- 兴趣爱好：${interests.length > 0 ? interests.join('、') : '无'}
- 美食偏好：${foodPreferences.length > 0 ? foodPreferences.join('、') : '无'}
- 偏好区域：${preferredAreas.length > 0 ? preferredAreas.join('、') : '无'}
- 交通方式：${transportation}
- 住宿类型：${accommodationType}
- 其他要求：${constraints.length > 0 ? constraints.join('、') : '无'}

请严格按照以下JSON格式输出详细的行程规划，不要输出任何其他文字：

{
  "itinerary": [
    {
      "day": 1,
      "date": "2026-03-08",
      "title": "第一天行程标题",
      "attractions": [
        {
          "name": "景点名称",
          "type": "景点类型",
          "rating": 4.5,
          "description": "景点描述",
          "address": "详细地址",
          "latitude": 28.1234,
          "longitude": 112.5678,
          "visitTime": "建议游览时间（小时）",
          "ticketPrice": "门票价格",
          "openingHours": "开放时间"
        }
      ],
      "restaurants": [
        {
          "name": "餐厅名称",
          "cuisine": "菜系类型",
          "rating": 4.5,
          "avgPrice": 80,
          "description": "餐厅描述",
          "specialty": "招牌菜",
          "address": "详细地址",
          "latitude": 28.1234,
          "longitude": 112.5678,
          "mealType": "午餐/晚餐"
        }
      ],
      "transportation": [
        {
          "from": "起点",
          "to": "终点",
          "mode": "交通方式",
          "duration": "预计时间",
          "cost": "费用",
          "distance": "距离"
        }
      ],
      "accommodation": {
        "name": "酒店名称",
        "address": "详细地址",
        "latitude": 28.1234,
        "longitude": 112.5678,
        "pricePerNight": 300,
        "rating": 4.5,
        "description": "住宿描述"
      },
      "dailyCost": {
        "attractions": 100,
        "food": 150,
        "transportation": 50,
        "accommodation": 300,
        "total": 600
      }
    }
  ],
  "summary": {
    "totalDays": 3,
    "totalAttractions": 15,
    "totalRestaurants": 10,
    "totalCost": 1800,
    "transportationSummary": "交通总览",
    "foodSummary": "美食总览",
    "tips": ["旅行小贴士1", "旅行小贴士2"]
  }
}

要求：
1. 行程安排要合理，考虑景点之间的距离和交通时间
2. 每个景点要包含详细信息，特别是经纬度坐标
3. 每个餐厅要包含菜系、人均价格和招牌菜
4. 交通安排要详细，包括方式、时间和费用
5. 住宿安排要符合用户的预算和偏好
6. 每天的费用预算要合理且详细
7. 整体行程要涵盖用户提到的所有兴趣点
8. 确保所有经纬度坐标准确，可用于高德地图API
9. 只输出JSON数据，不要输出任何其他文字`
    };
  }

  /**
   * 从自然语言中提取标签
   * @param {string} userInput - 用户的自然语言输入
   * @returns {Object} 提取的标签
   */
  extractTagsFromNaturalLanguage(userInput) {
    // 基础标签结构
    const baseTags = {
      location: '长沙',
      days: 3,
      crowd: '游客',
      budget: '1000-2000',
      interests: [],
      foodPreferences: [],
      preferredAreas: [],
      constraints: [],
      transportation: '公共交通',
      accommodationType: '酒店'
    };

    // 简单的关键词匹配作为备用方案
    // 提取目的地
    const locationKeywords = ['长沙', '北京', '上海', '广州', '深圳', '成都', '杭州', '西安', '南京', '武汉'];
    for (const keyword of locationKeywords) {
      if (userInput.includes(keyword)) {
        baseTags.location = keyword;
        break;
      }
    }

    // 提取天数
    const daysMatch = userInput.match(/(\d+)天/);
    if (daysMatch) {
      baseTags.days = parseInt(daysMatch[1]);
    }

    // 提取人群
    const crowdKeywords = {
      '情侣': ['情侣', '女朋友', '男朋友'],
      '亲子': ['亲子', '带孩子', '家庭'],
      '朋友': ['朋友', '同学', '闺蜜'],
      '独自': ['独自', '一个人', '单身']
    };
    for (const [crowdType, keywords] of Object.entries(crowdKeywords)) {
      if (keywords.some(keyword => userInput.includes(keyword))) {
        baseTags.crowd = crowdType;
        break;
      }
    }

    // 提取预算
    const budgetMatch = userInput.match(/(\d+)[-\s]*(\d+)元|预算(\d+)[-\s]*(\d+)/);
    if (budgetMatch) {
      if (budgetMatch[1] && budgetMatch[2]) {
        baseTags.budget = `${budgetMatch[1]}-${budgetMatch[2]}`;
      } else if (budgetMatch[3] && budgetMatch[4]) {
        baseTags.budget = `${budgetMatch[3]}-${budgetMatch[4]}`;
      }
    } else if (userInput.includes('高') || userInput.includes('贵') || userInput.includes('豪华')) {
      baseTags.budget = '3000以上';
    } else if (userInput.includes('低') || userInput.includes('便宜') || userInput.includes('经济')) {
      baseTags.budget = '1000以下';
    }

    // 提取兴趣爱好
    const interestKeywords = {
      '历史文化': ['历史', '文化', '博物馆', '古迹', '故居'],
      '自然风光': ['自然', '风景', '公园', '山', '水', '湖', '河'],
      '美食': ['美食', '吃', '餐厅', '小吃'],
      '购物': ['购物', '商场', '逛街'],
      '夜生活': ['夜景', '酒吧', '夜市', '烟花']
    };
    for (const [interest, keywords] of Object.entries(interestKeywords)) {
      if (keywords.some(keyword => userInput.includes(keyword))) {
        baseTags.interests.push(interest);
      }
    }

    // 提取美食偏好
    const foodKeywords = ['口味虾', '臭豆腐', '糖油粑粑', '湘菜', '火锅', '烧烤', '茶颜悦色', '小龙虾'];
    for (const keyword of foodKeywords) {
      if (userInput.includes(keyword)) {
        baseTags.foodPreferences.push(keyword);
      }
    }

    // 提取偏好区域
    const areaKeywords = ['五一广场', '橘子洲', '岳麓山', '太平街', '坡子街', 'IFS', '湘江'];
    for (const keyword of areaKeywords) {
      if (userInput.includes(keyword)) {
        baseTags.preferredAreas.push(keyword);
      }
    }

    // 提取交通方式
    const transportKeywords = {
      '公共交通': ['公交', '地铁', '公共交通'],
      '打车': ['打车', '出租车', '滴滴'],
      '自驾': ['自驾', '开车', '租车']
    };
    for (const [transport, keywords] of Object.entries(transportKeywords)) {
      if (keywords.some(keyword => userInput.includes(keyword))) {
        baseTags.transportation = transport;
        break;
      }
    }

    // 提取住宿类型
    const accommodationKeywords = {
      '酒店': ['酒店', '宾馆'],
      '民宿': ['民宿', '客栈'],
      '青旅': ['青旅', ' hostel']
    };
    for (const [accommodation, keywords] of Object.entries(accommodationKeywords)) {
      if (keywords.some(keyword => userInput.includes(keyword))) {
        baseTags.accommodationType = accommodation;
        break;
      }
    }

    // 提取其他约束
    if (userInput.includes('烟花') || userInput.includes('夜景')) {
      baseTags.constraints.push('夜景/烟花');
    }
    if (userInput.includes('体力') || userInput.includes('轻松')) {
      baseTags.constraints.push('轻松行程');
    }
    if (userInput.includes('网红') || userInput.includes('打卡')) {
      baseTags.constraints.push('网红打卡');
    }

    return baseTags;
  }

  /**
   * 使用AI从自然语言中提取标签
   * @param {string} userInput - 用户的自然语言输入
   * @returns {Promise<Object>} 提取的标签
   */
  async extractTagsWithAI(userInput) {
    const prompt = `请从以下用户输入中提取旅游相关的标签信息，严格按照JSON格式输出：

用户输入：${userInput}

请提取以下标签：
- location: 目的地（默认长沙）
- days: 旅行天数（默认3）
- crowd: 旅行人群（如情侣、亲子、朋友、独自等）
- budget: 预算范围（如1000-2000）
- interests: 兴趣爱好数组（如历史文化、自然风光、美食、购物、夜生活等）
- foodPreferences: 美食偏好数组（如口味虾、臭豆腐等）
- preferredAreas: 偏好区域数组（如五一广场、橘子洲等）
- constraints: 其他约束数组（如夜景/烟花、轻松行程、网红打卡等）
- transportation: 交通方式（如公共交通、打车、自驾）
- accommodationType: 住宿类型（如酒店、民宿、青旅）

请只输出JSON数据，不要输出任何其他文字。`;

    try {
      const webSearchService = require('./webSearchService');
      const aiResponse = await webSearchService.callQwenAPI([
        { role: 'system', content: '你是一位专业的旅游需求分析专家，能够从用户的自然语言输入中提取结构化的旅游相关标签。' },
        { role: 'user', content: prompt }
      ]);

      // 提取JSON部分
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const tags = JSON.parse(jsonMatch[0]);
        return {
          location: tags.location || '长沙',
          days: tags.days || 3,
          crowd: tags.crowd || '游客',
          budget: tags.budget || '1000-2000',
          interests: tags.interests || [],
          foodPreferences: tags.foodPreferences || [],
          preferredAreas: tags.preferredAreas || [],
          constraints: tags.constraints || [],
          transportation: tags.transportation || '公共交通',
          accommodationType: tags.accommodationType || '酒店'
        };
      }
    } catch (error) {
      console.error('AI标签提取失败:', error);
    }

    // 如果AI提取失败，使用备用方案
    return this.extractTagsFromNaturalLanguage(userInput);
  }
}

module.exports = new AIPromptGenerator();