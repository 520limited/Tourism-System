<template>
  <div class="share-poster">
    <el-button type="primary" @click="generatePoster" :loading="generating">
      <el-icon><Share /></el-icon>
      生成分享海报
    </el-button>
    
    <el-dialog v-model="showPoster" title="行程分享海报" width="400px" center>
      <div class="poster-preview">
        <div ref="posterRef" class="poster-container">
          <div class="poster-header">
            <div class="poster-logo">🧳 长沙旅游规划</div>
            <div class="poster-title">{{ tripData.title }}</div>
            <div class="poster-subtitle">{{ tripData.days }}天{{ tripData.crowd }}长沙深度游</div>
          </div>
          
          <div class="poster-body">
            <div class="poster-section">
              <div class="section-icon">📍</div>
              <div class="section-content">
                <div class="section-title">精选景点</div>
                <div class="section-items">
                  <span v-for="spot in topAttractions" :key="spot" class="item-tag">{{ spot }}</span>
                </div>
              </div>
            </div>
            
            <div class="poster-section">
              <div class="section-icon">🍜</div>
              <div class="section-content">
                <div class="section-title">美食推荐</div>
                <div class="section-items">
                  <span v-for="food in topFoods" :key="food" class="item-tag food">{{ food }}</span>
                </div>
              </div>
            </div>
            
            <div class="poster-stats">
              <div class="stat-item">
                <div class="stat-value">{{ tripData.days }}</div>
                <div class="stat-label">天行程</div>
              </div>
              <div class="stat-item">
                <div class="stat-value">{{ totalAttractions }}</div>
                <div class="stat-label">个景点</div>
              </div>
              <div class="stat-item">
                <div class="stat-value">{{ totalRestaurants }}</div>
                <div class="stat-label">家美食</div>
              </div>
            </div>
          </div>
          
          <div class="poster-footer">
            <div class="footer-tip">✨ AI智能规划 · 个性化定制</div>
            <div class="footer-qrcode">
              <div class="qrcode-placeholder">扫码体验</div>
            </div>
          </div>
        </div>
      </div>
      
      <template #footer>
        <el-button @click="downloadPoster" type="primary">
          <el-icon><Download /></el-icon>
          保存图片
        </el-button>
        <el-button @click="copyToClipboard">
          <el-icon><CopyDocument /></el-icon>
          复制到剪贴板
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Share, Download, CopyDocument } from '@element-plus/icons-vue'
import html2canvas from 'html2canvas'

const props = defineProps({
  tripData: {
    type: Object,
    default: () => ({
      title: '长沙之旅',
      days: 3,
      crowd: '情侣',
      itinerary: []
    })
  }
})

const showPoster = ref(false)
const generating = ref(false)
const posterRef = ref(null)

const topAttractions = computed(() => {
  const attractions = []
  props.tripData.itinerary?.forEach(day => {
    day.attractions?.slice(0, 2).forEach(a => {
      if (a.name) attractions.push(a.name)
    })
  })
  return attractions.slice(0, 5)
})

const topFoods = computed(() => {
  const foods = []
  props.tripData.itinerary?.forEach(day => {
    day.restaurants?.slice(0, 1).forEach(r => {
      if (r.name) foods.push(r.name)
    })
  })
  return foods.slice(0, 4)
})

const totalAttractions = computed(() => {
  let total = 0
  props.tripData.itinerary?.forEach(day => {
    total += day.attractions?.length || 0
  })
  return total
})

const totalRestaurants = computed(() => {
  let total = 0
  props.tripData.itinerary?.forEach(day => {
    total += day.restaurants?.length || 0
  })
  return total
})

const generatePoster = async () => {
  generating.value = true
  showPoster.value = true
  
  setTimeout(async () => {
    try {
      generating.value = false
    } catch (error) {
      console.error('生成海报失败:', error)
      ElMessage.error('生成海报失败')
      generating.value = false
    }
  }, 500)
}

const downloadPoster = async () => {
  if (!posterRef.value) return
  
  try {
    const canvas = await html2canvas(posterRef.value, {
      backgroundColor: '#ffffff',
      scale: 2
    })
    
    const link = document.createElement('a')
    link.download = `长沙旅游行程-${Date.now()}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
    
    ElMessage.success('海报已保存')
  } catch (error) {
    console.error('保存海报失败:', error)
    ElMessage.error('保存失败，请重试')
  }
}

const copyToClipboard = async () => {
  if (!posterRef.value) return
  
  try {
    const canvas = await html2canvas(posterRef.value, {
      backgroundColor: '#ffffff',
      scale: 2
    })
    
    canvas.toBlob(async (blob) => {
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob })
      ])
      ElMessage.success('已复制到剪贴板')
    })
  } catch (error) {
    console.error('复制失败:', error)
    ElMessage.error('复制失败，请使用保存功能')
  }
}
</script>

<style scoped>
.share-poster {
  display: inline-block;
}

.poster-preview {
  display: flex;
  justify-content: center;
}

.poster-container {
  width: 360px;
  background: #9dddd8;
  border-radius: 16px;
  overflow: hidden;
  font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif;
}

.poster-header {
  padding: 24px 20px;
  text-align: center;
  color: #fff;
}

.poster-logo {
  font-size: 14px;
  opacity: 0.9;
  margin-bottom: 12px;
}

.poster-title {
  font-size: 24px;
  font-weight: 700;
  margin-bottom: 8px;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.poster-subtitle {
  font-size: 14px;
  opacity: 0.9;
}

.poster-body {
  background: #fff;
  border-radius: 20px 20px 0 0;
  padding: 20px;
}

.poster-section {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.section-icon {
  font-size: 24px;
  flex-shrink: 0;
}

.section-content {
  flex: 1;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 8px;
}

.section-items {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.item-tag {
  display: inline-block;
  padding: 4px 10px;
  background: #7ec8c3;
  color: #fff;
  border-radius: 12px;
  font-size: 12px;
}

.item-tag.food {
  background: #f5a962;
}

.poster-stats {
  display: flex;
  justify-content: space-around;
  padding: 16px 0;
  border-top: 1px dashed #ebeef5;
  border-bottom: 1px dashed #ebeef5;
  margin: 16px 0;
}

.stat-item {
  text-align: center;
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
  color: #5fb5af;
}

.stat-label {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}

.poster-footer {
  padding: 16px 20px;
  background: #f9fafb;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.footer-tip {
  font-size: 12px;
  color: #909399;
}

.footer-qrcode {
  width: 60px;
  height: 60px;
  background: #7ec8c3;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.qrcode-placeholder {
  font-size: 10px;
  color: #fff;
  text-align: center;
}
</style>
