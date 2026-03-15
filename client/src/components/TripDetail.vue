<template>
  <div class="trip-detail">
    <div class="detail-header">
      <h2>行程详情</h2>
      <div class="header-actions">
        <el-button v-if="hasItinerary" size="small" @click="printTrip">打印</el-button>
        <el-button v-if="hasItinerary" size="small" @click="shareTrip">分享</el-button>
        <el-button v-if="hasItinerary" size="small" @click="exportTrip">导出</el-button>
        <el-button v-if="hasItinerary" size="small" :type="isTripFavorited ? 'warning' : 'primary'" @click="toggleTripFavorite">
          {{ isTripFavorited ? '已收藏' : '收藏' }}
        </el-button>
      </div>
    </div>

    <div v-if="hasParams" class="trip-summary">
      <div class="summary-title">
        <el-icon><Collection /></el-icon>
        需求收集进度
      </div>
      <div class="params-grid">
        <div class="param-item" :class="{ filled: tripStore.tripParams.days }">
          <span class="param-label">出行天数</span>
          <span class="param-value">
            <template v-if="tripStore.tripParams.days">
              <el-tag size="small" type="success">{{ tripStore.tripParams.days }}天</el-tag>
            </template>
            <template v-else>
              <el-tag size="small" type="info">待确认</el-tag>
            </template>
          </span>
        </div>
        <div class="param-item" :class="{ filled: tripStore.tripParams.crowd }">
          <span class="param-label">出行人群</span>
          <span class="param-value">
            <template v-if="tripStore.tripParams.crowd">
              <el-tag size="small" type="success">{{ tripStore.tripParams.crowd }}</el-tag>
            </template>
            <template v-else>
              <el-tag size="small" type="info">待确认</el-tag>
            </template>
          </span>
        </div>
        <div class="param-item" :class="{ filled: tripStore.tripParams.budget }">
          <span class="param-label">预算范围</span>
          <span class="param-value">
            <template v-if="tripStore.tripParams.budget">
              <el-tag size="small" type="success">{{ tripStore.tripParams.budget }}元</el-tag>
            </template>
            <template v-else>
              <el-tag size="small" type="info">待确认</el-tag>
            </template>
          </span>
        </div>
        <div v-if="tripStore.tripParams.interests?.length" class="param-item filled">
          <span class="param-label">兴趣偏好</span>
          <span class="param-value">
            <el-tag v-for="i in tripStore.tripParams.interests" :key="i" size="small" type="warning" style="margin-right: 4px;">{{ i }}</el-tag>
          </span>
        </div>
      </div>
      <div class="progress-bar">
        <el-progress :percentage="collectProgress" :status="collectProgress === 100 ? 'success' : ''" />
      </div>
    </div>

    <div v-if="hasItinerary" class="daily-trips">
      <el-tabs v-model="activeDay" type="border-card" @tab-change="handleDayChange">
        <el-tab-pane
          v-for="(dayTrip, idx) in tripStore.itinerary"
          :key="idx"
          :label="'第 ' + dayTrip.day + ' 天'"
          :name="String(dayTrip.day)"
        >
          <div class="day-info">
            <span class="day-date">{{ dayTrip.date }}</span>
            <span v-if="dayTrip.weather" class="day-weather">
              <el-icon><Sunny /></el-icon>
              {{ dayTrip.weather.dayWeather }} {{ dayTrip.weather.dayTemp }}°C
            </span>
          </div>
          
          <div class="day-content-scroll">
            <div class="day-attractions">
              <div class="section-header">
                <div class="section-title">
                  <el-icon><Location /></el-icon>
                  景点安排
                </div>
                <el-button size="small" @click="handleRefreshAttractions(dayTrip.day)">
                  <el-icon><Refresh /></el-icon>
                  换一批
                </el-button>
              </div>
              <div
                v-for="(attr, attrIdx) in dayTrip.attractions"
                :key="attrIdx"
                class="attraction-card"
                :class="{ active: selectedAttraction?.id === attr.id }"
                @click="selectAttraction(attr)"
              >
                <div class="attr-order">{{ attr.order }}</div>
                <div class="attr-content">
                  <div class="attr-header">
                    <span class="attr-name">{{ attr.name }}</span>
                    <el-tag size="small" type="info">{{ attr.bestTime }}</el-tag>
                  </div>
                  <div class="attr-meta">
                    <span v-if="attr.ticketPrice !== undefined">
                      <el-icon><Ticket /></el-icon>
                      {{ attr.ticketPrice > 0 ? '¥' + attr.ticketPrice : '免费' }}
                    </span>
                    <span>
                      <el-icon><Clock /></el-icon>
                      {{ attr.estimatedDuration }}小时
                    </span>
                    <span v-if="attr.rating">
                      <el-icon><Star /></el-icon>
                      {{ attr.rating }}
                    </span>
                  </div>
                  <div class="attr-address">{{ attr.address }}</div>
                  <div v-if="attr.description || attr.reason" class="attr-description">
                    <el-tooltip 
                      :content="attr.description || attr.reason" 
                      placement="top"
                      :disabled="!(attr.description || attr.reason) || (attr.description || attr.reason).length <= 50"
                    >
                      <span class="desc-text">{{ truncateText(attr.description || attr.reason, 50) }}</span>
                    </el-tooltip>
                  </div>
                </div>
                <el-button 
                  class="favorite-btn"
                  :type="isFavorited('attraction', attr.id) ? 'danger' : 'default'"
                  :icon="isFavorited('attraction', attr.id) ? 'StarFilled' : 'Star'"
                  circle
                  size="small"
                  @click.stop="toggleFavorite('attraction', attr)"
                />
              </div>
            </div>

            <div v-if="dayTrip.restaurants && dayTrip.restaurants.length > 0" class="day-restaurants">
              <div class="section-header">
                <div class="section-title">
                  <el-icon><Food /></el-icon>
                  美食推荐
                </div>
                <div class="section-actions">
                  <el-select v-model="selectedCuisine" size="small" @change="handleCuisineChange" placeholder="分类">
                    <el-option label="全部" value="all"></el-option>
                    <el-option label="湘菜" value="湘菜"></el-option>
                    <el-option label="小吃" value="小吃"></el-option>
                    <el-option label="西餐" value="西餐"></el-option>
                    <el-option label="其他" value="其他"></el-option>
                  </el-select>
                  <el-button size="small" @click="handleRefreshRestaurants(dayTrip.day)">
                    <el-icon><Refresh /></el-icon>
                    换一批
                  </el-button>
                </div>
              </div>
              <div class="restaurant-list">
                <div v-for="(rest, rIdx) in filteredRestaurants(dayTrip.restaurants)" :key="rIdx" class="restaurant-item" @click="selectRestaurant(rest)" :class="{ active: selectedRestaurant?.id === rest.id }">
                  <div class="rest-info">
                    <span class="rest-name">{{ rest.name }}</span>
                    <span class="rest-type">{{ rest.cuisine || '湘菜' }}</span>
                  </div>
                  <div class="rest-meta">
                    <span v-if="rest.rating" class="rest-rating">
                      <el-icon><Star /></el-icon>
                      {{ rest.rating }}
                    </span>
                    <span class="rest-price">人均¥{{ rest.avgPrice || 50 }}</span>
                  </div>
                  <div v-if="rest.description || rest.specialty" class="item-description">
                    <el-tooltip 
                      :content="rest.description || rest.specialty" 
                      placement="top"
                      :disabled="!(rest.description || rest.specialty) || (rest.description || rest.specialty).length <= 40"
                    >
                      <span class="desc-text">{{ truncateText(rest.description || rest.specialty, 40) }}</span>
                    </el-tooltip>
                  </div>
                  <el-button 
                    class="favorite-btn"
                    :type="isFavorited('restaurant', rest.id) ? 'danger' : 'default'"
                    :icon="isFavorited('restaurant', rest.id) ? 'StarFilled' : 'Star'"
                    circle
                    size="small"
                    @click.stop="toggleFavorite('restaurant', rest)"
                  />
                </div>
              </div>
            </div>

            <div v-if="dayTrip.hotels && dayTrip.hotels.length > 0" class="day-hotels">
              <div class="section-header">
                <div class="section-title">
                  <el-icon><House /></el-icon>
                  住宿推荐
                </div>
                <div class="section-actions">
                  <el-select v-model="selectedHotelStar" size="small" @change="handleHotelStarChange" placeholder="星级">
                    <el-option label="全部" value="all"></el-option>
                    <el-option label="5星级" value="5"></el-option>
                    <el-option label="4星级" value="4"></el-option>
                    <el-option label="3星级" value="3"></el-option>
                    <el-option label="经济型" value="2"></el-option>
                  </el-select>
                  <el-button size="small" @click="handleRefreshHotels(dayTrip.day)">
                    <el-icon><Refresh /></el-icon>
                    换一批
                  </el-button>
                </div>
              </div>
              <div class="hotel-list">
                <div v-for="(hotel, hIdx) in filteredHotels(dayTrip.hotels)" :key="hIdx" class="hotel-item" @click="selectHotel(hotel)" :class="{ active: selectedHotel?.id === hotel.id }">
                  <div class="hotel-info">
                    <span class="hotel-name">{{ hotel.name }}</span>
                    <span v-if="hotel.starRating" class="hotel-star">
                      <el-tag size="small" type="warning">{{ hotel.starRating }}星级</el-tag>
                    </span>
                    <span v-if="hotel.pricePerNight || hotel.price" class="hotel-price-tag">
                      ¥{{ hotel.pricePerNight || hotel.price }}/晚
                    </span>
                  </div>
                  <div class="hotel-meta">
                    <span class="hotel-address">{{ hotel.district || hotel.address }}</span>
                    <span v-if="hotel.rating" class="hotel-rating">
                      <el-icon><Star /></el-icon>
                      {{ hotel.rating }}
                    </span>
                  </div>
                  <div v-if="hotel.description || hotel.features || hotel.note" class="item-description">
                    <el-tooltip 
                      :content="hotel.description || hotel.features || hotel.note" 
                      placement="top"
                      :disabled="!(hotel.description || hotel.features || hotel.note) || (hotel.description || hotel.features || hotel.note).length <= 40"
                    >
                      <span class="desc-text">{{ truncateText(hotel.description || hotel.features || hotel.note, 40) }}</span>
                    </el-tooltip>
                  </div>
                  <el-button 
                    class="favorite-btn"
                    :type="isFavorited('hotel', hotel.id) ? 'danger' : 'default'"
                    :icon="isFavorited('hotel', hotel.id) ? 'StarFilled' : 'Star'"
                    circle
                    size="small"
                    @click.stop="toggleFavorite('hotel', hotel)"
                  />
                </div>
              </div>
            </div>

            <div v-if="dayTrip.weatherAdvice" class="weather-advice">
              <el-icon><Sunny /></el-icon>
              {{ dayTrip.weatherAdvice }}
            </div>
          </div>
          
          <div class="day-stats">
            <el-statistic title="景点数量" :value="dayTrip.attractions?.length || 0" />
            <el-popover placement="top" trigger="hover" width="220">
              <template #reference>
                <el-statistic title="预计花费" :value="calculateDayCost(dayTrip)" suffix="元" class="cost-statistic" />
              </template>
              <div class="cost-breakdown">
                <div class="cost-title">费用明细</div>
                <div v-for="(item, idx) in getCostBreakdown(dayTrip)" :key="idx" class="cost-item">
                  <span>{{ item.icon }} {{ item.label }}</span>
                  <span>¥{{ item.amount }}</span>
                </div>
                <div v-if="dayTrip.dailyCost?.emergencyFund" class="cost-item emergency">
                  <span>应急备用</span>
                  <span>¥{{ dayTrip.dailyCost.emergencyFund }}</span>
                </div>
                <div class="cost-divider"></div>
                <div class="cost-item total">
                  <span>总计</span>
                  <span>¥{{ calculateDayCost(dayTrip) }}</span>
                </div>
              </div>
            </el-popover>
          </div>
          
          <div v-if="isOverBudget" class="budget-warning">
            <el-icon><Warning /></el-icon>
            <span>预算超支警告：当前总花费 ¥{{ totalCost }}，超出预算 ¥{{ overBudgetAmount }}</span>
            <el-button size="small" type="warning" @click="showBudgetTips">查看建议</el-button>
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>

    <el-empty v-else-if="!hasParams" description="请通过左侧 AI 助手规划您的行程">
      <template #image>
        <el-icon :size="64" color="#c0c4cc"><MapLocation /></el-icon>
      </template>
    </el-empty>
    
    <div v-else class="waiting-status">
      <el-icon class="loading-icon"><Loading /></el-icon>
      <p>正在收集需求信息...</p>
      <p class="hint">请继续与 AI 助手对话</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, reactive } from 'vue'
