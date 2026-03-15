<template>
  <div class="profile-page">
    <div class="back-nav">
      <el-button class="back-btn" @click="goBack" circle size="small">
        <el-icon><ArrowLeft /></el-icon>
      </el-button>
      <span class="nav-title">个人中心</span>
    </div>
    
    <div class="profile-container">
      <div class="profile-sidebar">
        <div class="user-card">
          <el-avatar :size="80" class="user-avatar">
            {{ userStore.userInfo?.nickname?.charAt(0) || '游' }}
          </el-avatar>
          <div class="user-info">
            <h2>{{ userStore.userInfo?.nickname || '游客' }}</h2>
            <p>{{ userStore.userInfo?.email || '未登录' }}</p>
          </div>
          <el-button class="edit-btn" @click="showEditDialog = true" text>
            <el-icon><Edit /></el-icon> 编辑资料
          </el-button>
        </div>
        
        <div class="menu-card">
          <div class="menu-item" @click="$router.push('/history')">
            <el-icon><Document /></el-icon>
            <span>我的行程</span>
            <el-badge :value="stats.totalTrips" :hidden="!stats.totalTrips" />
          </div>
          <div class="menu-item" @click="$router.push('/favorites')">
            <el-icon><Star /></el-icon>
            <span>我的收藏</span>
            <el-badge :value="totalFavorites" :hidden="!totalFavorites" />
          </div>
          <div class="menu-item" @click="$router.push('/settings')">
            <el-icon><Setting /></el-icon>
            <span>偏好设置</span>
          </div>
          <div class="menu-item" @click="showPasswordDialog = true">
            <el-icon><Lock /></el-icon>
            <span>修改密码</span>
          </div>
          <div class="menu-item danger" @click="handleLogout">
            <el-icon><SwitchButton /></el-icon>
            <span>退出登录</span>
          </div>
        </div>
      </div>
      
      <div class="profile-main">
        <div class="stats-section">
          <div class="section-title">使用统计</div>
          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-icon"><el-icon><MapLocation /></el-icon></div>
              <div class="stat-content">
                <div class="stat-value">{{ stats.totalTrips }}</div>
                <div class="stat-label">行程总数</div>
              </div>
            </div>
            <div class="stat-card">
              <div class="stat-icon attraction"><el-icon><Location /></el-icon></div>
              <div class="stat-content">
                <div class="stat-value">{{ stats.favoriteAttractions }}</div>
                <div class="stat-label">收藏景点</div>
              </div>
            </div>
            <div class="stat-card">
              <div class="stat-icon restaurant"><el-icon><Star /></el-icon></div>
              <div class="stat-content">
                <div class="stat-value">{{ stats.favoriteRestaurants }}</div>
                <div class="stat-label">收藏美食</div>
              </div>
            </div>
            <div class="stat-card">
              <div class="stat-icon hotel"><el-icon><House /></el-icon></div>
              <div class="stat-content">
                <div class="stat-value">{{ stats.favoriteHotels }}</div>
                <div class="stat-label">收藏住宿</div>
              </div>
            </div>
          </div>
        </div>
        
        <div class="preferences-section">
          <div class="section-title">当前偏好</div>
          <div class="preferences-grid">
            <div class="pref-card">
              <div class="pref-label">出行人群</div>
              <div class="pref-value">{{ userStore.preferences?.crowd || '未设置' }}</div>
            </div>
            <div class="pref-card">
              <div class="pref-label">预算范围</div>
              <div class="pref-value">{{ formatBudget(userStore.preferences?.budgetRange) }}</div>
            </div>
            <div class="pref-card">
              <div class="pref-label">行程强度</div>
              <div class="pref-value">{{ userStore.preferences?.intensity || '未设置' }}</div>
            </div>
            <div class="pref-card">
              <div class="pref-label">住宿区域</div>
              <div class="pref-value">{{ userStore.preferences?.hotelArea || '未设置' }}</div>
            </div>
            <div class="pref-card full">
              <div class="pref-label">饮食偏好</div>
              <div class="pref-tags">
                <el-tag v-for="food in (userStore.preferences?.foodPreferences || []).slice(0, 5)" :key="food" size="small">{{ food }}</el-tag>
                <span v-if="!userStore.preferences?.foodPreferences?.length" class="empty">未设置</span>
              </div>
            </div>
            <div class="pref-card full">
              <div class="pref-label">兴趣偏好</div>
              <div class="pref-tags">
                <el-tag v-for="interest in (userStore.preferences?.interests || []).slice(0, 5)" :key="interest" size="small" type="success">{{ interest }}</el-tag>
                <span v-if="!userStore.preferences?.interests?.length" class="empty">未设置</span>
              </div>
            </div>
          </div>
          <el-button type="primary" plain class="edit-pref-btn" @click="$router.push('/settings')">
            <el-icon><Edit /></el-icon> 编辑偏好
          </el-button>
        </div>
        
        <div class="info-section">
          <div class="section-title">账户信息</div>
          <el-descriptions :column="2" border>
            <el-descriptions-item label="用户ID">{{ userStore.userInfo?.userId || '-' }}</el-descriptions-item>
            <el-descriptions-item label="昵称">{{ userStore.userInfo?.nickname || '-' }}</el-descriptions-item>
            <el-descriptions-item label="邮箱">{{ userStore.userInfo?.email || '-' }}</el-descriptions-item>
            <el-descriptions-item label="注册时间">{{ formatDate(userStore.userInfo?.createdAt) || '-' }}</el-descriptions-item>
          </el-descriptions>
        </div>
      </div>
    </div>

    <el-dialog v-model="showEditDialog" title="编辑资料" width="400px" :close-on-click-modal="false">
      <el-form :model="editForm" label-width="70px">
        <el-form-item label="昵称">
          <el-input v-model="editForm.nickname" placeholder="请输入昵称" maxlength="20" show-word-limit />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showEditDialog = false">取消</el-button>
        <el-button type="primary" @click="handleUpdateProfile" :loading="updating">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showPasswordDialog" title="修改密码" width="400px" :close-on-click-modal="false">
      <el-form :model="passwordForm" :rules="passwordRules" ref="passwordFormRef" label-width="90px">
        <el-form-item label="当前密码" prop="oldPassword">
          <el-input v-model="passwordForm.oldPassword" type="password" show-password placeholder="请输入当前密码" />
        </el-form-item>
        <el-form-item label="新密码" prop="newPassword">
          <el-input v-model="passwordForm.newPassword" type="password" show-password placeholder="请输入新密码" />
        </el-form-item>
        <el-form-item label="确认新密码" prop="confirmPassword">
          <el-input v-model="passwordForm.confirmPassword" type="password" show-password placeholder="请确认新密码" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showPasswordDialog = false">取消</el-button>
        <el-button type="primary" @click="handleChangePassword" :loading="changingPassword">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '../stores/user'
