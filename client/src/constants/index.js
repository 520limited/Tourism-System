export const CROWD_OPTIONS = [
  { value: '情侣', label: '情侣出行' },
  { value: '亲子', label: '亲子游' },
  { value: '老人', label: '敬老游' },
  { value: '朋友', label: '朋友聚会' },
  { value: '独自旅行', label: '独自旅行' },
  { value: '家庭', label: '家庭出游' },
  { value: '团建', label: '公司团建' }
]

export const BUDGET_OPTIONS = [
  { value: '0-500', label: '经济实惠（0-500元）' },
  { value: '500-1000', label: '适中预算（500-1000元）' },
  { value: '1000-2000', label: '品质出行（1000-2000元）' },
  { value: '2000+', label: '豪华体验（2000元以上）' }
]

export const INTENSITY_OPTIONS = [
  { value: 'low', label: '轻松（日均步行<5km）' },
  { value: 'medium', label: '适中（日均步行5-10km）' },
  { value: 'high', label: '高强度（日均步行>10km）' }
]

export const DURATION_OPTIONS = [
  { value: 1, label: '1天' },
  { value: 2, label: '2天' },
  { value: 3, label: '3天' },
  { value: 4, label: '4天' },
  { value: 5, label: '5天' },
  { value: 7, label: '7天' }
]

export const TIME_SLOTS = [
  { value: 'morning', label: '上午' },
  { value: 'noon', label: '中午' },
  { value: 'afternoon', label: '下午' },
  { value: 'evening', label: '傍晚' },
  { value: 'night', label: '夜间' }
]

export const ATTRACTION_TAGS = [
  '自然风光',
  '历史文化',
  '主题乐园',
  '博物馆',
  '免费',
  '夜景',
  '购物',
  '美食',
  '宗教',
  '休闲',
  '亲子',
  '教育'
]

export const CUISINE_TYPES = [
  { value: '湘菜', label: '湘菜' },
  { value: '粤菜', label: '粤菜' },
  { value: '川菜', label: '川菜' },
  { value: '日料', label: '日本料理' },
  { value: '韩餐', label: '韩国料理' },
  { value: '西餐', label: '西餐' },
  { value: '火锅', label: '火锅' },
  { value: '烧烤', label: '烧烤' },
  { value: '小吃', label: '小吃' },
  { value: '甜品', label: '甜品饮品' }
]

export const DISTRICT_OPTIONS = [
  { value: '芙蓉区', label: '芙蓉区' },
  { value: '天心区', label: '天心区' },
  { value: '岳麓区', label: '岳麓区' },
  { value: '开福区', label: '开福区' },
  { value: '雨花区', label: '雨花区' },
  { value: '望城区', label: '望城区' },
  { value: '长沙县', label: '长沙县' }
]

export const HOTEL_STAR_OPTIONS = [
  { value: 2, label: '二星及以下' },
  { value: 3, label: '三星' },
  { value: 4, label: '四星' },
  { value: 5, label: '五星' }
]

export const SORT_OPTIONS = [
  { value: 'default', label: '综合排序' },
  { value: 'rating', label: '评分最高' },
  { value: 'price_low', label: '价格最低' },
  { value: 'price_high', label: '价格最高' },
  { value: 'distance', label: '距离最近' },
  { value: 'popular', label: '人气最高' }
]

export const TRIP_STATUS_OPTIONS = [
  { value: 'all', label: '全部' },
  { value: 'draft', label: '草稿' },
  { value: 'saved', label: '已保存' },
  { value: 'favorited', label: '已收藏' }
]

export const EXPORT_FORMAT_OPTIONS = [
  { value: 'pdf', label: 'PDF 格式' },
  { value: 'excel', label: 'Excel 格式' },
  { value: 'word', label: 'Word 格式' },
  { value: 'image', label: '图片格式' }
]

export const NOTIFICATION_TYPES = [
  { value: 'trip_update', label: '行程更新提醒' },
  { value: 'promotion', label: '优惠信息推送' },
  { value: 'weather', label: '天气变化提醒' },
  { value: 'system', label: '系统通知' }
]

export const MAP_STYLE_OPTIONS = [
  { value: 'normal', label: '标准地图' },
  { value: 'dark', label: '暗黑地图' },
  { value: 'light', label: '清爽地图' },
  { value: 'whitesmoke', label: '远山黛' },
  { value: 'graffiti', label: '涂鸦地图' }
]

export const ROUTE_TYPE_OPTIONS = [
  { value: 'driving', label: '驾车' },
  { value: 'walking', label: '步行' },
  { value: 'transit', label: '公交' },
  { value: 'riding', label: '骑行' }
]

export const WEEKDAY_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

export const MONTH_NAMES = [
  '一月', '二月', '三月', '四月', '五月', '六月',
  '七月', '八月', '九月', '十月', '十一月', '十二月'
]

export const CHANGSHA_CENTER = {
  latitude: 28.2282,
  longitude: 112.9388
}

export const DEFAULT_MAP_ZOOM = 12
export const MIN_MAP_ZOOM = 8
export const MAX_MAP_ZOOM = 18

export const PAGE_SIZE_OPTIONS = [10, 20, 30, 50]

export const STORAGE_KEYS = {
  SESSION_ID: 'sessionId',
  USER_INFO: 'userInfo',
  USER_PREFERENCES: 'userPreferences',
  MAP_SETTINGS: 'mapSettings',
  NOTIFICATION_SETTINGS: 'notificationSettings',
  RECENT_SEARCHES: 'recentSearches',
  VIEWED_ATTRACTION: 'viewedAttraction'
}

export const API_ENDPOINTS = {
  HEALTH: '/api/health',
  CHAT: '/api/chat',
  TRIPS: '/api/trips',
  ATTRACTIONS: '/api/attractions',
  RESTAURANTS: '/api/restaurants',
  HOTELS: '/api/hotels',
  STRATEGIES: '/api/strategies',
  WEATHER: '/api/weather',
  SEARCH: '/api/search',
  RECOMMENDATIONS: '/api/recommendations',
  AUTH_LOGIN: '/api/auth/login',
  AUTH_REGISTER: '/api/auth/register',
  AUTH_LOGOUT: '/api/auth/logout',
  USER_PROFILE: '/api/user/profile',
  USER_PREFERENCES: '/api/user/preferences',
  USER_PASSWORD: '/api/user/password'
}

export const ANIMATION_DURATION = {
  FAST: 150,
  NORMAL: 300,
  SLOW: 500
}

export const TOAST_DURATION = {
  SHORT: 2000,
  NORMAL: 3000,
  LONG: 5000
}

export const MAX_FILE_SIZE = 10 * 1024 * 1024

export const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

export const CHANGSHA_ATTRACTION_IDS = {
  ORANGE_ISLAND: 'B0FFF4A0E4',
  YUELU_MOUNTAIN: 'B0FFF4A0E5',
  HUNAN_MUSEUM: 'B0FFF4A0E6',
  TAIPING_STREET: 'B0FFF4A0E7',
  WUYI_SQUARE: 'B0FFF4A0E8',
  WORLD_WINDOW: 'B0FFF4A0E9'
}