import { useTripStore } from '../stores/trip'
import { useMapStore } from '../stores/map'
import { ElMessage, ElMessageBox } from 'element-plus'
import { planAPI } from '../api'
import { Sunny, Location, Clock, Star, Ticket, Food, MapLocation, Collection, Loading, House, Refresh, Warning, StarFilled } from '@element-plus/icons-vue'

const tripStore = useTripStore()
const mapStore = useMapStore()

const activeDay = ref('1')
const selectedAttraction = ref(null)
const selectedRestaurant = ref(null)
const selectedHotel = ref(null)
const selectedCuisine = ref('all')
const selectedHotelStar = ref('all')

const favorites = reactive({
  attractions: new Set(),
  restaurants: new Set(),
  hotels: new Set()
})

const hasParams = computed(() => {
  return tripStore.tripParams.days || tripStore.tripParams.crowd || tripStore.tripParams.budget
})

const hasItinerary = computed(() => {
  return tripStore.itinerary && tripStore.itinerary.length > 0
})

const totalCost = computed(() => {
  if (!tripStore.itinerary) return 0
  return tripStore.itinerary.reduce((sum, day) => sum + calculateDayCost(day), 0)
})

const budgetValue = computed(() => {
  const budget = tripStore.tripParams.budget
  if (!budget) return null
  if (typeof budget === 'string') {
    const match = budget.match(/(\d+)/)
    return match ? parseInt(match[1]) : null
  }
  return budget
})

