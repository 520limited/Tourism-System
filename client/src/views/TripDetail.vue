<template>
  <div class="trip-detail-page">
    <div class="back-nav">
      <el-button class="back-btn" @click="goBack" circle size="small">
        <el-icon><ArrowLeft /></el-icon>
      </el-button>
      <span class="nav-title">{{ tripData?.title || '行程详情' }}</span>
    </div>

    <div v-loading="loading" class="detail-container">
      <el-empty v-if="!loading && !tripData" description="行程不存在">
        <el-button type="primary" @click="goBack">返回</el-button>
      </el-empty>

      <template v-else-if="tripData">
        <div class="trip-header">
          <h2>{{ tripData.title || '未命名行程' }}</h2>
          <div class="trip-meta">
            <el-tag v-if="tripData.requirements?.days" type="success">{{ tripData.requirements.days }}天</el-tag>
            <el-tag v-if="tripData.requirements?.crowd">{{ tripData.requirements.crowd }}</el-tag>
            <el-tag v-if="tripData.requirements?.budget" type="warning">预算{{ tripData.requirements.budget }}元</el-tag>
          </div>
        </div>

        <div v-if="tripData.activities && tripData.activities.length > 0" class="activities-section">
          <div class="section-title">
            <el-icon><Star /></el-icon>
            推荐活动
          </div>
          <div class="activities-list">
            <el-tag v-for="(activity, idx) in tripData.activities" :key="idx" type="primary" effect="plain">
              {{ activity }}
            </el-tag>
          </div>
        </div>

        <div v-if="tripData.itinerary && tripData.itinerary.length > 0" class="itinerary-section">
          <el-tabs v-model="activeDay" type="border-card">
            <el-tab-pane
              v-for="(dayTrip, idx) in tripData.itinerary"
              :key="idx"
              :label="'第 ' + dayTrip.day + ' 天'"
              :name="String(dayTrip.day)"
            >
              <div class="day-content">
                <div v-if="dayTrip.attractions && dayTrip.attractions.length > 0" class="day-section">
                  <div class="section-title">
                    <el-icon><Location /></el-icon>
                    景点安排
                  </div>
                  <div class="attractions-list">
                    <div v-for="(attr, attrIdx) in dayTrip.attractions" :key="attrIdx" class="attraction-item">
                      <div class="attr-order">{{ attrIdx + 1 }}</div>
                      <div class="attr-info">
                        <div class="attr-name">{{ attr.name }}</div>
                        <div class="attr-meta">
                          <span v-if="attr.ticketPrice !== undefined">
                            <el-icon><Ticket /></el-icon>
                            {{ attr.ticketPrice > 0 ? '¥' + attr.ticketPrice : '免费' }}
                          </span>
                          <span v-if="attr.estimatedDuration">
                            <el-icon><Clock /></el-icon>
                            {{ attr.estimatedDuration }}小时
                          </span>
                          <span v-if="attr.rating">
                            <el-icon><Star /></el-icon>
                            {{ attr.rating }}
                          </span>
                        </div>
                        <div v-if="attr.address" class="attr-address">{{ attr.address }}</div>
                        <div v-if="attr.description" class="attr-desc">{{ attr.description }}</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div v-if="dayTrip.restaurants && dayTrip.restaurants.length > 0" class="day-section">
                  <div class="section-title">
                    <el-icon><Food /></el-icon>
                    美食推荐
                  </div>
                  <div class="restaurants-list">
                    <div v-for="(rest, rIdx) in dayTrip.restaurants" :key="rIdx" class="restaurant-item">
                      <div class="rest-name">{{ rest.name }}</div>
                      <div class="rest-meta">
                        <span v-if="rest.cuisine">{{ rest.cuisine }}</span>
                        <span v-if="rest.avgPrice">人均¥{{ rest.avgPrice }}</span>
                        <span v-if="rest.rating">⭐ {{ rest.rating }}</span>
                      </div>
                      <div v-if="rest.specialty" class="rest-specialty">特色：{{ rest.specialty }}</div>
                    </div>
                  </div>
                </div>

                <div v-if="dayTrip.hotels && dayTrip.hotels.length > 0" class="day-section">
                  <div class="section-title">
                    <el-icon><House /></el-icon>
                    住宿推荐
                  </div>
                  <div class="hotels-list">
                    <div v-for="(hotel, hIdx) in dayTrip.hotels" :key="hIdx" class="hotel-item">
                      <div class="hotel-name">{{ hotel.name }}</div>
                      <div class="hotel-meta">
                        <span v-if="hotel.starRating">{{ hotel.starRating }}星级</span>
                        <span v-if="hotel.pricePerNight">¥{{ hotel.pricePerNight }}/晚</span>
                        <span v-if="hotel.rating">⭐ {{ hotel.rating }}</span>
                      </div>
                      <div v-if="hotel.address" class="hotel-address">{{ hotel.address }}</div>
                    </div>
                  </div>
                </div>
              </div>
            </el-tab-pane>
          </el-tabs>
        </div>

        <div v-else class="empty-itinerary">
          <el-empty description="暂无行程安排" />
        </div>

        <div class="trip-footer">
          <div class="footer-info">
            <span>创建时间：{{ formatDate(tripData.createdAt) }}</span>
            <span>更新时间：{{ formatDate(tripData.updatedAt) }}</span>
          </div>
          <div class="footer-actions">
            <el-button @click="editTrip">编辑行程</el-button>
            <el-button type="danger" @click="confirmDelete">删除行程</el-button>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { tripAPI } from '../api'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeft, Location, Clock, Star, Ticket, Food, House } from '@element-plus/icons-vue'

