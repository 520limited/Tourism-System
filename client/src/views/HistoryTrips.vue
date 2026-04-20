<template>
  <div class="history-page">
    <div class="back-nav">
      <el-button class="back-btn" @click="goBack" circle size="small">
        <el-icon><ArrowLeft /></el-icon>
      </el-button>
      <span class="nav-title">历史行程</span>
    </div>

    <div class="history-container">
      <div class="filter-bar">
        <el-input
          v-model="keyword"
          placeholder="搜索行程标题"
          clearable
          style="width: 200px"
          @clear="loadTrips"
          @keyup.enter="loadTrips"
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>
        
        <el-select v-model="statusFilter" placeholder="状态筛选" clearable style="width: 150px" @change="loadTrips">
          <el-option label="全部" value="" />
          <el-option label="已收藏" value="favorited" />
        </el-select>
        
        <el-button type="primary" @click="loadTrips">
          <el-icon><Search /></el-icon>
          搜索
        </el-button>
      </div>

      <div v-loading="loading" class="trips-grid">
        <el-empty v-if="!loading && trips.length === 0" description="暂无历史行程">
          <el-button type="primary" @click="$router.push('/')">去规划行程</el-button>
        </el-empty>

        <div v-for="trip in trips" :key="trip.tripId" class="trip-card" @click="openTrip(trip.tripId)">
          <div class="card-header">
            <div class="card-icon">
              <el-icon><MapLocation /></el-icon>
            </div>
            <div class="card-info">
              <div class="card-title">{{ trip.title || '未命名行程' }}</div>
              <div class="card-meta">
                <span>{{ trip.requirements?.days || 1 }}天行程</span>
                <span v-if="trip.requirements?.crowd"> · {{ trip.requirements.crowd }}</span>
                <span v-if="trip.requirements?.budget"> · 预算{{ trip.requirements.budget }}</span>
              </div>
            </div>
            <el-tag v-if="trip.status === 'draft'" type="info" size="small">草稿</el-tag>
            <el-tag v-else type="success" size="small">已完成</el-tag>
          </div>
          
          <div class="card-time">
            <span>创建于 {{ formatDate(trip.createdAt) }}</span>
            <span v-if="trip.updatedAt !== trip.createdAt"> · 更新于 {{ formatDate(trip.updatedAt) }}</span>
          </div>

          <div class="card-actions" @click.stop>
            <el-button :type="trip.isFavorite ? 'danger' : 'default'" text size="small" @click.stop="toggleTripFavorite(trip)">
              <el-icon><Star /></el-icon>
              {{ trip.isFavorite ? '已收藏' : '收藏' }}
            </el-button>
            <el-button text type="primary" size="small" @click="openTrip(trip.tripId)">
              <el-icon><View /></el-icon>
              查看
            </el-button>
            <el-button text type="warning" size="small" @click="editTrip(trip.tripId)">
              <el-icon><Edit /></el-icon>
              编辑
            </el-button>
            <el-button text type="danger" size="small" @click="confirmDelete(trip)">
              <el-icon><Delete /></el-icon>
              删除
            </el-button>
          </div>
        </div>
      </div>

      <div v-if="total > pageSize" class="pagination">
        <el-pagination
          v-model:current-page="currentPage"
          :page-size="pageSize"
          :total="total"
          layout="prev, pager, next"
          @current-change="loadTrips"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeft, Search, MapLocation, View, Delete, Edit, Star } from '@element-plus/icons-vue'
import { tripAPI } from '../api'
import { useTripStore } from '../stores/trip'

const router = useRouter()

const trips = ref([])
const loading = ref(false)
const keyword = ref('')
const statusFilter = ref('')
const currentPage = ref(1)
const pageSize = ref(12)
const total = ref(0)

const goBack = () => {
  router.push('/profile')
}