const isOverBudget = computed(() => {
  if (!budgetValue.value || !totalCost.value) return false
  return totalCost.value > budgetValue.value
})

const overBudgetAmount = computed(() => {
  if (!isOverBudget.value) return 0
  return totalCost.value - budgetValue.value
})

const collectProgress = computed(() => {
  let progress = 0
  if (tripStore.tripParams.days) progress += 33
  if (tripStore.tripParams.crowd) progress += 33
  if (tripStore.tripParams.budget) progress += 34
  return progress
})

// 先定义函数，再使用watch
const scrollToAttraction = (index) => {
  nextTick(() => {
    const cards = document.querySelectorAll('.attraction-card')
    if (cards[index]) {
      cards[index].scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  })
}

const updateMapMarkers = () => {
  const dayTrip = tripStore.itinerary.find(d => String(d.day) === activeDay.value)
  if (dayTrip && dayTrip.attractions && dayTrip.attractions.length > 0) {
    const firstAttr = dayTrip.attractions[0]
    if (firstAttr.latitude && firstAttr.longitude) {
      mapStore.setCenter(firstAttr.latitude, firstAttr.longitude)
    }
  }
}

const handleDayChange = (day) => {
  updateMapMarkers()
}

watch(() => tripStore.itinerary, (newItinerary) => {
  if (newItinerary && newItinerary.length > 0) {
    console.log('行程数据更新:', newItinerary)
    updateMapMarkers()
  }
}, { deep: true, immediate: true })

watch(() => tripStore.tripParams, (newParams) => {
  console.log('需求参数更新:', newParams)
}, { deep: true })

watch(() => mapStore.selectedLocation, (newLocation) => {
  if (newLocation && newLocation.day) {
    activeDay.value = String(newLocation.day)
    const dayTrip = tripStore.itinerary.find(d => d.day === newLocation.day)
    if (dayTrip && dayTrip.attractions && dayTrip.attractions[newLocation.index]) {
      selectedAttraction.value = dayTrip.attractions[newLocation.index]
      scrollToAttraction(newLocation.index)
    }
  }
}, { deep: true })

const selectAttraction = (attraction) => {
  selectedAttraction.value = attraction
  selectedRestaurant.value = null
  selectedHotel.value = null
  if (attraction.latitude && attraction.longitude) {
    mapStore.focusLocation(attraction.latitude, attraction.longitude, 16)
    mapStore.setHighlightMarker(attraction.id)
    ElMessage.info(`景点: ${attraction.name}`)
  }
}

const selectRestaurant = (restaurant) => {
  selectedRestaurant.value = restaurant
  selectedAttraction.value = null
  selectedHotel.value = null
  if (restaurant.latitude && restaurant.longitude) {
    mapStore.focusLocation(restaurant.latitude, restaurant.longitude, 16)
    mapStore.setHighlightMarker(restaurant.id)
    ElMessage.info(`餐厅: ${restaurant.name}`)
  }
}

const selectHotel = (hotel) => {
  selectedHotel.value = hotel
  selectedAttraction.value = null
  selectedRestaurant.value = null
  if (hotel.latitude && hotel.longitude) {
    mapStore.focusLocation(hotel.latitude, hotel.longitude, 16)
    mapStore.setHighlightMarker(hotel.id)
    ElMessage.info(`酒店: ${hotel.name}`)
  }
}

const calculateDayCost = (dayTrip) => {
  if (dayTrip.dailyCost?.total) {
    return dayTrip.dailyCost.total
  }
  
  let cost = 0
  if (dayTrip.attractions) {
    cost += dayTrip.attractions.reduce((sum, a) => sum + (a.ticketPrice || 0), 0)
  }
  if (dayTrip.restaurants) {
    cost += dayTrip.restaurants.reduce((sum, r) => sum + (r.avgPrice || 0), 0)
  }
  if (dayTrip.hotels && dayTrip.hotels.length > 0) {
    cost += (dayTrip.hotels[0].pricePerNight || 0)
  }
  if (dayTrip.transportation) {
    cost += dayTrip.transportation.reduce((sum, t) => sum + (t.cost || 0), 0)
  }
  return cost
}

const truncateText = (text, maxLength) => {
  if (!text) return ''
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength) + '...'
}

