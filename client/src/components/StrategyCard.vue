<template>
  <div class="strategy-card" @click="handleClick">
    <div class="strategy-type">
      <el-tag :type="tagType" size="small">{{ strategy.type }}</el-tag>
      <el-tag size="small" type="info">{{ strategy.days }}天</el-tag>
    </div>
    <h3 class="strategy-title">{{ strategy.title }}</h3>
    <p class="strategy-summary">{{ strategy.summary }}</p>
    <div class="strategy-itinerary" v-if="strategy.itinerary && strategy.itinerary.length">
      <div v-for="(day, idx) in strategy.itinerary" :key="idx" class="day-item">
        <span class="day-label">Day {{ day.day }}</span>
        <span class="day-spots">{{ day.spots.join(' → ') }}</span>
      </div>
    </div>
    <div class="strategy-footer">
      <div class="strategy-author">
        <el-avatar :size="24" style="background-color: #409eff">
          {{ strategy.author.charAt(0) }}
        </el-avatar>
        <span class="author-name">{{ strategy.author }}</span>
      </div>
      <div class="strategy-stats">
        <span class="stat-item">
          <el-icon><View /></el-icon>
          {{ formatNumber(strategy.views) }}
        </span>
        <span class="stat-item">
          <el-icon><Star /></el-icon>
          {{ formatNumber(strategy.likes) }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { View, Star } from '@element-plus/icons-vue'

const props = defineProps({
  strategy: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['click'])

const tagType = computed(() => {
  const typeMap = {
    '经典': 'success',
    '深度': 'primary',
    '美食': 'danger',
    '亲子': 'warning'
  }
  return typeMap[props.strategy.type] || 'info'
})

const formatNumber = (num) => {
  if (num >= 10000) {
    return (num / 10000).toFixed(1) + 'w'
  }
  return num.toString()
}

const handleClick = () => {
  emit('click', props.strategy)
}
</script>

<style scoped>
.strategy-card {
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 12px;
  padding: 20px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.strategy-card:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  border-color: #409eff;
  transform: translateY(-2px);
}

.strategy-type {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.strategy-title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  margin: 0 0 8px 0;
}

.strategy-summary {
  font-size: 13px;
  color: #909399;
  line-height: 1.6;
  margin: 0 0 16px 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.strategy-itinerary {
  background: #f5f7fa;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 16px;
}

.day-item {
  display: flex;
  gap: 12px;
  font-size: 13px;
  margin-bottom: 8px;
}

.day-item:last-child {
  margin-bottom: 0;
}

.day-label {
  color: #409eff;
  font-weight: 500;
  flex-shrink: 0;
}

.day-spots {
  color: #606266;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.strategy-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 12px;
  border-top: 1px solid #f5f7fa;
}

.strategy-author {
  display: flex;
  align-items: center;
  gap: 8px;
}

.author-name {
  font-size: 13px;
  color: #606266;
}

.strategy-stats {
  display: flex;
  gap: 16px;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: #909399;
}
</style>
