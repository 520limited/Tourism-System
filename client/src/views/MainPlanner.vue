<template>
  <div class="main-planner">
    <header class="top-bar">
      <div class="logo">长沙旅游智能规划系统</div>
      <div class="nav-actions">
        <el-button link @click="$router.push('/history')">历史行程</el-button>
        <el-button link @click="$router.push('/settings')">设置</el-button>
        <el-button link @click="$router.push('/help')">帮助</el-button>
        <el-avatar :size="32" style="background-color: #409eff; margin-left: 16px; cursor: pointer;" @click="handleProfileClick">
          {{ userStore.isLoggedIn ? userStore.userInfo?.nickname?.charAt(0) : '游' }}
        </el-avatar>
      </div>
    </header>

    <div class="content-container">
      <!-- 左侧面板 -->
      <aside class="left-panel" :style="{ width: leftWidth + 'px' }">
        <AIChat />
      </aside>

      <!-- 左侧拖拽条 -->
      <div class="resizer resizer-left" @mousedown="startResizeLeft"></div>

      <!-- 中间面板 -->
      <main class="center-panel" :style="{ flex: 1 }">
        <TripDetail />
      </main>

      <!-- 右侧拖拽条 -->
      <div class="resizer resizer-right" @mousedown="startResizeRight"></div>

      <!-- 右侧面板 -->
      <aside class="right-panel" :style="{ width: rightWidth + 'px' }">
        <AmapViewer />
      </aside>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '../stores/user'
import AIChat from '../components/AIChat.vue'
import TripDetail from '../components/TripDetail.vue'
import AmapViewer from '../components/AmapViewer.vue'

const router = useRouter()
const userStore = useUserStore()

// 面板宽度
const leftWidth = ref(360)
const rightWidth = ref(600)

// 最小和最大宽度限制
const MIN_WIDTH = 280
const MAX_WIDTH = 800

// 拖拽状态
let isResizingLeft = false
let isResizingRight = false
let startX = 0
let startLeftWidth = 0
let startRightWidth = 0

// 开始拖拽左侧
const startResizeLeft = (e) => {
  isResizingLeft = true
  startX = e.clientX
  startLeftWidth = leftWidth.value
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
}

// 开始拖拽右侧
const startResizeRight = (e) => {
  isResizingRight = true
  startX = e.clientX
  startRightWidth = rightWidth.value
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
}

// 处理拖拽
const handleMouseMove = (e) => {
  if (isResizingLeft) {
    const delta = e.clientX - startX
    const newWidth = startLeftWidth + delta
    leftWidth.value = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, newWidth))
  }
  
  if (isResizingRight) {
    const delta = startX - e.clientX
    const newWidth = startRightWidth + delta
    rightWidth.value = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, newWidth))
  }
}

// 停止拖拽
const handleMouseUp = () => {
  isResizingLeft = false
  isResizingRight = false
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
  
  // 保存宽度到本地存储
  localStorage.setItem('panel_left_width', leftWidth.value)
  localStorage.setItem('panel_right_width', rightWidth.value)
}

// 恢复默认宽度
const resetWidths = () => {
  leftWidth.value = 360
  rightWidth.value = 600
  localStorage.removeItem('panel_left_width')
  localStorage.removeItem('panel_right_width')
}

onMounted(() => {
  // 从本地存储恢复宽度
  const savedLeftWidth = localStorage.getItem('panel_left_width')
  const savedRightWidth = localStorage.getItem('panel_right_width')
  
  if (savedLeftWidth) {
    leftWidth.value = parseInt(savedLeftWidth)
  }
  if (savedRightWidth) {
    rightWidth.value = parseInt(savedRightWidth)
  }
  
  // 添加全局事件监听
  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)
})

onUnmounted(() => {
  document.removeEventListener('mousemove', handleMouseMove)
  document.removeEventListener('mouseup', handleMouseUp)
})

const handleProfileClick = () => {
  if (userStore.isLoggedIn) {
    router.push('/profile')
  } else {
    router.push('/login')
  }
}
</script>

<style scoped>
.main-planner {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: #f5f7fa;
}

.top-bar {
  height: 56px;
  background-color: #fff;
  border-bottom: 1px solid #e4e7ed;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  flex-shrink: 0;
}

.logo {
  font-size: 18px;
  font-weight: 600;
  color: #303133;
}

.nav-actions {
  display: flex;
  align-items: center;
}

.content-container {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.left-panel {
  background-color: #fff;
  border-right: 1px solid #e4e7ed;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  overflow: hidden;
}

.center-panel {
  background-color: #f5f7fa;
  overflow-y: auto;
  min-width: 400px;
}

.right-panel {
  background-color: #fff;
  border-left: 1px solid #e4e7ed;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  overflow: hidden;
}

/* 拖拽条样式 */
.resizer {
  width: 6px;
  background-color: transparent;
  cursor: col-resize;
  position: relative;
  flex-shrink: 0;
  transition: background-color 0.2s;
}

.resizer:hover,
.resizer:active {
  background-color: #409eff;
}

.resizer::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 2px;
  height: 24px;
  background-color: #c0c4cc;
  border-radius: 1px;
  opacity: 0;
  transition: opacity 0.2s;
}

.resizer:hover::after,
.resizer:active::after {
  opacity: 1;
  background-color: #fff;
}
</style>
