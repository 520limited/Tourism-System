<template>
  <div class="recommendation-section">
    <div class="section-header">
      <h3 class="section-title">
        <el-icon><MagicStick /></el-icon>
        为您推荐
      </h3>
      <el-button link size="small" @click="refreshRecommendations">
        换一批
      </el-button>
    </div>

    <el-tabs v-model="activeTab" type="card" class="recommend-tabs">
      <el-tab-pane label="热门景点" name="attractions">
        <div class="recommend-grid">
          <AttractionCard
            v-for="attraction in recommendations.attractions"
            :key="attraction.attraction_id"
            :attraction="attraction"
            @click="handleAttractionClick"
            @add-to-trip="handleAddToTrip"
          />
        </div>
      </el-tab-pane>

      <el-tab-pane label="精选餐厅" name="restaurants">
        <div class="recommend-list">
          <RestaurantCard
            v-for="restaurant in recommendations.restaurants"
            :key="restaurant.id"
            :restaurant="restaurant"
          />
        </div>
      </el-tab-pane>

      <el-tab-pane label="优质酒店" name="hotels">
        <div class="recommend-list">
          <HotelCard
            v-for="hotel in recommendations.hotels"
            :key="hotel.id"
            :hotel="hotel"
          />
        </div>
      </el-tab-pane>

      <el-tab-pane label="旅游攻略" name="strategies">
        <div class="strategies-list">
          <StrategyCard
            v-for="strategy in recommendations.strategies"
            :key="strategy.id"
            :strategy="strategy"
          />
        </div>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { MagicStick } from '@element-plus/icons-vue'
import AttractionCard from './AttractionCard.vue'
import RestaurantCard from './RestaurantCard.vue'
import HotelCard from './HotelCard.vue'
import StrategyCard from './StrategyCard.vue'
import { getRecommendations } from '../api'
import { ElMessage } from 'element-plus'

const activeTab = ref('attractions')

const recommendations = reactive({
  attractions: [],
  restaurants: [],
  hotels: [],
  strategies: []
})

const loadRecommendations = async () => {
  try {
    recommendations.attractions = await getRecommendations('attractions')
    recommendations.restaurants = await getRecommendations('restaurants')
    recommendations.hotels = await getRecommendations('hotels')
    recommendations.strategies = await getRecommendations('strategies')
  } catch (error) {
    console.error('加载推荐失败:', error)
  }
}

const refreshRecommendations = () => {
  ElMessage.success('已为您更新推荐')
  loadRecommendations()
}

const handleAttractionClick = (attraction) => {
  console.log('点击景点:', attraction)
}

const handleAddToTrip = (attraction) => {
  ElMessage.success(`已将${attraction.name}加入行程`)
}

onMounted(() => {
  loadRecommendations()
})
</script>

<style scoped>
.recommendation-section {
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 12px;
  padding: 20px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.section-title {
  font-size: 18px;
  font-weight: 600;
  color: #303133;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.recommend-tabs :deep(.el-tabs__header) {
  margin-bottom: 20px;
}

.recommend-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
}

.recommend-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.strategies-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
}
</style>
