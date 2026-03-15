<template>
  <div class="settings-page">
    <div class="back-nav">
      <el-button class="back-btn" @click="goBack" circle size="small">
        <el-icon><ArrowLeft /></el-icon>
      </el-button>
      <span class="nav-title">系统设置</span>
    </div>

    <div class="settings-container">
      <div class="settings-main">
        <div class="settings-section">
          <div class="section-header">
            <el-icon><User /></el-icon>
            <span>出行偏好设置</span>
          </div>
          
          <el-form :model="preferencesForm" label-width="100px" class="settings-form">
            <el-row :gutter="24">
              <el-col :span="12">
                <el-form-item label="出行人群">
                  <el-select v-model="preferencesForm.crowd" placeholder="请选择" style="width: 100%" allow-create filterable>
                    <el-option label="情侣出游" value="情侣" />
                    <el-option label="亲子游" value="亲子" />
                    <el-option label="朋友结伴" value="朋友" />
                    <el-option label="家庭出游" value="家庭" />
                    <el-option label="独自旅行" value="独自旅行" />
                    <el-option label="带老人" value="老人" />
                    <el-option label="公司团建" value="团建" />
                  </el-select>
                </el-form-item>
              </el-col>
              
              <el-col :span="12">
                <el-form-item label="行程强度">
                  <el-radio-group v-model="preferencesForm.intensity">
                    <el-radio-button label="轻松">轻松</el-radio-button>
                    <el-radio-button label="适中">适中</el-radio-button>
                    <el-radio-button label="紧凑">紧凑</el-radio-button>
                  </el-radio-group>
                </el-form-item>
              </el-col>
            </el-row>
            
            <el-form-item label="预算范围">
              <el-slider v-model="preferencesForm.budgetRange" range :min="0" :max="5000" :step="100" :format-tooltip="formatBudget" style="max-width: 400px" />
              <div class="budget-labels">
                <span>经济</span>
                <span>实惠</span>
                <span>舒适</span>
                <span>豪华</span>
              </div>
            </el-form-item>
            
            <el-row :gutter="24">
              <el-col :span="12">
                <el-form-item label="住宿区域">
                  <el-select v-model="preferencesForm.hotelArea" placeholder="请选择" style="width: 100%">
                    <el-option label="五一广场（市中心）" value="五一广场" />
                    <el-option label="橘子洲（景区附近）" value="橘子洲" />
                    <el-option label="岳麓山（大学城）" value="岳麓山" />
                    <el-option label="火车站（交通便利）" value="火车站" />
                    <el-option label="高铁南站" value="高铁南站" />
                    <el-option label="黄花机场" value="黄花机场" />
                  </el-select>
                </el-form-item>
              </el-col>
              
              <el-col :span="12">
                <el-form-item label="住宿标准">
                  <el-rate v-model="preferencesForm.hotelLevel" :max="5" show-score score-template="{value}星级" />
                </el-form-item>
              </el-col>
            </el-row>
            
            <el-form-item label="饮食偏好">
              <el-checkbox-group v-model="preferencesForm.foodPreferences">
                <el-checkbox label="湘菜">湘菜</el-checkbox>
                <el-checkbox label="小吃">小吃</el-checkbox>
                <el-checkbox label="火锅">火锅</el-checkbox>
                <el-checkbox label="烧烤">烧烤</el-checkbox>
                <el-checkbox label="西餐">西餐</el-checkbox>
                <el-checkbox label="日料">日料</el-checkbox>
                <el-checkbox label="素食">素食</el-checkbox>
                <el-checkbox label="海鲜">海鲜</el-checkbox>
                <el-checkbox label="甜品">甜品</el-checkbox>
              </el-checkbox-group>
            </el-form-item>
            
            <el-form-item label="自定义饮食">
              <el-select v-model="preferencesForm.customFoods" multiple filterable allow-create default-first-option placeholder="输入后按回车添加自定义偏好" style="max-width: 500px">
              </el-select>
            </el-form-item>
            
            <el-form-item label="兴趣偏好">
              <el-checkbox-group v-model="preferencesForm.interests">
                <el-checkbox label="美食">美食</el-checkbox>
                <el-checkbox label="自然风光">自然风光</el-checkbox>
                <el-checkbox label="历史文化">历史文化</el-checkbox>
                <el-checkbox label="购物">购物</el-checkbox>
                <el-checkbox label="夜生活">夜生活</el-checkbox>
                <el-checkbox label="主题乐园">主题乐园</el-checkbox>
                <el-checkbox label="摄影打卡">摄影打卡</el-checkbox>
                <el-checkbox label="艺术展览">艺术展览</el-checkbox>
                <el-checkbox label="户外运动">户外运动</el-checkbox>
              </el-checkbox-group>
            </el-form-item>
            
            <el-form-item label="自定义兴趣">
              <el-select v-model="preferencesForm.customInterests" multiple filterable allow-create default-first-option placeholder="输入后按回车添加自定义兴趣" style="max-width: 500px">
              </el-select>
            </el-form-item>
            
            <el-form-item label="出行方式">
              <el-checkbox-group v-model="preferencesForm.transportModes">
                <el-checkbox label="地铁">地铁</el-checkbox>
                <el-checkbox label="公交">公交</el-checkbox>
                <el-checkbox label="打车">打车</el-checkbox>
                <el-checkbox label="共享单车">共享单车</el-checkbox>
                <el-checkbox label="步行">步行</el-checkbox>
              </el-checkbox-group>
            </el-form-item>
            
            <el-form-item>
              <el-button type="primary" @click="savePreferences" :loading="saving">保存偏好</el-button>
              <el-button @click="resetPreferences">重置</el-button>
            </el-form-item>
          </el-form>
        </div>

        <div class="settings-section">
          <div class="section-header">
            <el-icon><Bell /></el-icon>
            <span>通知设置</span>
          </div>
          
          <el-form label-width="100px" class="settings-form">
            <el-row :gutter="24">
              <el-col :span="8">
                <el-form-item label="行程提醒">
                  <el-switch v-model="notificationSettings.tripReminder" />
                </el-form-item>
              </el-col>
              <el-col :span="8">
                <el-form-item label="天气提醒">
                  <el-switch v-model="notificationSettings.weatherAlert" />
                </el-form-item>
              </el-col>
              <el-col :span="8">
                <el-form-item label="优惠推送">
                  <el-switch v-model="notificationSettings.promotionPush" />
                </el-form-item>
              </el-col>
            </el-row>
          </el-form>
        </div>

        <div class="settings-section">
          <div class="section-header">
            <el-icon><Setting /></el-icon>
            <span>显示设置</span>
          </div>
          
          <el-form label-width="100px" class="settings-form">
            <el-row :gutter="24">
              <el-col :span="8">
                <el-form-item label="地图缩放">
                  <el-slider v-model="displaySettings.mapZoom" :min="10" :max="18" :step="1" />
                </el-form-item>
              </el-col>
              <el-col :span="8">
                <el-form-item label="显示模式">
                  <el-radio-group v-model="displaySettings.viewMode">
                    <el-radio-button label="card">卡片</el-radio-button>
                    <el-radio-button label="list">列表</el-radio-button>
                    <el-radio-button label="timeline">时间线</el-radio-button>
                  </el-radio-group>
                </el-form-item>
              </el-col>
              <el-col :span="8">
                <el-form-item label="自动保存">
                  <el-switch v-model="displaySettings.autoSave" />
                </el-form-item>
              </el-col>
            </el-row>
          </el-form>
        </div>

        <div class="settings-section">
          <div class="section-header">
            <el-icon><Document /></el-icon>
            <span>数据管理</span>
          </div>
          
          <div class="data-actions">
            <div class="data-action-item" @click="exportData">
              <el-icon class="action-icon"><Download /></el-icon>
              <div class="action-info">
                <h4>导出数据</h4>
                <p>导出您的所有行程和偏好设置</p>
              </div>
              <el-button type="primary" plain>导出</el-button>
            </div>
            
            <div class="data-action-item" @click="clearCache">
              <el-icon class="action-icon warning"><Delete /></el-icon>
              <div class="action-info">
                <h4>清除缓存</h4>
                <p>清除本地缓存数据，不会影响云端数据</p>
              </div>
              <el-button type="warning" plain>清除</el-button>
            </div>
          </div>
        </div>
      </div>

      <div class="settings-sidebar">
        <div class="sidebar-card sticky-card">
          <div class="sidebar-heade r">快速导航</div>
          <div class="sidebar-nav">
            <a href="#" @click.prevent="scrollToSection('crowd')">出行人群</a>
            <a href="#" @click.prevent="scrollToSection('budget')">预算设置</a>
            <a href="#" @click.prevent="scrollToSection('food')">饮食偏好</a>
            <a href="#" @click.prevent="scrollToSection('interest')">兴趣偏好</a>
          </div>
          <div class="sidebar-tip">
            <el-icon><InfoFilled /></el-icon>
            <span>设置越详细，AI规划的行程越贴合您的需求</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '../stores/user'
