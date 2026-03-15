<template>
  <div class="history-trips">
    <div class="page-header">
      <h1>历史行程</h1>
      <p>查看和管理您的历史行程规划</p>
    </div>

    <div class="filter-bar">
      <el-input v-model="keyword" placeholder="搜索行程标题" clearable style="width: 200px" @clear="loadTrips" @keyup.enter="loadTrips">
        <template #prefix>
          <el-icon><Search /></el-icon>
        </template>
      </el-input>
      
      <el-select v-model="statusFilter" placeholder="状态筛选" clearable style="width: 150px" @change="loadTrips">
        <el-option label="全部" value="" />
        <el-option label="草稿" value="draft" />
        <el-option label="已完成" value="completed" />
      </el-select>
      
      <el-button type="primary" @click="loadTrips">
        <el-icon><Search /></el-icon>
        搜索
      </el-button>
    </div>

    <div v-loading="loading" class="trips-list">
      <el-empty v-if="!loading && trips.length === 0" description="暂无历史行程">
        <el-button type="primary" @click="$router.push('/')">去规划行程</el-button>
      </el-empty>

      <div v-else class="trip-cards">
        <div v-for="trip in trips" :key="trip.tripId" class="trip-card" @click="openTrip(trip.tripId)">
          <div class="trip-header">
            <h3 class="trip-title">{{ trip.title || '未命名行程' }}</h3>
            <el-tag v-if="trip.status === 'draft'" type="info" size="small">草稿</el-tag>
            <el-tag v-else type="success" size="small">已完成</el-tag>
          </div>

          <div class="trip-info">
            <div class="info-item">
              <el-icon><Calendar /></el-icon>
              <span>{{ trip.requirements?.days || 1 }}天行程</span>
            </div>
            <div class="info-item">
              <el-icon><User /></el-icon>
              <span>{{ trip.requirements?.crowd || '未设置' }}</span>
            </div>
            <div class="info-item">
              <el-icon><Wallet /></el-icon>
              <span>预算: {{ trip.requirements?.budget || '未设置' }}</span>
            </div>
          </div>

          <div class="trip-meta">
            <span class="create-time">创建于 {{ formatDate(trip.createdAt) }}</span>
            <span v-if="trip.updatedAt !== trip.createdAt" class="update-time">更新于 {{ formatDate(trip.updatedAt) }}</span>
          </div>

          <div class="trip-actions" @click.stop>
            <el-button text type="primary" @click="openTrip(trip.tripId)">
              <el-icon><View /></el-icon>
              查看
            </el-button>
            <el-button text type="danger" @click="confirmDelete(trip)">
              <el-icon><Delete /></el-icon>
              删除
            </el-button>
          </div>
        </div>
      </div>

      <div v-if="total > pageSize" class="pagination">
        <el-pagination v-model:current-page="currentPage" :page-size="pageSize" :total="total" layout="prev, pager, next" @current-change="loadTrips" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Calendar, User, Wallet, View, Delete } from '@element-plus/icons-vue'
import { tripAPI } from '../api'

const router = useRouter()
const trips = ref([])
const loading = ref(false)
const keyword = ref('')
const statusFilter = ref('')
const currentPage = ref(1)
const pageSize = ref(12)
const total = ref(0)

const loadTrips = async () => {
  loading.value = true
  try {
    const res = await tripAPI.getTrips({ page: currentPage.value, pageSize: pageSize.value, keyword: keyword.value, status: statusFilter.value })
    if (res.code === 200) {
      trips.value = res.data.trips || []
      total.value = res.data.total || 0
    }
  } catch (error) {
    console.error('加载历史行程失败:', error)
    ElMessage.error('加载历史行程失败')
  } finally {
    loading.value = false
  }
}

const openTrip = (tripId) => router.push(`/trip/${tripId}`)

const confirmDelete = async (trip) => {
  try {
    await ElMessageBox.confirm(`确定要删除行程"${trip.title || '未命名行程'}"吗？此操作不可恢复。`, '删除确认', { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' })
    await deleteTrip(trip.tripId)
  } catch {}
}

const deleteTrip = async (tripId) => {
  try {
    const res = await tripAPI.deleteTrip(tripId)
    if (res.code === 200) {
      ElMessage.success('删除成功')
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
  return date.toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

onMounted(() => loadTrips())
</script>

<style scoped>
.history-trips { padding: 20px; max-width: 1200px; margin: 0 auto; }
.page-header { margin-bottom: 24px; }
.page-header h1 { font-size: 24px; font-weight: 600; color: #303133; margin-bottom: 8px; }
.page-header p { color: #909399; font-size: 14px; }
.filter-bar { display: flex; gap: 12px; margin-bottom: 20px; align-items: center; }
.trips-list { min-height: 400px; }
.trip-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; }
.trip-card { background: #fff; border-radius: 8px; padding: 16px; cursor: pointer; transition: all 0.3s; border: 1px solid #ebeef5; }
.trip-card:hover { box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1); transform: translateY(-2px); }
.trip-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.trip-title { font-size: 16px; font-weight: 600; color: #303133; margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; margin-right: 8px; }
.trip-info { display: flex; flex-wrap: wrap; gap: 16px; margin-bottom: 12px; }
.info-item { display: flex; align-items: center; gap: 4px; font-size: 13px; color: #606266; }
.info-item .el-icon { color: #909399; }
.trip-meta { display: flex; gap: 16px; font-size: 12px; color: #909399; margin-bottom: 12px; }
.trip-actions { display: flex; justify-content: flex-end; gap: 8px; border-top: 1px solid #ebeef5; padding-top: 12px; margin-top: 12px; }
.pagination { display: flex; justify-content: center; margin-top: 24px; }
</style>