// 获取费用明细
const getCostBreakdown = (dayTrip) => {
  if (!dayTrip.dailyCost) return null
  
  return [
    { label: '景点', amount: dayTrip.dailyCost.attractions || 0, icon: '门票' },
    { label: '餐饮', amount: dayTrip.dailyCost.restaurants || 0, icon: '餐费' },
    { label: '住宿', amount: dayTrip.dailyCost.hotels || 0, icon: '房费' },
    { label: '交通', amount: dayTrip.dailyCost.transportation || 0, icon: '车费' },
    { label: '小吃', amount: dayTrip.dailyCost.snacks || 0, icon: '零食' }
  ].filter(item => item.amount > 0)
}

// 过滤美食
const filteredRestaurants = (restaurants) => {
  if (selectedCuisine.value === 'all') {
    return restaurants
  }
  return restaurants.filter(rest => rest.cuisine === selectedCuisine.value)
}

// 过滤住宿
const filteredHotels = (hotels) => {
  if (selectedHotelStar.value === 'all') {
    return hotels
  }
  return hotels.filter(hotel => hotel.starRating === parseInt(selectedHotelStar.value))
}

// 换一批景点 - 排除所有天已存在的景点
const handleRefreshAttractions = async (day) => {
  ElMessage.info('正在为您更换景点...')
  
  try {
    const sessionId = localStorage.getItem('sessionId')
    const dayTrip = tripStore.itinerary.find(d => d.day === day)
    
    // 收集所有天已存在的景点名称
    const allExistingNames = []
    tripStore.itinerary.forEach(d => {
      if (d.attractions && d.attractions.length > 0) {
        allExistingNames.push(...d.attractions.map(a => a.name))
      }
    })
    
    if (allExistingNames.length === 0) {
      ElMessage.warning('当前行程中没有景点可换')
      return
    }
    
    const res = await planAPI.refreshAttractions(
      allExistingNames,
      sessionId,
      tripStore.tripParams.hotelArea
    )
    
    if (res.code === 200 && res.data && res.data.attractions) {
      tripStore.replaceAttractions(day, res.data.attractions)
      ElMessage.success(res.data.message || '景点已更新')
      await tripStore.autoSave()
    } else {
      ElMessage.error('更换景点失败')
    }
  } catch (error) {
    console.error('更换景点失败:', error)
    ElMessage.error('更换景点失败，请重试')
  }
}