import { userAPI } from '../api'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeft, User, Bell, Setting, Document, Download, Delete, InfoFilled } from '@element-plus/icons-vue'

const router = useRouter()
const userStore = useUserStore()
const saving = ref(false)

const preferencesForm = reactive({
  crowd: '',
  budgetRange: [500, 1500],
  intensity: '',
  foodPreferences: [],
  customFoods: [],
  interests: [],
  customInterests: [],
  hotelArea: '五一广场',
  hotelLevel: 3,
  transportModes: ['地铁', '步行']
})

const notificationSettings = reactive({
  tripReminder: true,
  weatherAlert: true,
  promotionPush: false
})

const displaySettings = reactive({
  mapZoom: 14,
  viewMode: 'card',
  autoSave: true
})

const formatBudget = (val) => {
  return `¥${val}`
}

const goBack = () => {
  router.push('/profile')
}

const scrollToSection = (section) => {
  console.log('Scroll to:', section)
}

const loadPreferences = () => {
  if (userStore.preferences) {
    Object.assign(preferencesForm, {
      crowd: userStore.preferences.crowd || '',
      budgetRange: userStore.preferences.budgetRange || [500, 1500],
      intensity: userStore.preferences.intensity || '',
      foodPreferences: userStore.preferences.foodPreferences || [],
      customFoods: userStore.preferences.customFoods || [],
      interests: userStore.preferences.interests || [],
      customInterests: userStore.preferences.customInterests || [],
      hotelArea: userStore.preferences.hotelArea || '五一广场',
      hotelLevel: userStore.preferences.hotelLevel || 3,
      transportModes: userStore.preferences.transportModes || ['地铁', '步行']
    })
  }
  
  const savedNotifications = localStorage.getItem('notificationSettings')
  if (savedNotifications) {
    Object.assign(notificationSettings, JSON.parse(savedNotifications))
  }
  
  const savedDisplay = localStorage.getItem('displaySettings')
  if (savedDisplay) {
    Object.assign(displaySettings, JSON.parse(savedDisplay))
  }
}

