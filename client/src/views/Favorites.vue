<template>
  <div class="favorites-page">
    <div class="back-nav">
      <el-button class="back-btn" @click="goBack" circle size="small">
        <el-icon><ArrowLeft /></el-icon>
      </el-button>
      <span class="nav-title">我的收藏</span>
    </div>

    <div class="favorites-container">
      <el-tabs v-model="activeTab" class="favorites-tabs">
        <el-tab-pane name="attractions">
          <template #label>
            <span class="tab-label">
              <el-icon><Location /></el-icon>
              景点
              <el-badge :value="favorites.attractions.length" :hidden="!favorites.attractions.length" class="tab-badge" />
            </span>
          </template>
          <div v-loading="loading" class="favorites-grid">
            <el-empty v-if="!loading && favorites.attractions.length === 0" description="暂无收藏景点" />
            <div v-for="item in favorites.attractions" :key="item.id" class="favorite-card">
              <div class="card-icon attraction">
                <el-icon><Location /></el-icon>
              </div>
              <div class="card-content">
                <div class="card-title">{{ item.name }}</div>
                <div class="card-meta" v-if="item.address">{{ item.address }}</div>
                <div class="card-tags" v-if="item.tags">
                  <el-tag v-for="tag in item.tags.slice(0, 3)" :key="tag" size="small">{{ tag }}</el-tag>
                </div>
              </div>
              <div class="card-actions">
                <el-button text size="small" @click="removeFavorite('attraction', item)">
                  <el-icon><Delete /></el-icon>
                </el-button>
              </div>
            </div>
          </div>
        </el-tab-pane>
        
        <el-tab-pane name="restaurants">
          <template #label>
            <span class="tab-label">
              <el-icon><Food /></el-icon>
              美食
              <el-badge :value="favorites.restaurants.length" :hidden="!favorites.restaurants.length" class="tab-badge" />
            </span>
          </template>
          <div v-loading="loading" class="favorites-grid">
            <el-empty v-if="!loading && favorites.restaurants.length === 0" description="暂无收藏美食" />
            <div v-for="item in favorites.restaurants" :key="item.id" class="favorite-card">
              <div class="card-icon restaurant">
                <el-icon><Food /></el-icon>
              </div>
              <div class="card-content">
                <div class="card-title">{{ item.name }}</div>
                <div class="card-meta" v-if="item.cuisine">{{ item.cuisine }}</div>
                <div class="card-meta" v-if="item.address">{{ item.address }}</div>
              </div>
              <div class="card-actions">
                <el-button text size="small" @click="removeFavorite('restaurant', item)">
                  <el-icon><Delete /></el-icon>
                </el-button>
              </div>
            </div>
          </div>
        </el-tab-pane>
        
        <el-tab-pane name="hotels">
          <template #label>
            <span class="tab-label">
              <el-icon><House /></el-icon>
              住宿
              <el-badge :value="favorites.hotels.length" :hidden="!favorites.hotels.length" class="tab-badge" />
            </span>
          </template>
          <div v-loading="loading" class="favorites-grid">
            <el-empty v-if="!loading && favorites.hotels.length === 0" description="暂无收藏住宿" />
            <div v-for="item in favorites.hotels" :key="item.id" class="favorite-card">
              <div class="card-icon hotel">
                <el-icon><House /></el-icon>
              </div>
              <div class="card-content">
                <div class="card-title">{{ item.name }}</div>
                <div class="card-meta" v-if="item.area">{{ item.area }}</div>
                <div class="card-meta" v-if="item.price">{{ item.price }}元/晚</div>
              </div>
              <div class="card-actions">
                <el-button text size="small" @click="removeFavorite('hotel', item)">
                  <el-icon><Delete /></el-icon>
                </el-button>
              </div>
            </div>
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { favoriteAPI } from '../api'
import { ElMessage } from 'element-plus'
import { ArrowLeft, Location, Delete } from '@element-plus/icons-vue'

const Food = { template: '<svg viewBox="0 0 1024 1024"><path fill="currentColor" d="M896 128H128v128a128 128 0 0 0 128 128h64v448a64 64 0 0 0 64 64h256a64 64 0 0 0 64-64V384h64a128 128 0 0 0 128-128V128zm-64 128a64 64 0 0 1-64 64H256a64 64 0 0 1-64-64v-64h640v64z"/></svg>' }
const House = { template: '<svg viewBox="0 0 1024 1024"><path fill="currentColor" d="M512 128L128 448v448h256V640h256v256h256V448L512 128zm0 76.8L832 480v352H640V576H384v256H192V480L512 204.8z"/></svg>' }

const router = useRouter()
const loading = ref(false)
const activeTab = ref('attractions')

const favorites = reactive({
  attractions: [],
  restaurants: [],
  hotels: []
})

const goBack = () => {
  router.push('/profile')
}

const loadFavorites = async () => {
  loading.value = true
  try {
    const res = await favoriteAPI.getAll()
    if (res.code === 200) {
      favorites.attractions = res.data.attractions || []
      favorites.restaurants = res.data.restaurants || []
      favorites.hotels = res.data.hotels || []
    }
  } catch (error) {
    console.error('加载收藏失败:', error)
  } finally {
    loading.value = false
  }
}

const removeFavorite = async (type, item) => {
  try {
    const res = await favoriteAPI.remove(type, item.id || item.name)
    if (res.code === 200 && res.success) {
      ElMessage.success('已取消收藏')
      loadFavorites()
    } else {
      ElMessage.error(res.message || '操作失败')
    }
  } catch (error) {
    ElMessage.error('操作失败')
  }
}

onMounted(() => {
  loadFavorites()
})
</script>

<style scoped>
.favorites-page {
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

.favorites-container {
  max-width: 1200px;
  margin: 0 auto;
}

.favorites-tabs {
  background: #fff;
  border-radius: 12px;
  padding: 20px;
}

.favorites-tabs :deep(.el-tabs__header) {
  margin-bottom: 24px;
}

.favorites-tabs :deep(.el-tabs__item.is-active) {
  color: #9dddd8ff;
}

.favorites-tabs :deep(.el-tabs__active-bar) {
  background-color: #9dddd8ff;
}

.tab-label {
  display: flex;
  align-items: center;
  gap: 6px;
}

.tab-badge {
  margin-left: 4px;
}

.favorites-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
  min-height: 200px;
}

.favorite-card {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 20px;
  background: #fafafa;
  border-radius: 12px;
  transition: all 0.2s;
}

.favorite-card:hover {
  background: #f5f5f5;
  transform: translateY(-2px);
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

.card-icon.restaurant {
  background: linear-gradient(135deg, #e6a23c 0%, #f0c78a 100%);
}

.card-icon.hotel {
  background: linear-gradient(135deg, #409eff 0%, #79bbff 100%);
}

.card-content {
  flex: 1;
  min-width: 0;
}

.card-title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 8px;
}

.card-meta {
  font-size: 13px;
  color: #909399;
  margin-bottom: 4px;
}

.card-tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-top: 8px;
}

.card-actions {
  flex-shrink: 0;
}

.card-actions .el-button {
  color: #909399;
}

.card-actions .el-button:hover {
  color: #f56c6c;
}

@media (max-width: 768px) {
  .favorites-grid {
    grid-template-columns: 1fr;
  }
}
</style>