const loadTrips = async () => {
  loading.value = true
  try {
    const params = { page: currentPage.value, pageSize: pageSize.value }
    if (keyword.value) params.keyword = keyword.value
    // 收藏筛选：传给后端 isFavorite 参数
    if (statusFilter.value === 'favorited') {
      params.isFavorite = true
    } else if (statusFilter.value) {
      params.status = statusFilter.value
    }

    const res = await tripAPI.getTrips(params)
    
    if (res.code === 200) {
      if (Array.isArray(res.data)) {
        trips.value = res.data
        total.value = res.data.length
      } else {
        trips.value = res.data.trips || []
        total.value = res.data.total || 0
      }
    }
  } catch (error) {
    console.error('加载历史行程失败:', error)
    ElMessage.error('加载历史行程失败')
  } finally {
    loading.value = false
  }
}

const openTrip = (tripId) => {
  router.push(`/trip/${tripId}`)
}

const editTrip = (tripId) => {
  router.push(`/?tripId=${tripId}`)
}

const toggleTripFavorite = async (trip) => {
  try {
    const sessionId = localStorage.getItem('sessionId')
    const res = await fetch(`/api/trips/${trip.tripId}/favorite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Session-Id': sessionId || '' },
      body: JSON.stringify({ isFavorite: !trip.isFavorite })
    }).then(r => r.json())

    if (res.code === 200) {
      trip.isFavorite = !trip.isFavorite
      ElMessage.success(trip.isFavorite ? '已收藏行程' : '已取消收藏')
    } else {
      ElMessage.error(res.message || '操作失败')
    }
  } catch (error) {
    console.error('收藏行程失败:', error)
    ElMessage.error('收藏失败')
  }
}

const confirmDelete = async (trip) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除行程"${trip.title || '未命名行程'}"吗？此操作不可恢复。`,
      '删除确认',
      {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    await deleteTrip(trip.tripId)
  } catch {
    // 用户取消
  }
}

const deleteTrip = async (tripId) => {
  try {
    const res = await tripAPI.delete(tripId)
    if (res.code === 200) {
      ElMessage.success('删除成功')
      
      const tripStore = useTripStore()
      const strTripId = String(tripId)
      const storedId = String(localStorage.getItem('currentTripId') || '')
      const storeId = String(tripStore.tripId || '')
      
      // 无论是否是当前行程，只要匹配就清理（更安全）
      if (storeId === strTripId || storedId === strTripId) {
        tripStore.resetTrip()
        localStorage.removeItem('currentTripId')
        // 清除URL中的tripId参数，防止回主页时再次加载
        if (window.history.replaceState) {
          window.history.replaceState({}, '', window.location.pathname)
        }
      }
      
      loadTrips()
    } else {
      ElMessage.error(res.message || '删除失败')
    }
  } catch (error) {
    console.error('删除行程失败:', error)
    ElMessage.error('删除失败')
  }
}

const formatDate = (dateStr) => {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

onMounted(() => {
  loadTrips()
})
</script>

<style scoped>
.history-page {
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

.history-container {
  max-width: 1200px;
  margin: 0 auto;
}

.filter-bar {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
  background: #fff;
  padding: 16px;
  border-radius: 12px;
}

.trips-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
  min-height: 200px;
}

.trip-card {
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  cursor: pointer;
  transition: all 0.2s;
}

.trip-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.card-header {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 12px;
}

.card-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: linear-gradient(135deg, #9dddd8ff 0%, #c2eae8 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 24px;
  flex-shrink: 0;
}

.card-info {
  flex: 1;
  min-width: 0;
}

.card-title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-meta {
  font-size: 13px;
  color: #909399;
}

.card-time {
  font-size: 12px;
  color: #c0c4cc;
  margin-bottom: 12px;
}

.card-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  border-top: 1px solid #ebeef5;
  padding-top: 12px;
}

.pagination {
  display: flex;
  justify-content: center;
  margin-top: 24px;
  background: #fff;
  padding: 16px;
  border-radius: 12px;
}

@media (max-width: 768px) {
  .trips-grid {
    grid-template-columns: 1fr;
  }
}
</style>