// 换一批美食 - 排除所有天已存在的餐厅
const handleRefreshRestaurants = async (day) => {
  ElMessage.info('正在为您更换美食...')
  
  try {
    const sessionId = localStorage.getItem('sessionId')
    const dayTrip = tripStore.itinerary.find(d => d.day === day)
    
    // 收集所有天已存在的餐厅名称
    const allExistingNames = []
    tripStore.itinerary.forEach(d => {
      if (d.restaurants && d.restaurants.length > 0) {
        allExistingNames.push(...d.restaurants.map(r => r.name))
      }
    })
    
    if (allExistingNames.length === 0) {
      ElMessage.warning('当前行程中没有餐厅可换')
      return
    }
    
    const res = await planAPI.refreshRestaurants(allExistingNames, sessionId)
    
    if (res.code === 200 && res.data && res.data.restaurants) {
      tripStore.replaceRestaurants(day, res.data.restaurants)
      ElMessage.success(res.data.message || '美食已更新')
      await tripStore.autoSave()
    } else {
      ElMessage.error('更换美食失败')
    }
  } catch (error) {
    console.error('更换美食失败:', error)
    ElMessage.error('更换美食失败，请重试')
  }
}

// 换一批住宿 - 排除所有天已存在的酒店
const handleRefreshHotels = async (day) => {
  ElMessage.info('正在为您更换住宿...')
  
  try {
    const sessionId = localStorage.getItem('sessionId')
    const dayTrip = tripStore.itinerary.find(d => d.day === day)
    
    // 收集所有天已存在的酒店名称
    const allExistingNames = []
    tripStore.itinerary.forEach(d => {
      if (d.hotels && d.hotels.length > 0) {
        allExistingNames.push(...d.hotels.map(h => h.name))
      }
    })
    
    if (allExistingNames.length === 0) {
      ElMessage.warning('当前行程中没有酒店可换')
      return
    }
    
    const res = await planAPI.refreshHotels(
      allExistingNames, 
      sessionId,
      tripStore.tripParams.hotelArea
    )
    
    if (res.code === 200 && res.data && res.data.hotels) {
      tripStore.replaceHotels(day, res.data.hotels)
      ElMessage.success(res.data.message || '住宿已更新')
      await tripStore.autoSave()
    } else {
      ElMessage.error('更换住宿失败')
    }
  } catch (error) {
    console.error('更换住宿失败:', error)
    ElMessage.error('更换住宿失败，请重试')
  }
}

