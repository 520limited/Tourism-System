<template>
  <div class="restaurant-card">
    <div class="restaurant-header">
      <div class="restaurant-icon">
        <el-icon><Food /></el-icon>
      </div>
      <div class="restaurant-info">
        <h3 class="restaurant-name">{{ restaurant.name }}</h3>
        <div class="restaurant-cuisine">
          <el-tag size="small" type="primary">{{ restaurant.cuisine }}</el-tag>
          <span class="restaurant-district">{{ restaurant.district }}</span>
        </div>
      </div>
      <div class="restaurant-rating">
        <div class="rating-score">{{ restaurant.rating.toFixed(1) }}</div>
        <div class="rating-stars">
          <el-rate v-model="restaurant.rating" disabled show-score score-template="" />
        </div>
        <div class="review-count">{{ restaurant.reviewCount }}条点评</div>
      </div>
    </div>
    <div class="restaurant-body">
      <div class="restaurant-address">
        <el-icon><Location /></el-icon>
        {{ restaurant.address }}
      </div>
      <div class="restaurant-meta">
        <div class="meta-item">
          <span class="meta-label">人均</span>
          <span class="meta-value price">¥{{ restaurant.avgPrice }}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">营业时间</span>
          <span class="meta-value">{{ restaurant.openTime }}</span>
        </div>
      </div>
      <div class="restaurant-tags" v-if="restaurant.tags && restaurant.tags.length">
        <el-tag v-for="(tag, idx) in restaurant.tags" :key="idx" size="small">{{ tag }}</el-tag>
      </div>
      <div class="recommended-dishes" v-if="restaurant.recommendedDishes && restaurant.recommendedDishes.length">
        <span class="dishes-label">推荐菜品：</span>
        <span class="dishes-list">{{ restaurant.recommendedDishes.join('、') }}</span>
      </div>
    </div>
    <div class="restaurant-footer">
      <el-button link type="primary" size="small">导航</el-button>
      <el-button type="primary" size="small">查看详情</el-button>
    </div>
  </div>
</template>

<script setup>
import { Location, Food } from '@element-plus/icons-vue'

defineProps({
  restaurant: {
    type: Object,
    required: true
  }
})
</script>

<style scoped>
.restaurant-card {
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 12px;
  padding: 20px;
  transition: all 0.3s ease;
}

.restaurant-card:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  border-color: #409eff;
}

.restaurant-header {
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
}

.restaurant-icon {
  width: 64px;
  height: 64px;
  background: linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  flex-shrink: 0;
}

.restaurant-info {
  flex: 1;
  min-width: 0;
}

.restaurant-name {
  font-size: 18px;
  font-weight: 600;
  color: #303133;
  margin: 0 0 8px 0;
}

.restaurant-cuisine {
  display: flex;
  align-items: center;
  gap: 12px;
}

.restaurant-district {
  font-size: 13px;
  color: #909399;
}

.restaurant-rating {
  text-align: right;
  flex-shrink: 0;
}

.rating-score {
  font-size: 24px;
  font-weight: 700;
  color: #ff9900;
  margin-bottom: 4px;
}

.review-count {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}

.restaurant-body {
  border-top: 1px solid #f5f7fa;
  padding-top: 16px;
}

.restaurant-address {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  color: #606266;
  margin-bottom: 12px;
}

.restaurant-meta {
  display: flex;
  gap: 24px;
  margin-bottom: 12px;
}

.meta-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.meta-label {
  font-size: 12px;
  color: #909399;
}

.meta-value {
  font-size: 14px;
  color: #303133;
  font-weight: 500;
}

.meta-value.price {
  color: #f56c6c;
  font-size: 16px;
  font-weight: 600;
}

.restaurant-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.recommended-dishes {
  font-size: 13px;
  color: #606266;
}

.dishes-label {
  font-weight: 500;
  color: #303133;
}

.dishes-list {
  color: #606266;
}

.restaurant-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #f5f7fa;
}
</style>
