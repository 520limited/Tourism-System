<template>
  <div class="attraction-card" @click="handleClick">
    <div class="card-image">
      <div class="placeholder-image">
        <el-icon :size="40"><Location /></el-icon>
      </div>
      <div v-if="attraction.ticket_price === 0" class="free-badge">免费</div>
      <div v-if="attraction.popularity" class="hot-badge">热门</div>
    </div>
    <div class="card-content">
      <div class="card-header">
        <h3 class="card-title">{{ attraction.name }}</h3>
        <div class="card-rating" v-if="attraction.rating">
          <el-rate v-model="attraction.rating" disabled show-score text-color="#ff9900" />
        </div>
      </div>
      <p class="card-desc" v-if="attraction.description">{{ attraction.description }}</p>
      <div class="card-tags" v-if="attraction.tags && attraction.tags.length">
        <el-tag v-for="(tag, idx) in attraction.tags.slice(0, 3)" :key="idx" size="small" type="info">{{ tag }}</el-tag>
      </div>
      <div class="card-footer">
        <div class="card-price">
          <span v-if="attraction.ticket_price > 0" class="price">¥{{ attraction.ticket_price }}</span>
          <span v-else class="price free">免费</span>
        </div>
        <div class="card-meta">
          <span class="meta-item">
            <el-icon><Timer /></el-icon>
            {{ attraction.suggestedDuration || attraction.suggested_duration || 2 }}小时
          </span>
          <span v-if="attraction.walking_intensity" class="meta-item">
            <el-icon><TrendCharts /></el-icon>
            {{ intensityText }}
          </span>
        </div>
      </div>
    </div>
    <div class="card-actions" v-if="showActions">
      <el-button size="small" @click.stop="handleAddToTrip">加入行程</el-button>
      <el-button size="small" type="primary" @click.stop="handleViewDetail">查看详情</el-button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Location, Timer, TrendCharts } from '@element-plus/icons-vue'

const props = defineProps({
  attraction: {
    type: Object,
    required: true
  },
  showActions: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits(['click', 'add-to-trip', 'view-detail'])

const intensityText = computed(() => {
  const map = {
    'low': '轻松',
    'medium': '适中',
    'high': '较高'
  }
  return map[props.attraction.walking_intensity] || '适中'
})

const handleClick = () => {
  emit('click', props.attraction)
}

const handleAddToTrip = () => {
  emit('add-to-trip', props.attraction)
}

const handleViewDetail = () => {
  emit('view-detail', props.attraction)
}
</script>

<style scoped>
.attraction-card {
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 12px;
  overflow: hidden;
  transition: all 0.3s ease;
  cursor: pointer;
}

.attraction-card:hover {
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
  transform: translateY(-4px);
  border-color: #409eff;
}

.card-image {
  position: relative;
  height: 160px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
}

.placeholder-image {
  color: rgba(255, 255, 255, 0.8);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.free-badge,
.hot-badge {
  position: absolute;
  top: 12px;
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.free-badge {
  left: 12px;
  background: #67c23a;
  color: #fff;
}

.hot-badge {
  right: 12px;
  background: #f56c6c;
  color: #fff;
}

.card-content {
  padding: 16px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 8px;
}

.card-title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  margin: 0;
  flex: 1;
}

.card-rating {
  flex-shrink: 0;
}

.card-desc {
  font-size: 13px;
  color: #909399;
  line-height: 1.6;
  margin: 0 0 12px 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 12px;
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 12px;
  border-top: 1px solid #f5f7fa;
}

.card-price {
  font-size: 18px;
  font-weight: 600;
  color: #f56c6c;
}

.card-price .free {
  color: #67c23a;
}

.card-meta {
  display: flex;
  gap: 16px;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: #909399;
}

.card-actions {
  display: flex;
  gap: 8px;
  padding: 0 16px 16px;
}

.card-actions .el-button {
  flex: 1;
}
</style>