// 美食分类变化
const handleCuisineChange = () => {
  console.log('美食分类变化:', selectedCuisine.value)
}

// 住宿星级变化
const handleHotelStarChange = () => {
  console.log('住宿星级变化:', selectedHotelStar.value)
}

const exportTrip = async () => {
  if (!tripStore.itinerary || tripStore.itinerary.length === 0) {
    ElMessage.warning('没有可导出的行程')
    return
  }
  
  ElMessageBox.confirm('请选择导出格式', '导出行程', {
    distinguishCancelAndClose: true,
    confirmButtonText: 'HTML (可打印)',
    cancelButtonText: 'JSON',
    type: 'info'
  }).then(() => {
    downloadExport('html')
  }).catch((action) => {
    if (action === 'cancel') {
      downloadExport('json')
    }
  })
}

const downloadExport = async (format) => {
  try {
    const response = await fetch('/api/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requirements: tripStore.tripParams,
        itinerary: tripStore.itinerary,
        format
      })
    })
    
    const blob = await response.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `长沙旅游行程.${format === 'html' ? 'html' : 'json'}`
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)
    
    ElMessage.success('导出成功')
  } catch (error) {
    console.error('导出失败:', error)
    ElMessage.error('导出失败')
  }
}

const isTripFavorited = ref(false)

const checkFavoriteStatus = async () => {
  const tripId = tripStore.tripId || localStorage.getItem('currentTripId')
  if (!tripId) {
    isTripFavorited.value = false
    return
  }
  
  try {
    const res = await fetch(`/api/trips/${tripId}`)
    if (res.code === 200 && res.data) {
      isTripFavorited.value = res.data.isFavorite === true
    }
  } catch (error) {
    console.error('检查收藏状态失败:', error)
  }
}

const toggleTripFavorite = async () => {
  if (!tripStore.itinerary || tripStore.itinerary.length === 0) {
    ElMessage.warning('没有可收藏的行程')
    return
  }
  
  try {
    const sessionId = localStorage.getItem('sessionId')
    const tripId = tripStore.tripId || localStorage.getItem('currentTripId')
    
    if (!tripId) {
      ElMessage.warning('请先生成行程')
      return
    }
    
    const res = await fetch(`/api/trips/${tripId}/favorite`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-Session-Id': sessionId || ''
      },
      body: JSON.stringify({ isFavorite: !isTripFavorited.value })
    }).then(r => r.json())
    
    if (res.code === 200) {
      isTripFavorited.value = !isTripFavorited.value
      ElMessage.success(isTripFavorited.value ? '已收藏行程' : '已取消收藏')
    } else {
      ElMessage.error('操作失败：' + (res.message || '未知错误'))
    }
  } catch (error) {
    console.error('收藏操作失败:', error)
    ElMessage.error('收藏操作失败')
  }
}

const shareTrip = async () => {
  const tripId = localStorage.getItem('currentTripId')
  
  if (!tripId) {
    ElMessage.warning('请先保存行程后再分享')
    return
  }
  
  try {
    const res = await fetch(`/api/trips/${tripId}/share`, {
      method: 'POST'
    }).then(r => r.json())
    
    if (res.code === 200) {
      const shareUrl = res.data.shareUrl
      
      await navigator.clipboard.writeText(shareUrl)
      ElMessage.success('分享链接已复制到剪贴板')
      
      ElMessageBox.alert(
        `分享链接：${shareUrl}\n有效期：7天`,
        '分享成功',
        {
          confirmButtonText: '复制链接',
          type: 'success'
        }
      ).then(() => {
        navigator.clipboard.writeText(shareUrl)
      })
    } else {
      ElMessage.error('生成分享链接失败')
    }
  } catch (error) {
    console.error('分享失败:', error)
    ElMessage.error('分享失败')
  }
}

const showBudgetTips = () => {
  const tips = [
    '节省建议:',
    '1. 选择免费景点替代收费景点',
    '2. 增加小吃比例，减少正餐',
    '3. 选择经济型酒店或青年旅社',
    '4. 多使用地铁和公交，减少打车',
    '5. 避开景区内的餐厅，选择周边小店'
  ]
  
  ElMessageBox.alert(tips.join('\n'), '预算优化建议', {
    confirmButtonText: '我知道了',
    type: 'warning'
  })
}

const isFavorited = (type, id) => {
  return favorites[type + 's']?.has(id) || false
}

