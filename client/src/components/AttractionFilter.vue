<template>
  <div class="attraction-filter">
    <div class="filter-section">
      <h4 class="section-title">景点类型</h4>
      <div class="tag-group">
        <el-tag
          v-for="tag in typeTags"
          :key="tag.value"
          :type="filters.tag === tag.value ? '' : 'info'"
          size="small"
          @click="setFilter('tag', tag.value)"
        >
          {{ tag.label }}
        </el-tag>
      </div>
    </div>

    <div class="filter-section">
      <h4 class="section-title">出行人群</h4>
      <div class="tag-group">
        <el-tag
          v-for="crowd in crowdOptions"
          :key="crowd.value"
          :type="filters.crowd === crowd.value ? '' : 'info'"
          size="small"
          @click="setFilter('crowd', crowd.value)"
        >
          {{ crowd.label }}
        </el-tag>
      </div>
    </div>

    <div class="filter-section">
      <h4 class="section-title">门票价格</h4>
      <el-slider
        v-model="filters.maxPrice"
        :min="0"
        :max="300"
        :step="10"
        show-input
        :format-tooltip="(val) => `¥${val}`"
      />
    </div>

    <div class="filter-section">
      <h4 class="section-title">步行强度</h4>
      <div class="radio-group">
        <el-radio v-for="intensity in intensityOptions" :key="intensity.value" v-model="filters.walkingIntensity" :label="intensity.value" size="small">
          {{ intensity.label }}
        </el-radio>
      </div>
    </div>

    <div class="filter-actions">
      <el-button size="small" @click="resetFilters">重置</el-button>
      <el-button type="primary" size="small" @click="applyFilters">应用筛选</el-button>
    </div>
  </div>
</template>

<script setup>
import { reactive } from 'vue'

const emit = defineEmits(['filter-change'])

const filters = reactive({
  tag: '',
  crowd: '',
  maxPrice: 300,
  walkingIntensity: ''
})

const typeTags = [
  { label: '全部', value: '' },
  { label: '自然风光', value: '自然风光' },
  { label: '历史文化', value: '历史文化' },
  { label: '主题乐园', value: '主题乐园' },
  { label: '免费', value: '免费' }
]

const crowdOptions = [
  { label: '全部', value: '' },
  { label: '情侣', value: '情侣' },
  { label: '亲子', value: '亲子' },
  { label: '老人', value: '老人' },
  { label: '朋友', value: '朋友' }
]

const intensityOptions = [
  { label: '全部', value: '' },
  { label: '轻松', value: 'low' },
  { label: '适中', value: 'medium' },
  { label: '较高', value: 'high' }
]

const setFilter = (key, value) => {
  filters[key] = filters[key] === value ? '' : value
}

const resetFilters = () => {
  filters.tag = ''
  filters.crowd = ''
  filters.maxPrice = 300
  filters.walkingIntensity = ''
  emit('filter-change', { ...filters })
}

const applyFilters = () => {
  emit('filter-change', { ...filters })
}
</script>

<style scoped>
.attraction-filter {
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 12px;
  padding: 20px;
}

.filter-section {
  margin-bottom: 20px;
}

.filter-section:last-of-type {
  margin-bottom: 24px;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  margin: 0 0 12px 0;
}

.tag-group {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tag-group .el-tag {
  cursor: pointer;
}

.radio-group {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}

.filter-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}
</style>
