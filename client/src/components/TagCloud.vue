<template>
  <div class="tag-cloud">
    <div class="cloud-header">
      <h4>智能推荐标签</h4>
      <el-tag size="small" type="info">基于您的偏好</el-tag>
    </div>
    
    <div class="cloud-container" ref="cloudRef">
      <div 
        v-for="(tag, index) in animatedTags" 
        :key="index"
        class="cloud-tag"
        :class="{ selected: selectedTags.includes(tag.name) }"
        :style="getTagStyle(tag, index)"
        @click="toggleTag(tag)"
      >
        <span class="tag-icon">{{ tag.icon }}</span>
        <span class="tag-name">{{ tag.name }}</span>
        <span class="tag-weight">{{ tag.count }}</span>
      </div>
    </div>
    
    <div class="cloud-actions">
      <el-button size="small" @click="clearSelection">清除选择</el-button>
      <el-button size="small" type="primary" @click="applyTags">
        应用到行程
      </el-button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'

const props = defineProps({
  tags: {
    type: Array,
    default: () => []
  },
  userPreferences: {
    type: Object,
    default: () => ({})
  }
})

const emit = defineEmits(['apply'])

const cloudRef = ref(null)
const selectedTags = ref([])
const animatedTags = ref([])

const defaultTags = [
  { name: '美食探索', icon: '🍜', category: 'food', count: 128 },
  { name: '文化体验', icon: '🏛️', category: 'culture', count: 95 },
  { name: '自然风光', icon: '🌿', category: 'nature', count: 87 },
  { name: '夜生活', icon: '🌙', category: 'nightlife', count: 76 },
  { name: '网红打卡', icon: '📸', category: 'social', count: 112 },
  { name: '亲子活动', icon: '👨‍👩‍👧', category: 'family', count: 64 },
  { name: '历史古迹', icon: '🏯', category: 'history', count: 58 },
  { name: '购物天堂', icon: '🛍️', category: 'shopping', count: 89 },
  { name: '休闲放松', icon: '💆', category: 'relax', count: 72 },
  { name: '户外运动', icon: '🏃', category: 'sports', count: 45 },
  { name: '艺术展览', icon: '🎨', category: 'art', count: 38 },
  { name: '音乐演出', icon: '🎵', category: 'music', count: 52 }
]

const getTagStyle = (tag, index) => {
  const size = 12 + (tag.count / 128) * 8
  const hue = (index * 30) % 360
  
  return {
    fontSize: `${size}px`,
    animationDelay: `${index * 0.05}s`,
    '--tag-color': selectedTags.value.includes(tag.name) 
      ? `hsl(${hue}, 70%, 50%)` 
      : `hsl(${hue}, 60%, 70%)`
  }
}

const toggleTag = (tag) => {
  const idx = selectedTags.value.indexOf(tag.name)
  if (idx > -1) {
    selectedTags.value.splice(idx, 1)
  } else {
    selectedTags.value.push(tag.name)
  }
}

const clearSelection = () => {
  selectedTags.value = []
}

const applyTags = () => {
  if (selectedTags.value.length === 0) {
    ElMessage.warning('请先选择标签')
    return
  }
  
  emit('apply', selectedTags.value)
  ElMessage.success(`已应用 ${selectedTags.value.length} 个偏好标签`)
}

onMounted(() => {
  const tags = props.tags.length > 0 ? props.tags : defaultTags
  animatedTags.value = tags.sort(() => Math.random() - 0.5)
})
</script>

<style scoped>
.tag-cloud {
  background: #fff;
  border-radius: 12px;
  padding: 16px;
}

.cloud-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.cloud-header h4 {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  margin: 0;
}

.cloud-container {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 16px;
  min-height: 120px;
}

.cloud-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  background: var(--tag-color);
  border-radius: 20px;
  color: #fff;
  cursor: pointer;
  transition: all 0.3s ease;
  animation: popIn 0.5s ease-out forwards;
  opacity: 0;
  transform: scale(0.8);
}

@keyframes popIn {
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.cloud-tag:hover {
  transform: scale(1.1);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.cloud-tag.selected {
  background: var(--tag-color);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  transform: scale(1.05);
}

.tag-icon {
  font-size: 16px;
}

.tag-name {
  font-weight: 500;
}

.tag-weight {
  font-size: 10px;
  opacity: 0.8;
  background: rgba(255, 255, 255, 0.3);
  padding: 2px 6px;
  border-radius: 10px;
}

.cloud-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
