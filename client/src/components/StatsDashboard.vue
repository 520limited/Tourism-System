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
        <p v-for="(insight, index) in insights" :key="index">{{ insight }}</p>
        <p v-if="insights.length === 0">开始规划您的第一次旅行吧！</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch, nextTick } from 'vue'
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
      monthlyTrips: {},
      preferenceProfile: null
    })
  }
})

const pieChartRef = ref(null)
const barChartRef = ref(null)
let pieChart = null
let barChart = null
const animatedStats = ref({
  totalTrips: 0,
  favoriteCount: 0,
  totalAttractions: 0,
  totalRestaurants: 0
})

const insights = computed(() => {
  const result = []
  const { totalTrips, favoriteCount, totalAttractions, totalRestaurants, crowdTypes, monthlyTrips, preferenceProfile } = props.stats
  
  // ========== 偏好画像洞察（最优先展示）==========
  // 后端 topPreferences 是对象格式: { topAttractionTypes:[], topCuisines:[], ... }
  const hasPreferenceData = preferenceProfile?.topPreferences &&
    typeof preferenceProfile.topPreferences === 'object' &&
    Object.keys(preferenceProfile.topPreferences).length > 0

  if (hasPreferenceData) {
    const topPrefs = preferenceProfile.topPreferences
    const confidence = preferenceProfile.confidence || ''
    const totalBehaviors = preferenceProfile.totalBehaviors || 0

    // 从对象中提取各分类偏好数组（每个元素格式为 { name, score }）
    const attractionTypes = topPrefs.topAttractionTypes || []
    const cuisineList = topPrefs.topCuisines || []
    const regionList = topPrefs.topRegions || []

    // 景点类型偏好
    if (attractionTypes.length > 0) {
      const typeNames = { history: '历史文化', nature: '自然风光', modern: '现代都市', leisure: '休闲娱乐', art: '文艺打卡', culture: '人文体验' }
      const topType = attractionTypes[0]
      const typeName = typeNames[topType.name] || topType.name
      result.push(`基于您的浏览行为分析，您偏爱「${typeName}」类景点（热度值 ${Math.round(topType.score)}）`)
    }

    // 美食偏好
    if (cuisineList.length > 0) {
      const topFood = cuisineList[0]
      result.push(`美食偏好：您对「${topFood.name}」情有独钟（热度值 ${Math.round(topFood.score)}）`)
    }

    // 区域偏好
    if (regionList.length > 0) {
      const topRegion = regionList[0]
      result.push(`常去区域：「${topRegion.name}」是您的活动中心`)
    }

    // 置信度评价（字符串: low / medium / high）
    const confidenceLabels = {
      high: { text: '画像成熟度：高', desc: `基于 ${totalBehaviors} 次行为学习，推荐结果高度贴合您的口味` },
      medium: { text: '画像成熟度：中', desc: `已积累 ${totalBehaviors} 次行为数据，继续探索会让推荐更精准` },
      low: { text: '画像形成中', desc: `已有 ${totalBehaviors} 次行为记录，多收藏、多浏览将让AI更懂你` }
    }
    const ci = confidenceLabels[confidence]
    if (ci) {
      result.push(`${ci.text} — ${ci.desc}`)
    }

    // 智能推荐
    if (attractionTypes.length >= 2) {
      const typeMap = { history: '岳麓书院/天心阁', nature: '岳麓山/橘子洲', modern: 'IFS国金/五一广场', leisure: '世界之窗/海底世界', art: '谢子龙影像馆/后湖', culture: '省博物馆/简牍博物馆' }
      const recs = attractionTypes.slice(0, 2).map(t => typeMap[t.name] || t.name).filter(Boolean)
      if (recs.length > 0) {
        result.push(`💡 根据您的偏好，下次可以尝试：${recs.join('、')}`)
      }
    }

    result.push('') // 空行分隔
  } else if (totalTrips > 0) {
    result.push('💡 小贴士：完善偏好设置并多使用系统，AI会学习您的口味生成专属推荐')
    result.push('')
  }
  
  // ========== 原有统计数据洞察 ==========
  
  const greetings = ['您好，旅行家！', '欢迎回来，探索者！', '嗨，旅行达人！', '你好，冒险家！']
  const randomGreeting = greetings[Math.floor(Math.random() * greetings.length)]
  
  if (totalTrips === 0) {
    const tips = [
      '世界那么大，开始您的第一次旅行吧！',
      '每一段旅程都是新的故事，开始书写您的旅行篇章！',
      '地图上的每个标记都等待着您的足迹，出发吧！',
      '准备好行囊，精彩的目的地正在等您！'
    ]
    result.push(randomGreeting + tips[Math.floor(Math.random() * tips.length)])
    return result
  }
  
  if (totalTrips >= 1 && totalTrips <= 2) {
    const tips = [
      '您的旅行种子已发芽，继续浇灌让它茁壮成长！',
      '旅行第一步已经迈出，前方有更多精彩等着您！',
      '新手旅行家已上线，继续探索解锁更多成就！'
    ]
    result.push(tips[Math.floor(Math.random() * tips.length)])
  } else if (totalTrips > 2 && totalTrips <= 5) {
    result.push('您是旅行爱好者！已累计规划 ' + totalTrips + ' 次行程，继续保持探索的热情！')
  } else if (totalTrips > 5 && totalTrips <= 10) {
    result.push('旅行达人认证！您已规划 ' + totalTrips + ' 次行程，足迹遍布长沙各处！')
  } else if (totalTrips > 10 && totalTrips <= 20) {
    result.push('您是资深旅行家！' + totalTrips + ' 次行程见证了您对旅行的热爱！')
  } else if (totalTrips > 20) {
    result.push('旅行王者诞生！' + totalTrips + ' 次行程，您已成为长沙旅行专家！')
  }
  
  if (favoriteCount > 0) {
    if (favoriteCount >= 10) {
      result.push('收藏达人！您收藏了 ' + favoriteCount + ' 个心仪地点，是时候逐一打卡了！')
    } else if (favoriteCount >= 5) {
      result.push('您收藏了 ' + favoriteCount + ' 个心仪地点，每一个都值得期待！')
    } else {
      result.push('您已收藏 ' + favoriteCount + ' 个地点，继续发现更多宝藏吧！')
    }
  } else if (totalTrips > 0) {
    result.push('小贴士：收藏喜欢的景点、美食、住宿，方便下次快速找到！')
  }
  
  if (totalAttractions > 0 && totalRestaurants > 0) {
    if (totalAttractions > totalRestaurants * 2) {
      result.push('您是景点控！已打卡 ' + totalAttractions + ' 个景点，别忘了品尝当地美食哦~')
    } else if (totalRestaurants > totalAttractions * 2) {
      result.push('您是美食家！已体验 ' + totalRestaurants + ' 家美食，记得也要欣赏风景！')
    } else {
      result.push('完美平衡！您的旅行兼顾景点与美食，是理想的旅行方式！')
    }
  } else if (totalAttractions > 0 && totalRestaurants === 0) {
    result.push('您已打卡 ' + totalAttractions + ' 个景点，下次试试探索美食？')
  } else if (totalRestaurants > 0 && totalAttractions === 0) {
    result.push('您已体验 ' + totalRestaurants + ' 家美食，下次也去看看景点吧！')
  }
  
  if (crowdTypes && Object.keys(crowdTypes).length > 0) {
    const sortedCrowds = Object.entries(crowdTypes).sort((a, b) => b[1] - a[1])
    const mainCrowd = sortedCrowds[0]
    const crowdInsights = {
      '独自旅行': {
        title: '独行侠',
        desc: '享受独处的旅行时光，自由自在探索世界'
      },
      '情侣出游': {
        title: '浪漫旅人',
        desc: '与TA一起创造甜蜜回忆'
      },
      '家庭亲子': {
        title: '家庭守护者',
        desc: '陪伴家人，共享温馨时光'
      },
      '朋友结伴': {
        title: '欢乐使者',
        desc: '与好友同行，快乐加倍'
      }
    }
    
    if (mainCrowd) {
      const insight = crowdInsights[mainCrowd[0]] || { title: mainCrowd[0], desc: '' }
      result.push('您是"' + insight.title + '"！' + insight.desc + '，已规划 ' + mainCrowd[1] + ' 次！')
    }
    
    if (sortedCrowds.length >= 3) {
      result.push('您的旅行方式丰富多彩，尝试过 ' + sortedCrowds.length + ' 种不同的出行方式！')
    }
  }
  
  if (monthlyTrips && Object.keys(monthlyTrips).length > 0) {
    const months = Object.keys(monthlyTrips).sort()
    const lastMonth = months[months.length - 1]
    const lastMonthTrips = monthlyTrips[lastMonth]
    
    if (lastMonthTrips > 0) {
      if (lastMonthTrips >= 5) {
        result.push('本月您已规划 ' + lastMonthTrips + ' 次行程，出行热情爆棚！')
      } else if (lastMonthTrips >= 3) {
        result.push('本月您已规划 ' + lastMonthTrips + ' 次行程，保持这个节奏！')
      } else {
        result.push('本月您已规划 ' + lastMonthTrips + ' 次行程，继续加油！')
      }
    }
    
    if (months.length >= 3) {
      const totalMonths = months.length
      const tripsPerMonth = Object.values(monthlyTrips).reduce((a, b) => a + b, 0) / totalMonths
      result.push('过去 ' + totalMonths + ' 个月，平均每月规划 ' + tripsPerMonth.toFixed(1) + ' 次行程！')
    }
  }
  
  const achievementTips = [
    '小贴士：完善偏好设置可以获得更精准的行程推荐！',
    '挑战：尝试不同的人群类型出行，解锁更多旅行体验！',
    '成就追踪：继续规划行程，解锁"旅行专家"称号！',
    '记得在旅途中拍照留念，记录美好瞬间！',
    '长沙还有更多隐藏景点等待您去发现！'
  ]
  
  if (result.length < 4 && totalTrips > 0) {
    result.push(achievementTips[Math.floor(Math.random() * achievementTips.length)])
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
  
  if (!pieChart) {
    pieChart = echarts.init(pieChartRef.value)
    window.addEventListener('resize', () => pieChart && pieChart.resize())
  }
  
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
  
  pieChart.setOption(option)
}

const initBarChart = () => {
  if (!barChartRef.value) return
  
  if (!barChart) {
    barChart = echarts.init(barChartRef.value)
    window.addEventListener('resize', () => barChart && barChart.resize())
  }
  
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
          { offset: 0, color: '#9dddd8' },
          { offset: 1, color: '#5fb5af' }
        ])
      }
    }]
  }
  
  barChart.setOption(option)
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

watch(() => props.stats, (newStats) => {
  nextTick(() => {
    animateNumber('totalTrips', newStats.totalTrips || 0)
    animateNumber('favoriteCount', newStats.favoriteCount || 0)
    animateNumber('totalAttractions', newStats.totalAttractions || 0)
    animateNumber('totalRestaurants', newStats.totalRestaurants || 0)
    initPieChart()
    initBarChart()
  })
}, { deep: true })
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
  background: linear-gradient(135deg, #9dddd8 0%, #7ec8c3 100%);
  border-radius: 12px;
  padding: 20px;
  color: #fff;
}

.insight-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 12px;
}

.insight-content p {
  margin: 0 0 8px 0;
  font-size: 14px;
  opacity: 0.95;
  line-height: 1.6;
  padding-left: 4px;
  border-left: 2px solid rgba(255, 255, 255, 0.3);
}

.insight-content p:last-child {
  margin-bottom: 0;
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