import { useTripStore } from '../stores/trip'
import { userAPI, tripAPI } from '../api'
import { ElMessage } from 'element-plus'
import { ArrowLeft, Edit, Document, Star, Setting, Lock, SwitchButton, MapLocation, Location, House } from '@element-plus/icons-vue'

const Food = { template: '<svg viewBox="0 0 1024 1024"><path fill="currentColor" d="M896 128H128v128a128 128 0 0 0 128 128h64v448a64 64 0 0 0 64 64h256a64 64 0 0 0 64-64V384h64a128 128 0 0 0 128-128V128zm-64 128a64 64 0 0 1-64 64H256a64 64 0 0 1-64-64v-64h640v64z"/></svg>' }

const router = useRouter()
const userStore = useUserStore()
const tripStore = useTripStore()

const showEditDialog = ref(false)
const showPasswordDialog = ref(false)
const updating = ref(false)
const changingPassword = ref(false)
const passwordFormRef = ref(null)

const stats = reactive({
  totalTrips: 0,
  favoriteAttractions: 0,
  favoriteRestaurants: 0,
  favoriteHotels: 0
})

const totalFavorites = computed(() => 
  stats.favoriteAttractions + stats.favoriteRestaurants + stats.favoriteHotels
)

const editForm = reactive({
  nickname: ''
})

