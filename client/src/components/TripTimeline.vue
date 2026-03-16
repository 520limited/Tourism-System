<template>
  <div class="trip-timeline">
    <div class="timeline-header">
      <h3>行程时间轴</h3>
      <el-button-group size="small">
        <el-button :type="viewMode === 'timeline' ? 'primary' : ''" @click="viewMode = 'timeline'">
          时间轴
        </el-button>
        <el-button :type="viewMode === 'cards' ? 'primary' : ''" @click="viewMode = 'cards'">
          卡片
        </el-button>
      </el-button-group>
    </div>
    
    <div v-if="viewMode === 'timeline'" class="timeline-view">
      <div class="timeline-line"></div>
      
      <div 
        v-for="(day, index) in itinerary" 
        :key="index"
        class="timeline-item"
        :class="{ active: activeDay === index }"
        @click="activeDay = index"
      >
        <div class="timeline-marker">
          <div class="marker-inner">
            <span class="day-number">D{{ day.day }}</span>
          </div>
        </div>
        
        <div class="timeline-content" :style="{ animationDelay: `${index * 0.1}s` }">
          <div class="day-header">
            <div class="day-title">{{ day.title }}</div>
            <div class="day-date">{{ getDayDate(day.day) }}</div>
          </div>
          
          <div class="day-schedule">
            <div 
              v-for="(item, idx) in getDaySchedule(day)" 
              :key="idx"
              class="schedule-item"
              :class="item.type"
            >
              <div class="schedule-time">{{ item.time }}</div>
              <div class="schedule-icon">
                <span v-if="item.type === 'attraction'">📍</span>
                <span v-else-if="item.type === 'restaurant'">🍜</span>
                <span v-else-if="item.type === 'hotel'">🏨</span>
              </div>
              <div class="schedule-info">
                <div class="schedule-name">{{ item.name }}</div>
                <div class="schedule-desc">{{ item.desc }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <div v-else class="cards-view">
      <div 
        v-for="(day, index) in itinerary" 
        :key="index"
        class="day-card"
        :style="{ animationDelay: `${index * 0.15}s` }"
      >
        <div class="card-header">
          <div class="card-day">DAY {{ day.day }}</div>
          <div class="card-title">{{ day.title }}</div>
        </div>
        
        <div class="card-stats">
          <div class="card-stat">
            <el-icon><Location /></el-icon>
            <span>{{ day.attractions?.length || 0 }} 景点</span>
          </div>
          <div class="card-stat">
            <el-icon><Food /></el-icon>
            <span>{{ day.restaurants?.length || 0 }} 美食</span>
          </div>
        </div>
        
        <div class="card-preview">
          <div 
            v-for="attr in day.attractions?.slice(0, 3)" 
            :key="attr.id"
            class="preview-item"
          >
            {{ attr.name }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { Location, Food } from '@element-plus/icons-vue'

const props = defineProps({
  itinerary: {
    type: Array,
    default: () => []
  },
  startDate: {
    type: String,
    default: ''
  }
})

const viewMode = ref('timeline')
const activeDay = ref(0)

const getDayDate = (dayNum) => {
  if (!props.startDate) return `第${dayNum}天`
  const date = new Date(props.startDate)
  date.setDate(date.getDate() + dayNum - 1)
  return date.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })
}

const getDaySchedule = (day) => {
  const schedule = []
  
  day.attractions?.forEach((a, i) => {
    schedule.push({
      type: 'attraction',
      time: `${8 + i * 3}:00`,
      name: a.name,
      desc: a.description || '景点游览'
    })
  })
  
  day.restaurants?.forEach((r, i) => {
    schedule.push({
      type: 'restaurant',
      time: i === 0 ? '12:00' : '18:00',
      name: r.name,
      desc: r.cuisine || '美食体验'
    })
  })
  
  day.hotels?.forEach(h => {
    schedule.push({
      type: 'hotel',
      time: '22:00',
      name: h.name,
      desc: '入住休息'
    })
  })
  
  return schedule.sort((a, b) => {
    const timeA = parseInt(a.time.replace(':', ''))
    const timeB = parseInt(b.time.replace(':', ''))
    return timeA - timeB
  })
}
</script>

<style scoped>
.trip-timeline {
  background: #fff;
  border-radius: 12px;
  padding: 20px;
}

.timeline-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.timeline-header h3 {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  margin: 0;
}

.timeline-view {
  position: relative;
  padding-left: 60px;
}

.timeline-line {
  position: absolute;
  left: 24px;
  top: 0;
  bottom: 0;
  width: 2px;
  background: #9dddd8;
}

.timeline-item {
  position: relative;
  margin-bottom: 24px;
  cursor: pointer;
}

.timeline-marker {
  position: absolute;
  left: -48px;
  top: 0;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.marker-inner {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: #9dddd8;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-weight: 600;
  font-size: 12px;
  box-shadow: 0 4px 12px rgba(157, 221, 216, 0.4);
  transition: transform 0.3s;
}

.timeline-item:hover .marker-inner,
.timeline-item.active .marker-inner {
  transform: scale(1.1);
}

.timeline-content {
  background: #f9fafb;
  border-radius: 12px;
  padding: 16px;
  animation: slideIn 0.5s ease-out forwards;
  opacity: 0;
  transform: translateX(-20px);
}

@keyframes slideIn {
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.day-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.day-title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}

.day-date {
  font-size: 12px;
  color: #909399;
}

.day-schedule {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.schedule-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  background: #fff;
  border-radius: 8px;
  transition: transform 0.2s;
}

.schedule-item:hover {
  transform: translateX(4px);
}

.schedule-time {
  font-size: 12px;
  color: #909399;
  width: 40px;
  flex-shrink: 0;
}

.schedule-icon {
  font-size: 18px;
}

.schedule-info {
  flex: 1;
}

.schedule-name {
  font-size: 13px;
  font-weight: 500;
  color: #303133;
}

.schedule-desc {
  font-size: 11px;
  color: #909399;
}

.cards-view {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
}

.day-card {
  background: linear-gradient(135deg, #9dddd8 0%, #7dcfca 100%);
  border-radius: 12px;
  padding: 16px;
  color: #fff;
  animation: fadeIn 0.5s ease-out forwards;
  opacity: 0;
  transform: translateY(20px);
}

@keyframes fadeIn {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.card-header {
  margin-bottom: 12px;
}

.card-day {
  font-size: 12px;
  opacity: 0.8;
  margin-bottom: 4px;
}

.card-title {
  font-size: 14px;
  font-weight: 600;
}

.card-stats {
  display: flex;
  gap: 16px;
  margin-bottom: 12px;
}

.card-stat {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  opacity: 0.9;
}

.card-preview {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.preview-item {
  font-size: 12px;
  opacity: 0.8;
  padding: 4px 8px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
}
</style>
