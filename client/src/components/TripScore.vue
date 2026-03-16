<template>
  <div class="trip-score">
    <div class="score-header">
      <h4>行程智能评分</h4>
      <el-tag :type="scoreLevel.type" size="small">{{ scoreLevel.label }}</el-tag>
    </div>
    
    <div class="score-main">
      <div class="score-circle" :style="{ '--score-color': scoreLevel.color }">
        <div class="circle-bg"></div>
        <div class="circle-progress" :style="{ '--progress': score / 100 }"></div>
        <div class="circle-text">
          <span class="score-value">{{ animatedScore }}</span>
          <span class="score-unit">分</span>
        </div>
      </div>
      
      <div class="score-details">
        <div 
          v-for="item in scoreItems" 
          :key="item.key"
          class="score-item"
        >
          <div class="item-header">
            <span class="item-icon">{{ item.icon }}</span>
            <span class="item-name">{{ item.name }}</span>
            <span class="item-value">{{ item.score }}分</span>
          </div>
          <div class="item-bar">
            <div 
              class="bar-fill" 
              :style="{ 
                width: `${item.score}%`,
                background: item.color 
              }"
            ></div>
          </div>
          <div class="item-suggestion" v-if="item.suggestion">
            <el-icon><InfoFilled /></el-icon>
            {{ item.suggestion }}
          </div>
        </div>
      </div>
    </div>
    
    <div class="score-optimization" v-if="optimizations.length > 0">
      <div class="optimization-header">
        <el-icon><MagicStick /></el-icon>
        <span>优化建议</span>
      </div>
      <div class="optimization-list">
        <div 
          v-for="(opt, idx) in optimizations" 
          :key="idx"
          class="optimization-item"
        >
          <span class="opt-icon">{{ opt.icon }}</span>
          <span class="opt-text">{{ opt.text }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { InfoFilled, MagicStick } from '@element-plus/icons-vue'

const props = defineProps({
  itinerary: {
    type: Array,
    default: () => []
  },
  requirements: {
    type: Object,
    default: () => ({})
  }
})

const animatedScore = ref(0)
const score = ref(0)

const scoreLevel = computed(() => {
  const s = score.value
  if (s >= 90) return { label: '优秀', type: 'success', color: '#67c23a' }
  if (s >= 75) return { label: '良好', type: '', color: '#409eff' }
  if (s >= 60) return { label: '合格', type: 'warning', color: '#e6a23c' }
  return { label: '待优化', type: 'danger', color: '#f56c6c' }
})

const scoreItems = computed(() => {
  const items = []
  const itinerary = props.itinerary || []
  const req = props.requirements || {}
  
  const totalAttractions = itinerary.reduce((sum, day) => sum + (day.attractions?.length || 0), 0)
  const totalRestaurants = itinerary.reduce((sum, day) => sum + (day.restaurants?.length || 0), 0)
  const totalHotels = itinerary.reduce((sum, day) => sum + (day.hotels?.length || 0), 0)
  const days = itinerary.length || 1
  
  items.push({
    key: 'diversity',
    name: '景点多样性',
    icon: '📍',
    score: Math.min(100, totalAttractions * 15),
    color: 'linear-gradient(90deg, #9dddd8, #7dcfca)',
    suggestion: totalAttractions < 3 ? '建议增加更多景点' : ''
  })
  
  items.push({
    key: 'food',
    name: '美食丰富度',
    icon: '🍜',
    score: Math.min(100, totalRestaurants * 12),
    color: 'linear-gradient(90deg, #8cd0cb, #a8ddd9)',
    suggestion: totalRestaurants < 3 ? '可以探索更多当地美食' : ''
  })
  
  items.push({
    key: 'balance',
    name: '行程平衡度',
    icon: '⚖️',
    score: calculateBalanceScore(itinerary),
    color: 'linear-gradient(90deg, #6dc5c0, #9dddd8)',
    suggestion: ''
  })
  
  items.push({
    key: 'coverage',
    name: '区域覆盖度',
    icon: '🗺️',
    score: calculateCoverageScore(itinerary),
    color: 'linear-gradient(90deg, #5db8b3, #8cd0cb)',
    suggestion: ''
  })
  
  items.push({
    key: 'match',
    name: '需求匹配度',
    icon: '🎯',
    score: calculateMatchScore(itinerary, req),
    color: 'linear-gradient(90deg, #4da8a3, #7dcfca)',
    suggestion: ''
  })
  
  return items
})

const optimizations = computed(() => {
  const opts = []
  const items = scoreItems.value
  
  items.forEach(item => {
    if (item.score < 60 && item.suggestion) {
      opts.push({
        icon: item.icon,
        text: item.suggestion
      })
    }
  })
  
  if (opts.length === 0) {
    opts.push({
      icon: '✨',
      text: '您的行程规划非常棒！'
    })
  }
  
  return opts
})

const calculateBalanceScore = (itinerary) => {
  if (itinerary.length === 0) return 50
  
  const activitiesPerDay = itinerary.map(day => 
    (day.attractions?.length || 0) + (day.restaurants?.length || 0)
  )
  
  const avg = activitiesPerDay.reduce((a, b) => a + b, 0) / activitiesPerDay.length
  const variance = activitiesPerDay.reduce((sum, n) => sum + Math.pow(n - avg, 2), 0) / activitiesPerDay.length
  
  return Math.max(0, Math.min(100, 100 - variance * 5))
}

const calculateCoverageScore = (itinerary) => {
  const areas = new Set()
  itinerary.forEach(day => {
    day.attractions?.forEach(a => {
      const addr = a.address || ''
      if (addr.includes('岳麓')) areas.add('岳麓')
      if (addr.includes('天心')) areas.add('天心')
      if (addr.includes('芙蓉')) areas.add('芙蓉')
      if (addr.includes('开福')) areas.add('开福')
      if (addr.includes('雨花')) areas.add('雨花')
    })
  })
  
  return Math.min(100, areas.size * 20)
}

const calculateMatchScore = (itinerary, req) => {
  let score = 70
  
  if (req.interests?.includes('美食') || req.interests?.includes('fine_dining')) {
    const totalRestaurants = itinerary.reduce((sum, day) => sum + (day.restaurants?.length || 0), 0)
    if (totalRestaurants >= 3) score += 10
  }
  
  if (req.interests?.includes('文化') || req.interests?.includes('culture')) {
    const hasMuseum = itinerary.some(day => 
      day.attractions?.some(a => 
        a.name?.includes('博物馆') || a.name?.includes('书院')
      )
    )
    if (hasMuseum) score += 10
  }
  
  return Math.min(100, score)
}

const animateScore = () => {
  const totalScore = scoreItems.value.reduce((sum, item) => sum + item.score, 0) / scoreItems.value.length
  score.value = Math.round(totalScore)
  
  const duration = 1500
  const startTime = performance.now()
  const startValue = animatedScore.value
  const endValue = score.value
  
  const animate = (currentTime) => {
    const elapsed = currentTime - startTime
    const progress = Math.min(elapsed / duration, 1)
    const easeOut = 1 - Math.pow(1 - progress, 3)
    
    animatedScore.value = Math.round(startValue + (endValue - startValue) * easeOut)
    
    if (progress < 1) {
      requestAnimationFrame(animate)
    }
  }
  
  requestAnimationFrame(animate)
}

watch(() => props.itinerary, animateScore, { deep: true })

onMounted(animateScore)
</script>

<style scoped>
.trip-score {
  background: #fff;
  border-radius: 12px;
  padding: 16px;
}

.score-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.score-header h4 {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  margin: 0;
}

.score-main {
  display: flex;
  gap: 24px;
  margin-bottom: 20px;
}

.score-circle {
  position: relative;
  width: 100px;
  height: 100px;
  flex-shrink: 0;
}

.circle-bg {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: #f0f0f0;
}

.circle-progress {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: conic-gradient(
    var(--score-color) calc(var(--progress) * 360deg),
    transparent calc(var(--progress) * 360deg)
  );
  transition: background 1s ease;
}

.circle-progress::before {
  content: '';
  position: absolute;
  inset: 8px;
  border-radius: 50%;
  background: #fff;
}

.circle-text {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
}

.score-value {
  font-size: 28px;
  font-weight: 700;
  color: var(--score-color);
}

.score-unit {
  font-size: 12px;
  color: #909399;
}

.score-details {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.score-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.item-header {
  display: flex;
  align-items: center;
  gap: 6px;
}

.item-icon {
  font-size: 14px;
}

.item-name {
  font-size: 12px;
  color: #606266;
  flex: 1;
}

.item-value {
  font-size: 12px;
  font-weight: 600;
  color: #303133;
}

.item-bar {
  height: 4px;
  background: #f0f0f0;
  border-radius: 2px;
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 1s ease;
}

.item-suggestion {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: #e6a23c;
}

.score-optimization {
  background: linear-gradient(135deg, #f5f7fa 0%, #e4e7ed 100%);
  border-radius: 8px;
  padding: 12px;
}

.optimization-header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 8px;
}

.optimization-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.optimization-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #606266;
}

.opt-icon {
  font-size: 14px;
}
</style>
