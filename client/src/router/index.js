/**
 * @fileoverview 前端路由配置模块 - Vue Router路由定义与全局导航守卫
 * 
 * @module router
 * @description 本模块定义了整个前端应用的路由结构,包括页面路径、组件映射、元数据配置,
 *              以及基于登录状态的全局前置守卫,实现页面访问控制。
 * 
 * 路由结构:
 *   /                → MainPlanner.vue     主页(行程规划核心界面,公开)
 *   /login           → Login.vue          登录/注册页(公开)
 *   /profile         → Profile.vue        个人中心(需登录)
 *   /history         → HistoryTrips.vue   历史行程(需登录)
 *   /trip/:id        → TripDetail.vue     行程详情(公开)
 *   /settings        → Settings.vue       系统设置(需登录)
 *   /favorites       → Favorites.vue      我的收藏(需登录)
 *   /help            → Help.vue           帮助说明(公开)
 *   /:pathMatch(.*)* → NotFound.vue       404页面
 * 
 * 权限控制: 通过 beforeEach 守卫检查 localStorage 中的 sessionId,
 *           未登录用户访问需认证页面时重定向到 /login 并携带 redirect 参数
 * 
 * @requires vue-router Vue.js官方路由库
 */
import { createRouter, createWebHistory } from 'vue-router'

// 公开页面（无需登录）
const publicPages = ['/', '/login', '/help']

const routes = [
  {
    path: '/',
    name: 'Home',
    component: () => import('../views/MainPlanner.vue'),
    meta: { title: '长沙旅游智能规划系统' }
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/Login.vue'),
    meta: { title: '登录' }
  },
  {
    path: '/profile',
    name: 'Profile',
    component: () => import('../views/Profile.vue'),
    meta: { title: '个人中心', requiresAuth: true }
  },
  {
    path: '/history',
    name: 'History',
    component: () => import('../views/HistoryTrips.vue'),
    meta: { title: '历史行程', requiresAuth: true }
  },
  {
    path: '/trip/:id',
    name: 'TripDetail',
    component: () => import('../views/TripDetail.vue'),
    meta: { title: '行程详情' }
  },
  {
    path: '/settings',
    name: 'Settings',
    component: () => import('../views/Settings.vue'),
    meta: { title: '系统设置', requiresAuth: true }
  },
  {
    path: '/favorites',
    name: 'Favorites',
    component: () => import('../views/Favorites.vue'),
    meta: { title: '我的收藏', requiresAuth: true }
  },
  {
    path: '/help',
    name: 'Help',
    component: () => import('../views/Help.vue'),
    meta: { title: '帮助说明' }
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('../views/NotFound.vue'),
    meta: { title: '404' }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

/**
 * 全局前置守卫：
 *   - 公开页面(/ /login /help)直接放行
 *   - 需要登录的页面(/profile /history /settings /favorites)检查session
 *   - 未登录则重定向到/login，并携带目标路径以便登录后跳回
 */
router.beforeEach((to, from, next) => {
  // 设置页面标题
  document.title = to.meta.title || '长沙旅游智能规划系统'

  // 公开页面不需要登录
  if (publicPages.includes(to.path)) {
    return next()
  }

  // 需要认证的页面：检查本地登录状态
  if (to.meta.requiresAuth) {
    const isLoggedIn = !!localStorage.getItem('sessionId')
    if (!isLoggedIn) {
      return next({
        path: '/login',
        query: { redirect: to.fullPath }  // 登录后可跳回原页面
      })
    }
  }

  next()
})

export default router