const toggleFavorite = async (type, item) => {
  const typeMap = {
    attraction: 'attractions',
    restaurant: 'restaurants',
    hotel: 'hotels'
  }
  
  const setType = typeMap[type]
  const isCurrentlyFavorited = favorites[setType].has(item.id)
  
  try {
    if (isCurrentlyFavorited) {
      const res = await fetch(`/api/favorites/${type}/${item.id}`, {
        method: 'DELETE',
        headers: {
          'X-Session-Id': localStorage.getItem('sessionId') || ''
        }
      }).then(r => r.json())
      
      if (res.code === 200) {
        favorites[setType].delete(item.id)
        ElMessage.success('已取消收藏')
      }
    } else {
      const res = await fetch(`/api/favorites/${type}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Id': localStorage.getItem('sessionId') || ''
        },
        body: JSON.stringify({ item })
      }).then(r => r.json())
      
      if (res.code === 200) {
        favorites[setType].add(item.id)
        ElMessage.success('收藏成功')
      }
    }
  } catch (error) {
    console.error('收藏操作失败:', error)
    ElMessage.error('操作失败，请重试')
  }
}

const loadFavorites = async () => {
  try {
    const res = await fetch('/api/favorites', {
      headers: {
        'X-Session-Id': localStorage.getItem('sessionId') || ''
      }
    }).then(r => r.json())
    
    if (res.code === 200 && res.data) {
      favorites.attractions = new Set(res.data.attractions?.map(a => a.id) || [])
      favorites.restaurants = new Set(res.data.restaurants?.map(r => r.id) || [])
      favorites.hotels = new Set(res.data.hotels?.map(h => h.id) || [])
    }
  } catch (error) {
    console.error('加载收藏失败:', error)
  }
}

loadFavorites()

const printTrip = async () => {
  if (!tripStore.itinerary || tripStore.itinerary.length === 0) {
    ElMessage.warning('没有可打印的行程')
    return
  }
  
  try {
    const response = await fetch('/api/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requirements: tripStore.tripParams,
        itinerary: tripStore.itinerary,
        format: 'html'
      })
    })
    
    const html = await response.text()
    
    const printWindow = window.open('', '_blank')
    printWindow.document.write(html)
    printWindow.document.close()
    
    setTimeout(() => {
      printWindow.print()
    }, 500)
  } catch (error) {
    console.error('打印失败:', error)
    ElMessage.error('打印失败')
  }
}
</script>

<style scoped>
.trip-detail {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #fff;
  overflow: hidden;
}

.detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #f0f0f0;
  flex-shrink: 0;
}

.detail-header h2 {
  font-size: 16px;
  font-weight: 600;
  color: #1f2937;
  margin: 0;
}

.trip-summary {
  padding: 16px 20px;
  background: #f9fafb;
  border-bottom: 1px solid #f0f0f0;
  flex-shrink: 0;
}

.summary-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 12px;
}

.params-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin-bottom: 12px;
}

.param-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: #fff;
  border-radius: 6px;
  border: 1px solid #e4e7ed;
  transition: all 0.3s;
}

.param-item.filled {
  border-color: #67c23a;
  background: #f0f9eb;
}

.param-label {
  font-size: 13px;
  color: #909399;
}

.param-value {
  font-size: 13px;
}

.progress-bar {
  margin-top: 8px;
}

.daily-trips {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.daily-trips :deep(.el-tabs) {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.daily-trips :deep(.el-tabs__header) {
  flex-shrink: 0;
}

.daily-trips :deep(.el-tabs__content) {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.day-content-scroll {
  display: flex;
  flex-direction: column;
  gap: 20px;
  height: 100%;
}

.day-attractions,
.day-restaurants,
.day-hotels {
  flex-shrink: 0;
}

.weather-advice {
  flex-shrink: 0;
}

.day-info {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
  padding: 12px;
  background: #f5f7fa;
  border-radius: 8px;
}

.day-date {
  font-weight: 600;
  color: #303133;
}

.day-weather {
  display: flex;
  align-items: center;
  gap: 4px;
  color: #909399;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  padding-left: 8px;
  border-left: 3px solid #409eff;
}

.section-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.day-attractions {
  margin-bottom: 20px;
}

.attraction-card {
  background-color: #fafafa;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  padding: 12px;
  display: flex;
  gap: 12px;
  cursor: pointer;
  transition: all 0.2s;
  margin-bottom: 8px;
}

.attraction-card:hover {
  border-color: #409eff;
  background-color: #ecf5ff;
}

.attraction-card.active {
  border-color: #409eff;
  background-color: #ecf5ff;
  box-shadow: 0 2px 8px rgba(64, 158, 255, 0.2);
}

.attr-order {
  width: 28px;
  height: 28px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 600;
  flex-shrink: 0;
}

.attr-content {
  flex: 1;
  min-width: 0;
}

.attr-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.attr-name {
  font-size: 15px;
  font-weight: 600;
  color: #303133;
}

.attr-meta {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: #909399;
  margin-bottom: 4px;
}

.attr-meta span {
  display: flex;
  align-items: center;
  gap: 4px;
}

.attr-address {
  font-size: 12px;
  color: #c0c4cc;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.attr-description {
  margin-top: 6px;
  padding: 6px 8px;
  background: #f5f7fa;
  border-radius: 4px;
  font-size: 12px;
  color: #606266;
  line-height: 1.4;
}

.item-description {
  margin-top: 6px;
  padding: 4px 8px;
  background: #f5f7fa;
  border-radius: 4px;
  font-size: 11px;
  color: #909399;
  line-height: 1.4;
}

.desc-text {
  display: inline-block;
  cursor: help;
}

.favorite-btn {
  flex-shrink: 0;
  margin-left: 8px;
}

.favorite-btn:hover {
  transform: scale(1.1);
}

.day-restaurants {
  margin-bottom: 20px;
}

.restaurant-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.restaurant-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background: #fff7e6;
  border-radius: 6px;
  border: 1px solid #ffd591;
  cursor: pointer;
  transition: all 0.3s;
}

.restaurant-item:hover {
  background: #ffe7ba;
  border-color: #ffc53d;
  transform: translateX(4px);
}

.restaurant-item.active {
  background: #ffc53d;
  border-color: #faad14;
  box-shadow: 0 2px 8px rgba(250, 173, 20, 0.3);
}

.rest-name {
  font-size: 14px;
  color: #303133;
}

.rest-price {
  font-size: 12px;
  color: #ff7d00;
  font-weight: 600;
}

.rest-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.rest-type {
  font-size: 11px;
  color: #909399;
  background: #fff;
  padding: 2px 6px;
  border-radius: 4px;
}

.rest-meta {
  display: flex;
  align-items: center;
  gap: 12px;
}

.rest-rating {
  display: flex;
  align-items: center;
  gap: 2px;
  font-size: 12px;
  color: #ff9900;
}

.day-hotels {
  margin-bottom: 20px;
}

.hotel-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.hotel-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px;
  background: #e6f7ff;
  border-radius: 6px;
  border: 1px solid #91d5ff;
  cursor: pointer;
  transition: all 0.3s;
}

.hotel-item:hover {
  background: #bae7ff;
  border-color: #69c0ff;
  transform: translateX(4px);
}

.hotel-item.active {
  background: #69c0ff;
  border-color: #1890ff;
  box-shadow: 0 2px 8px rgba(24, 144, 255, 0.3);
}

.hotel-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.hotel-name {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}

.hotel-price-tag {
  font-size: 14px;
  font-weight: 600;
  color: #ff7d00;
  margin-left: 8px;
}

.hotel-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
}

.hotel-address {
  color: #909399;
}

.hotel-rating {
  display: flex;
  align-items: center;
  gap: 2px;
  color: #ff9900;
}

.weather-advice {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background: linear-gradient(135deg, #e6f7ff 0%, #f0f5ff 100%);
  border-radius: 8px;
  border: 1px solid #91d5ff;
  font-size: 13px;
  color: #1890ff;
  margin-bottom: 16px;
}

.day-stats {
  display: flex;
  gap: 32px;
  justify-content: center;
  padding: 16px;
  background-color: #f5f7fa;
  border-radius: 8px;
}

.cost-statistic {
  cursor: pointer;
}

.cost-statistic:hover {
  color: #667eea;
}

.cost-breakdown {
  padding: 8px;
}

.cost-title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 12px;
  text-align: center;
  border-bottom: 1px solid #e4e7ed;
  padding-bottom: 8px;
}

.cost-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 0;
  font-size: 13px;
  color: #606266;
}

.cost-item.emergency {
  color: #e6a23c;
  background: #fdf6ec;
  padding: 6px 8px;
  border-radius: 4px;
  margin: 4px 0;
}

.cost-divider {
  height: 1px;
  background: #e4e7ed;
  margin: 8px 0;
}

.cost-item.total {
  font-weight: 600;
  color: #303133;
  font-size: 14px;
}

.waiting-status {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #909399;
}

.waiting-status .loading-icon {
  font-size: 48px;
  color: #409eff;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.waiting-status p {
  margin: 8px 0;
}

.waiting-status .hint {
  font-size: 12px;
  color: #c0c4cc;
}

.budget-warning {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: linear-gradient(135deg, #fff7e6 0%, #fff1cc 100%);
  border-radius: 8px;
  border: 1px solid #ffc53d;
  margin-top: 16px;
  font-size: 14px;
  color: #d48806;
}

.budget-warning .el-icon {
  font-size: 18px;
  color: #faad14;
}
</style>