const passwordForm = reactive({
  oldPassword: '',
  newPassword: '',
  confirmPassword: ''
})

const validateConfirmPassword = (rule, value, callback) => {
  if (!value) {
    callback(new Error('请确认新密码'))
  } else if (value !== passwordForm.newPassword) {
    callback(new Error('两次输入的密码不一致'))
  } else {
    callback()
  }
}

const passwordRules = {
  oldPassword: [{ required: true, message: '请输入当前密码', trigger: 'blur' }],
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 6, message: '密码长度至少6位', trigger: 'blur' }
  ],
  confirmPassword: [{ validator: validateConfirmPassword, trigger: 'blur' }]
}

const formatBudget = (range) => {
  if (!range || !Array.isArray(range)) return '未设置'
  return `¥${range[0]} - ¥${range[1]}`
}

const goBack = () => {
  router.push('/')
}

const formatDate = (dateStr) => {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleDateString('zh-CN')
}

const loadUserInfo = async () => {
  try {
    const res = await userAPI.getProfile()
    if (res.code === 200 && res.data) {
      userStore.setUser(res.data)
      editForm.nickname = res.data.nickname || ''
    }
  } catch (error) {
    console.error('获取用户信息失败:', error)
  }
}

const loadStats = async () => {
  try {
    const [tripsRes, favoritesRes] = await Promise.all([
      tripAPI.getUserTrips({ page: 1, pageSize: 1 }),
      fetch('/api/favorites', {
        headers: { 'X-Session-Id': localStorage.getItem('sessionId') || '' }
      }).then(r => r.json())
    ])
    
    if (tripsRes.code === 200) {
      stats.totalTrips = tripsRes.data?.total || tripsRes.data?.length || 0
    }
    
    if (favoritesRes.code === 200 && favoritesRes.data) {
      stats.favoriteAttractions = favoritesRes.data.attractions?.length || 0
      stats.favoriteRestaurants = favoritesRes.data.restaurants?.length || 0
      stats.favoriteHotels = favoritesRes.data.hotels?.length || 0
    }
  } catch (error) {
    console.error('加载统计数据失败:', error)
  }
}

const handleUpdateProfile = async () => {
  updating.value = true
  try {
    const res = await userAPI.updateProfile({ nickname: editForm.nickname })
    if (res.code === 200) {
      userStore.updateUserInfo({ nickname: editForm.nickname })
      ElMessage.success('资料更新成功')
      showEditDialog.value = false
    } else {
      ElMessage.error(res.message || '更新失败')
    }
  } catch (error) {
    ElMessage.error('更新失败')
  } finally {
    updating.value = false
  }
}

const handleChangePassword = async () => {
  if (!passwordFormRef.value) return
  
  await passwordFormRef.value.validate(async (valid) => {
    if (!valid) return
    
    changingPassword.value = true
    try {
      const res = await userAPI.changePassword(passwordForm.oldPassword, passwordForm.newPassword)
      if (res.code === 200) {
        ElMessage.success('密码修改成功')
        showPasswordDialog.value = false
        passwordForm.oldPassword = ''
        passwordForm.newPassword = ''
        passwordForm.confirmPassword = ''
      } else {
        ElMessage.error(res.message || '修改失败')
      }
    } catch (error) {
      ElMessage.error(error.response?.data?.message || '修改失败')
    } finally {
      changingPassword.value = false
    }
  })
}

