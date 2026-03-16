<template>
  <div class="stats-dashboard">
    <div class="dashboard-header">
      <h3>数据统计</h3>
    </div>
    
    <div class="stats-cards">
      <div class="stat-card">
        <div class="stat-icon" style="background: #9dddd8;">
          <el-icon><Document /></el-icon>
        </div>
        <div class="stat-info">
          <div class="stat-value">{{ animatedStats.totalTrips }}</div>
          <div class="stat-label">行程总数</div>
        </div>
      </div>
      
      <div class="stat-card">
        <div class="stat-icon" style="background: #7ec8c3;">
          <el-icon><Star /></el-icon>
        </div>
        <div class="stat-info">
          <div class="stat-value">{{ animatedStats.favoriteCount }}</div>
          <div class="stat-label">收藏数量</div>
        </div>
      </div>
      
      <div class="stat-card">
        <div class="stat-icon" style="background: #5fb5af;">
          <el-icon><Location /></el-icon>
        </div>
        <div class="stat-info">
          <div class="stat-value">{{ animatedStats.totalAttractions }}</div>
          <div class="stat-label">景点打卡</div>
        </div>
      </div>
      
      <div class="stat-card">
        <div class="stat-icon" style="background: #f5a962;">
          <el-icon><Food /></el-icon>
        </div>
        <div class="stat-info">
          <div class="stat-value">{{ animatedStats.totalRestaurants }}</div>
          <div class="stat-label">美食体验</div>
        </div>
      </div>
    </div>

    <div class="charts-row">
      <div class="chart-card">
        <div class="chart-title">行程类型分布</div>
        <div ref="pieChartRef" class="chart-container"></div>
      </div>
      
      <div class="chart-card">
        <div class="chart-title">月度行程趋势</div>
        <div ref="barChartRef" class="chart-container"></div>
      </div>
    </div>

    <div class="insight-card">
      <div class="insight-header">
        <el-icon><TrendCharts /></el-icon>
        <span>智能洞察</span>
      </div>
      <div class="insight-content">
        <p v-if="insights.length > 0">{{ insights[0] }}</p>
        <p v-else>开始规划您的第一次旅行吧！</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import * as echarts from 'echarts'
import { Document, Star, Location, Food, TrendCharts } from '@element-plus/icons-vue'

const props = defineProps({
  stats: {
    type: Object,
    default: () => ({
      totalTrips: 0,
      favoriteCount: 0,
      totalAttractions: 0,
      totalRestaurants: 0,
      crowdTypes: {},
      monthlyTrips: {}
    })
  }
})

const pieChartRef = ref(null)
const barChartRef = ref(null)
const animatedStats = ref({
  totalTrips: 0,
  favoriteCount: 0,
  totalAttractions: 0,
  totalRestaurants: 0
})

const insights = computed(() => {
  const result = []
  if (props.stats.totalTrips > 5) {
    result.push('您是旅行达人！已累计规划 ' + props.stats.totalTrips + ' 次行程')
  }
  if (props.stats.favoriteCount > 3) {
    result.push('您收藏了 ' + props.stats.favoriteCount + ' 个心仪地点，快去打卡吧！')
  }
  return result
})

const animateNumber = (target, value, duration = 1000) => {
  const start = animatedStats.value[target]
  const end = value
  const startTime = performance.now()
  
  const animate = (currentTime) => {
    const elapsed = currentTime - startTime
    const progress = Math.min(elapsed / duration, 1)
    const easeOut = 1 - Math.pow(1 - progress, 3)
    animatedStats.value[target] = Math.floor(start + (end - start) * easeOut)
    
    if (progress < 1) {
      requestAnimationFrame(animate)
    }
  }
  
  requestAnimationFrame(animate)
}

const initPieChart = () => {
  if (!pieChartRef.value) return
  
  const chart = echarts.init(pieChartRef.value)
  const crowdTypes = props.stats.crowdTypes || {}
  const data = Object.entries(crowdTypes).map(([name, value]) => ({ name, value }))
  
  if (data.length === 0) {
    data.push({ name: '暂无数据', value: 1 })
  }

  const option = {
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c}次 ({d}%)'
    },
    legend: {
      bottom: '5%',
      left: 'center',
      textStyle: { fontSize: 12 }
    },
    series: [{
      type: 'pie',
      radius: ['40%', '70%'],
      avoidLabelOverlap: false,
      itemStyle: {
        borderRadius: 10,
        borderColor: '#fff',
        borderWidth: 2
      },
      label: {
        show: false,
        position: 'center'
      },
      emphasis: {
        label: {
          show: true,
          fontSize: 16,
          fontWeight: 'bold'
        }
      },
      labelLine: { show: false },
      data: data,
      color: ['#667eea', '#f5576c', '#4facfe', '#43e97b', '#fa709a', '#fee140']
    }]
  }
  
  chart.setOption(option)
  window.addEventListener('resize', () => chart.resize())
}

const initBarChart = () => {
  if (!barChartRef.value) return
  
  const chart = echarts.init(barChartRef.value)
  const monthlyTrips = props.stats.monthlyTrips || {}
  const months = Object.keys(monthlyTrips).slice(-6)
  const values = months.map(m => monthlyTrips[m])

  const option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: months.length > 0 ? months : ['1月', '2月', '3月', '4月', '5月', '6月'],
      axisLabel: { fontSize: 10 }
    },
    yAxis: {
      type: 'value',
      axisLabel: { fontSize: 10 }
    },
    series: [{
      data: values.length > 0 ? values : [0, 0, 0, 0, 0, 0],
      type: 'bar',
      barWidth: '60%',
      itemStyle: {
        borderRadius: [4, 4, 0, 0],
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: '#667eea' },
          { offset: 1, color: '#764ba2' }
        ])
      }
    }]
  }
  
  chart.setOption(option)
  window.addEventListener('resize', () => chart.resize())
}

onMounted(() => {
  setTimeout(() => {
    animateNumber('totalTrips', props.stats.totalTrips || 0)
    animateNumber('favoriteCount', props.stats.favoriteCount || 0)
    animateNumber('totalAttractions', props.stats.totalAttractions || 0)
    animateNumber('totalRestaurants', props.stats.totalRestaurants || 0)
    initPieChart()
    initBarChart()
  }, 300)
})
</script>

<style scoped>
.stats-dashboard {
  padding: 20px;
  background: #fff;
  border-radius: 12px;
  margin-bottom: 24px;
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.dashboard-header h3 {
  font-size: 18px;
  font-weight: 600;
  color: #303133;
  margin: 0;
}

.stats-cards {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 20px;
}

.stat-card {
  background: #fff;
  border-radius: 12px;
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.05);
  transition: transform 0.3s;
}

.stat-card:hover {
  transform: translateY(-4px);
}

.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 24px;
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: #303133;
}

.stat-label {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}

.charts-row {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  margin-bottom: 20px;
}

.chart-card {
  background: #fff;
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.05);
}

.chart-title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 12px;
}

.chart-container {
  height: 200px;
}

.insight-card {
  background: #9dddd8;
  border-radius: 12px;
  padding: 16px;
  color: #fff;
}

.insight-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 8px;
}

.insight-content p {
  margin: 0;
  font-size: 13px;
  opacity: 0.9;
}

@media (max-width: 768px) {
  .stats-cards {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .charts-row {
    grid-template-columns: 1fr;
  }
}
</style>
