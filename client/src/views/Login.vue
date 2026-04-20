<template>
    - 注册功能: 邮箱验证码(60s倒计时) + 密码确认 → 创建账户 → 自动切换到登录Tab
    - 表单校验: 自定义validator实现邮箱格式、密码长度、确认密码一致性校验
    - 游客模式: 无需任何认证直接进入主页
  
  UI框架: Element Plus (el-tabs/el-form/el-input/el-button)
  
  状态管理: Pinia (useUserStore) 持久化用户信息
  
  API依赖: userAPI (sendCode/login/register)
-->
  <div class="login-page">
    <div class="login-container">
      <div class="left-section">
        <div class="left-content">
          <h1>长沙旅游智能规划系统</h1>
          <p class="subtitle">基于 AI 的个性化旅游行程规划</p>
          <div class="features">
            <div class="feature-item">AI 智能需求解析</div>
            <div class="feature-item">长沙本地景点推荐</div>
            <div class="feature-item">最优路径规划</div>
            <div class="feature-item">实时天气与交通</div>
          </div>
        </div>
      </div>
      
      <div class="right-section">
        <div class="form-container">
          <el-tabs v-model="activeTab" class="login-tabs">
            <el-tab-pane label="登录" name="login">
              <el-form :model="loginForm" :rules="loginRules" ref="loginFormRef" label-width="0" size="large">
                <el-form-item prop="email">
                  <el-input v-model="loginForm.email" placeholder="请输入邮箱" prefix-icon="Message" />
                </el-form-item>
                <el-form-item prop="password">
                  <el-input v-model="loginForm.password" type="password" placeholder="请输入密码" prefix-icon="Lock" show-password @keyup.enter="handleLogin" />
                </el-form-item>
                <el-form-item>
                  <el-button type="primary" style="width: 100%" :loading="loading" @click="handleLogin">登录</el-button>
                </el-form-item>
              </el-form>
            </el-tab-pane>
            
            <el-tab-pane label="注册" name="register">
              <el-form :model="registerForm" :rules="registerRules" ref="registerFormRef" label-width="0" size="large">
                <el-form-item prop="email">
                  <el-input v-model="registerForm.email" placeholder="请输入邮箱" prefix-icon="Message">
                    <template #append>
                      <el-button :disabled="countdown > 0" :loading="sendingCode" @click="sendCode">
                        {{ countdown > 0 ? `${countdown}s` : '获取验证码' }}
                      </el-button>
                    </template>
                  </el-input>
                </el-form-item>
                <el-form-item prop="code">
                  <el-input v-model="registerForm.code" placeholder="请输入邮箱验证码" prefix-icon="Key" />
                </el-form-item>
                <el-form-item prop="nickname">
                  <el-input v-model="registerForm.nickname" placeholder="请输入昵称（选填）" prefix-icon="User" />
                </el-form-item>
                <el-form-item prop="password">
                  <el-input v-model="registerForm.password" type="password" placeholder="请设置密码（至少6位）" prefix-icon="Lock" show-password />
                </el-form-item>
                <el-form-item prop="confirmPassword">
                  <el-input v-model="registerForm.confirmPassword" type="password" placeholder="请确认密码" prefix-icon="Lock" show-password />
                </el-form-item>
                <el-form-item>
                  <el-button type="primary" style="width: 100%" :loading="loading" @click="handleRegister">注册</el-button>
                </el-form-item>
              </el-form>
            </el-tab-pane>
          </el-tabs>
          
          <div class="divider">
            <span>或</span>
          </div>
          
          <el-button class="guest-button" @click="enterAsGuest">暂不登录，直接体验</el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
/**
 * @fileoverview 用户登录/注册页面组件
 * 
 * @component Login
 * @description 本组件是系统的身份认证入口,提供邮箱+密码登录和邮箱验证码注册两种方式。
 *              采用左右分栏布局:左侧展示系统特色介绍,右侧为交互式表单区域。
 *              支持游客免登录体验模式。
 * 
 * 核心功能:
 *   - 登录功能: 邮箱+密码校验 → 获取sessionId → 存储到localStorage/Pinia → 跳转目标页
 *   - 注册功能: 邮箱验证码(60s倒计时) + 密码确认 → 创建账户 → 自动切换到登录Tab
 *   - 表单校验: 自定义validator实现邮箱格式、密码长度、确认密码一致性校验
 *   - 游客模式: 无需任何认证直接进入主页
 * 
 * UI框架: Element Plus (el-tabs/el-form/el-input/el-button)
 * 状态管理: Pinia (useUserStore) 持久化用户信息
 * API依赖: userAPI (sendCode/login/register)
 */
import { ref, reactive } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useUserStore } from '../stores/user'
import { ElMessage } from 'element-plus'
import { userAPI } from '../api'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()

const activeTab = ref('login')
const loading = ref(false)
const sendingCode = ref(false)
const countdown = ref(0)
const loginFormRef = ref(null)
const registerFormRef = ref(null)

const validateEmail = (rule, value, callback) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!value) {
    callback(new Error('请输入邮箱'))
  } else if (!emailRegex.test(value)) {
    callback(new Error('请输入正确的邮箱格式'))
  } else {
    callback()
  }
}

const validatePassword = (rule, value, callback) => {
  if (!value) {
    callback(new Error('请输入密码'))
  } else if (value.length < 6) {
    callback(new Error('密码长度至少6位'))
  } else {
    callback()
  }
}