const handleLogout = async () => {
  const currentTripId = localStorage.getItem('currentTripId')
  const tripData = tripStore.getSaveData()
  
  if (tripData.itinerary && tripData.itinerary.length > 0) {
    try {
      if (currentTripId) {
        await tripAPI.update(currentTripId, {
          itinerary: tripData.itinerary,
          requirements: tripData.params,
          conversationHistory: tripData.conversationHistory,
          routes: tripData.routes
        })
      } else {
        await tripAPI.create(tripData)
      }
    } catch (error) {
      console.error('保存行程失败:', error)
    }
  }
  
  try {
    await userAPI.logout()
  } catch (error) {
    console.error('登出失败:', error)
  }
  
  userStore.logout()
  tripStore.resetTrip()
  localStorage.removeItem('currentTripId')
  localStorage.removeItem('sessionId')
  ElMessage.success('已退出登录')
  router.push('/login')
}

onMounted(() => {
  if (userStore.isLoggedIn) {
    loadUserInfo()
    loadStats()
  } else {
    router.push('/login')
  }
})
</script>

<style scoped>
.profile-page {
  min-height: 100%;
  background: #f5f7fa;
  padding: 24px;
}

.back-nav {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
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

.profile-container {
  display: flex;
  gap: 24px;
  max-width: 1200px;
  margin: 0 auto;
}

.profile-sidebar {
  width: 280px;
  flex-shrink: 0;
}

.user-card {
  background: linear-gradient(135deg, #9dddd8ff 0%, #c2eae8 100%);
  border-radius: 16px;
  padding: 32px 24px;
  text-align: center;
  color: #fff;
  margin-bottom: 16px;
}

.user-avatar {
  background: rgba(255, 255, 255, 0.3);
  color: #fff;
  font-size: 32px;
  font-weight: 600;
  margin-bottom: 16px;
}

.user-info h2 {
  margin: 0 0 8px;
  font-size: 22px;
}

.user-info p {
  margin: 0;
  font-size: 14px;
  opacity: 0.9;
}

.edit-btn {
  margin-top: 16px;
  color: #fff;
}

.menu-card {
  background: #fff;
  border-radius: 12px;
  overflow: hidden;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
  cursor: pointer;
  transition: all 0.2s;
  border-bottom: 1px solid #f0f0f0;
}

.menu-item:last-child {
  border-bottom: none;
}

.menu-item:hover {
  background: #fafafa;
}

.menu-item span {
  flex: 1;
  font-size: 15px;
  color: #303133;
}

.menu-item.danger span,
.menu-item.danger .el-icon {
  color: #f56c6c;
}

.profile-main {
  flex: 1;
  min-width: 0;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 16px;
  padding-left: 4px;
}

.stats-section {
  margin-bottom: 24px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

.stat-card {
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 16px;
}

.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: linear-gradient(135deg, #9dddd8ff 0%, #c2eae8 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 24px;
}

.stat-icon.attraction {
  background: linear-gradient(135deg, #67c23a 0%, #85ce61 100%);
}

.stat-icon.restaurant {
  background: linear-gradient(135deg, #e6a23c 0%, #f0c78a 100%);
}

.stat-icon.hotel {
  background: linear-gradient(135deg, #409eff 0%, #79bbff 100%);
}

.stat-value {
  font-size: 28px;
  font-weight: 600;
  color: #303133;
}

.stat-label {
  font-size: 13px;
  color: #909399;
  margin-top: 4px;
}

.preferences-section {
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 24px;
}

.preferences-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.pref-card {
  padding: 16px;
  background: #fafafa;
  border-radius: 8px;
}

.pref-card.full {
  grid-column: span 2;
}

.pref-label {
  font-size: 13px;
  color: #909399;
  margin-bottom: 8px;
}

.pref-value {
  font-size: 15px;
  color: #303133;
  font-weight: 500;
}

.pref-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.pref-tags .empty {
  font-size: 14px;
  color: #c0c4cc;
}

.edit-pref-btn {
  margin-top: 20px;
}

.info-section {
  background: #fff;
  border-radius: 12px;
  padding: 24px;
}

@media (max-width: 900px) {
  .profile-container {
    flex-direction: column;
  }
  
  .profile-sidebar {
    width: 100%;
  }
  
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .preferences-grid {
    grid-template-columns: 1fr;
  }
  
  .pref-card.full {
    grid-column: span 1;
  }
}
</style>
