<template>
  <div class="hotel-card">
    <div class="hotel-main">
      <div class="hotel-image">
        <div class="placeholder">
          <el-icon><House /></el-icon>
        </div>
        <div v-if="hotel.starRating >= 4" class="recommend-badge">推荐</div>
      </div>
      <div class="hotel-content">
        <div class="hotel-title">
          <h3 class="hotel-name">{{ hotel.name }}</h3>
          <div class="hotel-stars">
            <el-icon v-for="n in hotel.starRating" :key="n" color="#f7ba2a"><Star /></el-icon>
          </div>
        </div>
        <div class="hotel-district">
          <el-tag size="small" type="info">{{ hotel.district }}</el-tag>
        </div>
        <div class="hotel-address">
          <el-icon><Location /></el-icon>
          {{ hotel.address }}
        </div>
        <div class="hotel-amenities" v-if="hotel.amenities && hotel.amenities.length">
          <span v-for="(amenity, idx) in hotel.amenities.slice(0, 4)" :key="idx" class="amenity-tag">
            {{ amenity }}
          </span>
        </div>
        <div class="hotel-footer">
          <div class="hotel-rating">
            <span class="rating-score">{{ hotel.rating }}</span>
            <span class="rating-label">分</span>
            <span class="review-count">{{ hotel.reviewCount }}条点评</span>
          </div>
          <div class="hotel-price">
            <span class="price-label">¥</span>
            <span class="price-value">{{ hotel.pricePerNight }}</span>
            <span class="price-unit">起/晚</span>
          </div>
        </div>
      </div>
    </div>
    <div class="hotel-actions">
      <el-button size="small" link>查看详情</el-button>
      <el-button size="small" type="primary">预订</el-button>
    </div>
  </div>
</template>

<script setup>
import { Star, Location, House } from '@element-plus/icons-vue'

defineProps({
  hotel: {
    type: Object,
    required: true
  }
})
</script>

<style scoped>
.hotel-card {
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 12px;
  overflow: hidden;
  transition: all 0.3s ease;
}

.hotel-card:hover {
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
}

.hotel-main {
  display: flex;
  gap: 16px;
  padding: 16px;
}

.hotel-image {
  width: 160px;
  height: 120px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 48px;
  flex-shrink: 0;
  position: relative;
}

.recommend-badge {
  position: absolute;
  top: 8px;
  right: 8px;
  background: #f56c6c;
  color: #fff;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.hotel-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.hotel-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.hotel-name {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  margin: 0;
}

.hotel-stars {
  display: flex;
  gap: 2px;
}

.hotel-address {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: #909399;
}

.hotel-amenities {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.amenity-tag {
  font-size: 12px;
  color: #606266;
  background: #f5f7fa;
  padding: 2px 8px;
  border-radius: 4px;
}

.hotel-footer {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-top: auto;
  padding-top: 8px;
}

.hotel-rating {
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.rating-score {
  font-size: 20px;
  font-weight: 700;
  color: #67c23a;
}

.rating-label {
  font-size: 13px;
  color: #606266;
}

.review-count {
  font-size: 12px;
  color: #909399;
  margin-left: 8px;
}

.hotel-price {
  display: flex;
  align-items: baseline;
  gap: 2px;
}

.price-label {
  font-size: 14px;
  color: #f56c6c;
}

.price-value {
  font-size: 24px;
  font-weight: 700;
  color: #f56c6c;
}

.price-unit {
  font-size: 12px;
  color: #909399;
}

.hotel-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 12px 16px;
  border-top: 1px solid #f5f7fa;
}
</style>