const validateConfirmPassword = (rule, value, callback) => {
  if (!value) {
    callback(new Error('请确认密码'))
  } else if (value !== registerForm.password) {
    callback(new Error('两次输入的密码不一致'))
  } else {
    callback()
  }
}

const loginRules = {
  email: [{ validator: validateEmail, trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
}

const registerRules = {
  email: [{ validator: validateEmail, trigger: 'blur' }],
  code: [{ required: true, message: '请输入验证码', trigger: 'blur' }],
  password: [{ validator: validatePassword, trigger: 'blur' }],
  confirmPassword: [{ validator: validateConfirmPassword, trigger: 'blur' }]
}

const loginForm = reactive({
  email: '',
  password: ''
})

const registerForm = reactive({
  email: '',
  code: '',
  nickname: '',
  password: '',
  confirmPassword: ''
})

/**
 * sendCode — 发送邮箱验证码(注册用)
 * 
 * 流程: 校验邮箱格式 → 调用API → 成功后启动60秒倒计时
 * 防重复: 倒计时期间禁用按钮
 */
  if (!registerForm.email) {
    ElMessage.warning('请先输入邮箱')
    return
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(registerForm.email)) {
    ElMessage.warning('请输入正确的邮箱格式')
    return
  }
  
  sendingCode.value = true
  try {
    const res = await userAPI.sendCode(registerForm.email)
    if (res.code === 200) {
      ElMessage.success('验证码已发送，请查收邮件')
      countdown.value = 60
      const timer = setInterval(() => {
        countdown.value--
        if (countdown.value <= 0) {
          clearInterval(timer)
        }
      }, 1000)
    } else {
      ElMessage.error(res.message || '发送失败')
    }
  } catch (error) {
    console.error('发送验证码失败:', error)
    ElMessage.error(error.response?.data?.message || '发送验证码失败')
  } finally {
    sendingCode.value = false
  }
}

/**
 * handleLogin — 用户登录处理
 * 
 * 完整流程: 表单校验 → 调用login API → 存储sessionId到localStorage
 *           → 更新Pinia用户状态 → 跳转(优先回到原页面或首页)
 */
  if (!loginFormRef.value) return
  
  await loginFormRef.value.validate(async (valid) => {
    if (!valid) return
    
    loading.value = true
    try {
      const res = await userAPI.login(loginForm.email, loginForm.password)
      
      if (res.code === 200) {
        localStorage.setItem('sessionId', res.data.sessionId)
        userStore.setUser(res.data.user)
        ElMessage.success('登录成功')
        // 登录后跳回原页面（如果有 redirect 参数）
        const redirect = route.query.redirect || '/'
        router.push(redirect)
      } else {
        ElMessage.error(res.message || '登录失败')
      }
    } catch (error) {
      console.error('登录失败:', error)
      ElMessage.error(error.response?.data?.message || '登录失败，请重试')
    } finally {
      loading.value = false
    }
  })
}

/**
 * handleRegister — 用户注册处理
 * 
 * 流程: 表单校验(含验证码+密码一致性) → 调用register API
 *       成功后自动切换到登录Tab并预填邮箱
 */
  if (!registerFormRef.value) return
  
  await registerFormRef.value.validate(async (valid) => {
    if (!valid) return
    
    loading.value = true
    try {
      const res = await userAPI.register({
        email: registerForm.email,
        code: registerForm.code,
        password: registerForm.password,
        nickname: registerForm.nickname
      })
      
      if (res.code === 200) {
        ElMessage.success('注册成功，请登录')
        activeTab.value = 'login'
        loginForm.email = registerForm.email
        registerForm.email = ''
        registerForm.code = ''
        registerForm.nickname = ''
        registerForm.password = ''
        registerForm.confirmPassword = ''
      } else {
        ElMessage.error(res.message || '注册失败')
      }
    } catch (error) {
      console.error('注册失败:', error)
      ElMessage.error(error.response?.data?.message || '注册失败，请重试')
    } finally {
      loading.value = false
    }
  })
}

const enterAsGuest = () => {
  router.push('/')
}
</script>

<style scoped>
.login-page {
  width: 100%;
  height: 100%;
  background: url(../assets/hnu1.jpg) center center / cover no-repeat;
  display: flex;
  align-items: center;
  justify-content: center;
}

.login-container {
  width: 900px;
  height: 600px;
  background-color: rgba(255, 255, 255, 0.6);
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  display: flex;
  overflow: hidden;
  backdrop-filter: blur(5px);
}

.left-section {
  flex: 1;
  background: linear-gradient(135deg, rgba(64, 158, 255, 0.4) 0%, rgba(102, 177, 255, 0.4) 100%);
  backdrop-filter: blur(10px);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
}

.left-content {
  padding: 40px;
}

.left-content h1 {
  font-size: 28px;
  margin-bottom: 16px;
  font-weight: 600;
}

.subtitle {
  font-size: 16px;
  opacity: 0.9;
  margin-bottom: 40px;
}

.features {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.feature-item {
  font-size: 14px;
  padding: 12px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
}

.right-section {
  width: 400px;
  padding: 40px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.form-container {
  width: 100%;
}

.login-tabs :deep(.el-tabs__header) {
  margin-bottom: 32px;
}

.divider {
  text-align: center;
  margin: 24px 0;
  color: #909399;
  font-size: 14px;
  position: relative;
}

.divider::before,
.divider::after {
  content: '';
  position: absolute;
  top: 50%;
  width: 30%;
  height: 1px;
  background-color: #e4e7ed;
}

.divider::before {
  left: 0;
}

.divider::after {
  right: 0;
}

.guest-button {
  width: 100%;
}
</style>