const savePreferences = async () => {
  saving.value = true
  try {
    const res = await userAPI.updatePreferences(preferencesForm)
    if (res.code === 200) {
      userStore.updatePreferences(preferencesForm)
      ElMessage.success('偏好设置已保存')
    } else {
      ElMessage.error(res.message || '保存失败')
    }
  } catch (error) {
    ElMessage.error('保存失败')
  } finally {
    saving.value = false
  }
}

const resetPreferences = () => {
  preferencesForm.crowd = ''
  preferencesForm.budgetRange = [500, 1500]
  preferencesForm.intensity = ''
  preferencesForm.foodPreferences = []
  preferencesForm.customFoods = []
  preferencesForm.interests = []
  preferencesForm.customInterests = []
  preferencesForm.hotelArea = '五一广场'
  preferencesForm.hotelLevel = 3
  preferencesForm.transportModes = ['地铁', '步行']
  ElMessage.info('已重置为默认值')
}

const exportData = async () => {
  try {
    const data = {
      preferences: preferencesForm,
      notifications: notificationSettings,
      display: displaySettings,
      exportedAt: new Date().toISOString()
    }
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `长沙旅游设置_${new Date().toLocaleDateString()}.json`
    a.click()
    URL.revokeObjectURL(url)
    
    ElMessage.success('数据导出成功')
  } catch (error) {
    ElMessage.error('导出失败')
  }
}