const route = useRoute()
const router = useRouter()

const loading = ref(false)
const tripData = ref(null)
const activeDay = ref('1')

const goBack = () => {
  router.push('/history')
}

const formatDate = (dateStr) => {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleDateString('zh-CN')
}

const loadTripData = async () => {
  const tripId = route.params.id
  if (!tripId) {
    ElMessage.error('行程ID不存在')
    return
  }

  loading.value = true
  try {
    const res = await tripAPI.getTrip(tripId)
    if (res.code === 200 && res.data) {
      tripData.value = res.data
    } else {
      ElMessage.error(res.message || '加载行程失败')
    }
  } catch (error) {
    console.error('加载行程失败:', error)
    ElMessage.error('加载行程失败')
  } finally {
    loading.value = false
  }
}

const editTrip = () => {
  if (tripData.value) {
    router.push(`/?tripId=${tripData.value.tripId}`)
  }
}

const confirmDelete = async () => {
  try {
    await ElMessageBox.confirm('确定要删除这个行程吗？删除后无法恢复。', '删除确认', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    
    const res = await tripAPI.delete(tripData.value.tripId)
    if (res.code === 200) {
      ElMessage.success('删除成功')
      router.push('/history')
    } else {
      ElMessage.error(res.message || '删除失败')
    }
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('删除失败')
    }
  }
}

onMounted(() => {
  loadTripData()
})
</script>

<style scoped>
.trip-detail-page {
  min-height: 100%;
  background: #f5f7fa;
  padding: 24px;
}

.back-nav {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
  max-width: 1200px;
  margin-left: auto;
  margin-right: auto;
}

.back-btn {
  background: linear-gradient(135deg, #9dddd8ff 0%, #c2eae8 100%);
  border: none;
  color: #fff;
}

.nav-title {
  font-size: 20px;
  font-weight: 600;
  color: #303133;
}

.detail-container {
  max-width: 1200px;
  margin: 0 auto;
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  min-height: 400px;
}

.trip-header {
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid #ebeef5;
}

.trip-header h2 {
  font-size: 24px;
  color: #303133;
  margin: 0 0 12px;
}

.trip-meta {
  display: flex;
  gap: 8px;
}

.activities-section {
  margin-bottom: 24px;
  padding: 16px;
  background: #f5f7fa;
  border-radius: 8px;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 12px;
}

.activities-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.itinerary-section {
  margin-bottom: 24px;
}

.day-content {
  padding: 16px 0;
}

.day-section {
  margin-bottom: 24px;
}

.attractions-list,
.restaurants-list,
.hotels-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.attraction-item {
  display: flex;
  gap: 12px;
  padding: 12px;
  background: #f5f7fa;
  border-radius: 8px;
}

.attr-order {
  width: 28px;
  height: 28px;
  background: linear-gradient(135deg, #9dddd8ff 0%, #c2eae8 100%);
  color: #fff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  flex-shrink: 0;
}

.attr-info {
  flex: 1;
}

.attr-name {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 4px;
}

.attr-meta {
  display: flex;
  gap: 12px;
  font-size: 13px;
  color: #909399;
  margin-bottom: 4px;
}

.attr-meta span {
  display: flex;
  align-items: center;
  gap: 4px;
}

.attr-address {
  font-size: 13px;
  color: #909399;
  margin-bottom: 4px;
}

.attr-desc {
  font-size: 13px;
  color: #606266;
  line-height: 1.5;
}

.restaurant-item,
.hotel-item {
  padding: 12px;
  background: #f5f7fa;
  border-radius: 8px;
}

.rest-name,
.hotel-name {
  font-size: 15px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 4px;
}

.rest-meta,
.hotel-meta {
  display: flex;
  gap: 12px;
  font-size: 13px;
  color: #909399;
  margin-bottom: 4px;
}

.rest-specialty,
.hotel-address {
  font-size: 13px;
  color: #606266;
}

.empty-itinerary {
  padding: 40px 0;
}

.trip-footer {
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid #ebeef5;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.footer-info {
  display: flex;
  gap: 24px;
  font-size: 13px;
  color: #909399;
}

.footer-actions {
  display: flex;
  gap: 12px;
}
</style>