const clearCache = () => {
  ElMessageBox.confirm('确定要清除本地缓存吗？', '提示', {
    type: 'warning'
  }).then(() => {
    localStorage.clear()
    sessionStorage.clear()
    ElMessage.success('缓存已清除，页面将刷新')
    setTimeout(() => {
      window.location.reload()
    }, 1000)
  }).catch(() => {})
}

onMounted(() => {
  loadPreferences()
})
</script>

<style scoped>
.settings-page {
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

.settings-container {
  display: flex;
  gap: 24px;
  max-width: 1200px;
  margin: 0 auto;
}

.settings-main {
  flex: 1;
  min-width: 0;
}

.settings-section {
  background: #fff;
  border-radius: 12px;
  margin-bottom: 20px;
  overflow: hidden;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px 24px;
  background: linear-gradient(135deg, #9dddd8ff 0%, #c2eae8 100%);
  color: #fff;
  font-weight: 600;
  font-size: 16px;
}

.settings-form {
  padding: 24px;
}

.budget-labels {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #909399;
  margin-top: 8px;
  max-width: 400px;
}

.data-actions {
  padding: 16px 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.data-action-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 20px;
  background: #fafafa;
  border-radius: 8px;
  transition: background 0.2s;
}

.data-action-item:hover {
  background: #f5f5f5;
}

.action-icon {
  font-size: 32px;
  color: #9dddd8ff;
}

.action-icon.warning {
  color: #e6a23c;
}

.action-info {
  flex: 1;
}

.action-info h4 {
  margin: 0 0 4px;
  font-size: 15px;
  color: #303133;
}

.action-info p {
  margin: 0;
  font-size: 13px;
  color: #909399;
}

.settings-sidebar {
  width: 260px;
  flex-shrink: 0;
}

.sticky-card {
  position: sticky;
  top: 24px;
  background: #fff;
  border-radius: 12px;
  overflow: hidden;
}

.sidebar-header {
  padding: 16px 20px;
  font-weight: 600;
  color: #303133;
  border-bottom: 1px solid #f0f0f0;
}

.sidebar-nav {
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.sidebar-nav a {
  color: #606266;
  text-decoration: none;
  font-size: 14px;
  padding: 10px 12px;
  border-radius: 6px;
  transition: all 0.2s;
}

.sidebar-nav a:hover {
  background: linear-gradient(135deg, rgba(157, 221, 216, 0.1) 0%, rgba(194, 234, 232, 0.1) 100%);
  color: #303133;
}

.sidebar-tip {
  margin: 12px 16px 16px;
  padding: 12px;
  background: linear-gradient(135deg, rgba(157, 221, 216, 0.1) 0%, rgba(194, 234, 232, 0.1) 100%);
  border-radius: 8px;
  font-size: 13px;
  color: #606266;
  display: flex;
  gap: 8px;
  align-items: flex-start;
}

.sidebar-tip .el-icon {
  color: #9dddd8ff;
  margin-top: 2px;
  flex-shrink: 0;
}

@media (max-width: 900px) {
  .settings-container {
    flex-direction: column;
  }
  
  .settings-sidebar {
    width: 100%;
    order: -1;
  }
  
  .sticky-card {
    position: relative;
    top: 0;
  }
}
</style>
