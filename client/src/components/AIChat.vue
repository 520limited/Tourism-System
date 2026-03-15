<template>
  <div class="ai-chat">
    <div class="chat-header">
      <div class="header-left">
        <div class="assistant-avatar">沙</div>
        <div class="assistant-info">
          <span class="assistant-name">小沙</span>
          <span class="assistant-status">长沙旅游智能助手</span>
        </div>
      </div>
      <el-button text size="small" @click="resetChat" class="reset-btn">
        <el-icon><RefreshRight /></el-icon>
        新对话
      </el-button>
    </div>

    <div class="chat-messages" ref="messagesRef">
      <div v-if="messages.length > 0" class="tip-banner">
        <el-icon><InfoFilled /></el-icon>
        <span>请在重新发送需求后发送"重新规划"以确认重新生成</span>
      </div>
      
      <div v-if="messages.length === 0" class="welcome-section">
        <h2>您好！我是小沙</h2>
        <p>长沙旅游智能助手，告诉我您的出行计划，我来帮您规划完美行程！</p>
        
        <div class="quick-form">
          <div class="form-section">
            <div class="form-title">快速选择出行天数</div>
            <div class="option-buttons">
              <el-button 
                v-for="day in [1, 2, 3, 4, 5] " 
                :key="day"
                :type="quickForm.days === day ? 'primary' : 'default'"
                size="small"
                round
                @click="quickForm.days = day"
              >
                {{ day }}天
              </el-button>
            </div>
          </div>
          
          <div class="form-section">
            <div class="form-title">出行人群</div>
            <el-select v-model="quickForm.crowd" placeholder="请选择" size="small" style="width: 100%">
              <el-option label="情侣出游" value="情侣" />
              <el-option label="亲子游" value="亲子" />
              <el-option label="朋友结伴" value="朋友" />
              <el-option label="家庭出游" value="家庭" />
              <el-option label="独自旅行" value="独自旅行" />
              <el-option label="带老人" value="老人" />
            </el-select>
          </div>
          
          <div class="form-section">
            <div class="form-title">预算范围</div>
            <el-radio-group v-model="quickForm.budget" size="small">
              <el-radio-button label="0-500">经济型</el-radio-button>
              <el-radio-button label="500-1000">实惠型</el-radio-button>
              <el-radio-button label="1000-2000">舒适型</el-radio-button>
              <el-radio-button label="2000+">豪华型</el-radio-button>
            </el-radio-group>
          </div>
          
          <div class="form-section">
            <div class="form-title">兴趣偏好（可多选）</div>
            <el-checkbox-group v-model="quickForm.interests" size="small">
              <el-checkbox-button label="美食">美食</el-checkbox-button>
              <el-checkbox-button label="自然风光">自然风光</el-checkbox-button>
              <el-checkbox-button label="历史文化">历史文化</el-checkbox-button>
              <el-checkbox-button label="购物">购物</el-checkbox-button>
              <el-checkbox-button label="夜生活">夜生活</el-checkbox-button>
              <el-checkbox-button label="主题乐园">主题乐园</el-checkbox-button>
            </el-checkbox-group>
          </div>
          
          <el-button type="primary" @click="submitQuickForm" :disabled="!isQuickFormValid" style="width: 100%">
            开始规划行程
          </el-button>
        </div>
      </div>
      
      <div v-for="(msg, idx) in messages" :key="idx" class="message-wrapper" :class="msg.role">
        <div class="message-avatar">
          <div v-if="msg.role === 'assistant'" class="avatar bot">沙</div>
          <div v-else class="avatar user">我</div>
        </div>
        <div class="message-body">
          <div class="message-role">{{ msg.role === 'assistant' ? '小沙' : '您' }}</div>
          <div class="message-content" v-html="formatMessage(msg.content)"></div>
        </div>
      </div>
      
      <div v-if="isTyping" class="message-wrapper assistant">
        <div class="message-avatar">
          <div class="avatar bot">沙</div>
        </div>
        <div class="message-body">
          <div class="message-role">小沙</div>
          <div class="typing-indicator">
            <span></span><span></span><span></span>
          </div>
          <div class="processing-status">
            <div class="status-step" :class="{ active: currentStep >= 1 }">
              <el-icon><Upload /></el-icon>
              <span>提交中</span>
            </div>
            <div class="status-arrow">→</div>
            <div class="status-step" :class="{ active: currentStep >= 2 }">
              <el-icon><Edit /></el-icon>
              <span>理解需求</span>
            </div>
            <div class="status-arrow">→</div>
            <div class="status-step" :class="{ active: currentStep >= 3 }">
              <el-icon><MapLocation /></el-icon>
              <span>规划行程</span>
            </div>
            <div class="status-arrow">→</div>
            <div class="status-step" :class="{ active: currentStep >= 4 }">
              <el-icon><Location /></el-icon>
              <span>验证坐标</span>
            </div>
          </div>
          <div class="status-text">{{ currentStatusText }}</div>
        </div>
      </div>
    </div>

    <div class="chat-input-area">
      <div class="input-container">
        <el-input
          v-model="inputValue"
          type="textarea"
          :rows="1"
          :autosize="{ minRows: 1, maxRows: 4 }"
          placeholder="输入您的出行需求，按 Enter 发送..."
          @keydown.enter.exact.prevent="sendMessage"
          :disabled="isTyping"
          class="chat-input"
        />
        <el-button 
          type="primary" 
          :icon="isTyping ? '' : 'Position'" 
          :loading="isTyping" 
          @click="sendMessage"
          circle
          class="send-btn"
          :disabled="!inputValue.trim() || isTyping"
        >
          <el-icon v-if="!isTyping"><Position /></el-icon>
        </el-button>
      </div>
      <div class="input-hint">
        <span>小沙可以帮您规划行程、推荐景点、解答旅游问题</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, nextTick, onMounted } from 'vue'
import { useTripStore } from '../stores/trip'
import { useMapStore } from '../stores/map'
import { chatAPI, planAPI } from '../api'
import { RefreshRight, Position, Upload, Edit, MapLocation, Location, InfoFilled } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

const tripStore = useTripStore()
const mapStore = useMapStore()

const inputValue = ref('')
const messagesRef = ref(null)
const isTyping = ref(false)
const sessionId = ref(null)
const currentStep = ref(1)
const currentStatusText = ref('正在提交您的需求...')
const lastSentMessage = ref('')
const lastSentTime = ref(0)

const messages = ref([])

// 状态文本映射
const statusTexts = {
  1: '正在提交您的需求...',
  2: 'AI正在理解您的旅行需求...',
  3: 'AI正在为您规划长沙行程...',
  4: '正在用高德地图验证地点坐标...'
}

// 更新状态步骤
const updateProcessingStep = (step) => {
  currentStep.value = step
  currentStatusText.value = statusTexts[step]
}

const quickForm = ref({
  days: null,
  crowd: '',
  budget: '',
  interests: []
})

const isQuickFormValid = computed(() => {
  return quickForm.value.days && quickForm.value.crowd && quickForm.value.budget
})

const scrollToBottom = () => {
  nextTick(() => {
    if (messagesRef.value) {
      messagesRef.value.scrollTop = messagesRef.value.scrollHeight
    }
  })
}

const formatMessage = (content) => {
  if (!content) return ''
  return content
    .replace(/【需求收集完成】/g, '<span class="highlight-tag">需求收集完成</span>')
    .replace(/\n/g, '<br>')
}

const submitQuickForm = async () => {
  if (!isQuickFormValid.value || isTyping.value) return
  
  const formMessage = `我想去长沙玩${quickForm.value.days}天，${quickForm.value.crowd}出行，预算${quickForm.value.budget}元` + 
    (quickForm.value.interests.length > 0 ? `，喜欢${quickForm.value.interests.join('、')}` : '')
  
  const now = Date.now()
  if (formMessage === lastSentMessage.value && now - lastSentTime.value < 3000) {
    console.log('submitQuickForm: 检测到重复消息，已忽略')
    return
  }
  
  lastSentMessage.value = formMessage
  lastSentTime.value = now
  
  messages.value.push({
    role: 'user',
    content: formMessage
  })
  
  tripStore.addConversationMessage('user', formMessage)
  
  scrollToBottom()
  isTyping.value = true
  currentStep.value = 1
  currentStatusText.value = statusTexts[1]
  
  setTimeout(() => updateProcessingStep(2), 1000)
  setTimeout(() => updateProcessingStep(3), 3000)
  setTimeout(() => updateProcessingStep(4), 8000)
  
  try {
    const res = await chatAPI.sendMessage({
      message: formMessage,
      conversationId: sessionId.value,
      formData: {
        days: quickForm.value.days,
        crowd: quickForm.value.crowd,
        budget: quickForm.value.budget,
        interests: quickForm.value.interests
      }
    }, sessionId.value)
    
    isTyping.value = false
    
    if (res.code === 200 && res.data) {
      sessionId.value = res.data.sessionId
      
      localStorage.setItem('sessionId', res.data.sessionId)
      
      messages.value.push({
        role: 'assistant',
        content: res.data.message,
        ready: res.data.ready,
        formOptions: res.data.formOptions
      })
      
      tripStore.addConversationMessage('assistant', res.data.message, {
        ready: res.data.ready,
        formOptions: res.data.formOptions
      })
      
      if (res.data.requirements) {
        tripStore.updateTripParams(res.data.requirements)
      }
      
      if (res.data.ready && res.data.itinerary) {
        tripStore.setItinerary(res.data.itinerary)
        tripStore.setTripId(res.data.tripId)
        localStorage.setItem('currentTripId', res.data.tripId)
        
        if (res.data.integratedData) {
          tripStore.setIntegratedData(res.data.integratedData)
        }
      } else if (res.data.adjustmentType) {
        // 收到调整建议，自动重新生成行程
        ElMessage.info('正在根据您的需求调整行程...')
        setTimeout(async () => {
          try {
            const adjustRes = await planAPI.generateItinerary('根据最新需求调整行程', sessionId.value, tripStore.tripId)
            if (adjustRes.code === 200 && adjustRes.data && adjustRes.data.ready && adjustRes.data.itinerary && adjustRes.data.itinerary.length > 0) {
              tripStore.setItinerary(adjustRes.data.itinerary)
              tripStore.setTripId(adjustRes.data.tripId)
              localStorage.setItem('currentTripId', adjustRes.data.tripId)
              ElMessage.success('行程已根据您的需求调整')
            }
          } catch (error) {
            console.error('调整行程失败:', error)
            ElMessage.error('调整行程失败，请重试')
          }
        }, 1000)
      }
      
      scrollToBottom()
    }
  } catch (error) {
    isTyping.value = false
    ElMessage.error('发送失败，请重试')
    console.error('发送消息失败:', error)
  }
}

const sendMessageWithValue = async (text) => {
  const now = Date.now()
  if (text === lastSentMessage.value && now - lastSentTime.value < 3000) {
    console.log('sendMessageWithValue: 检测到重复消息，已忽略')
    return
  }
  
  lastSentMessage.value = text
  lastSentTime.value = now
  
  messages.value.push({
    role: 'user',
    content: text
  })
  
  tripStore.addConversationMessage('user', text)
  
  scrollToBottom()
  isTyping.value = true
  currentStep.value = 1
  currentStatusText.value = statusTexts[1]
  
  try {
    const isNaturalLanguagePlan = text.includes('玩') && (text.includes('天') || text.includes('行程') || text.includes('旅游'))
    
    setTimeout(() => updateProcessingStep(2), 1000)
    setTimeout(() => updateProcessingStep(3), 3000)
    setTimeout(() => updateProcessingStep(4), 8000)
    
    let res
    if (isNaturalLanguagePlan) {
      res = await planAPI.generateItinerary(text, sessionId.value, tripStore.tripId)
    } else {
      res = await chatAPI.sendMessage({
        message: text,
        conversationId: sessionId.value
      }, sessionId.value)
    }
    
    isTyping.value = false
    
    if (res.code === 200 && res.data) {
        sessionId.value = res.data.sessionId
        
        localStorage.setItem('sessionId', res.data.sessionId)
        
        messages.value.push({
          role: 'assistant',
          content: res.data.message,
          ready: res.data.ready,
          formOptions: res.data.formOptions
        })
        
        tripStore.addConversationMessage('assistant', res.data.message, {
          ready: res.data.ready,
          formOptions: res.data.formOptions
        })
        
        if (res.data.requirements) {
          tripStore.updateTripParams(res.data.requirements)
        }
        
        if (res.data.ready && res.data.itinerary && res.data.itinerary.length > 0) {
          tripStore.setItinerary(res.data.itinerary)
          tripStore.setTripId(res.data.tripId)
          
          if (res.data.integratedData) {
            tripStore.setIntegratedData(res.data.integratedData)
          }
        } else if (res.data.ready && (!res.data.itinerary || res.data.itinerary.length === 0)) {
          // 行程为空，给出提示
          ElMessage.warning('行程生成失败，请提供更多详细的旅游需求信息')
        } else if (res.data.adjustmentType) {
          // 收到调整建议，自动重新生成行程
          ElMessage.info('正在根据您的需求调整行程...')
          setTimeout(async () => {
            try {
              const adjustRes = await planAPI.generateItinerary('根据最新需求调整行程', sessionId.value, tripStore.tripId)
              if (adjustRes.code === 200 && adjustRes.data && adjustRes.data.ready && adjustRes.data.itinerary && adjustRes.data.itinerary.length > 0) {
                tripStore.setItinerary(adjustRes.data.itinerary)
                tripStore.setTripId(adjustRes.data.tripId)
                ElMessage.success('行程已根据您的需求调整')
              }
            } catch (error) {
              console.error('调整行程失败:', error)
              ElMessage.error('调整行程失败，请重试')
            }
          }, 1000)
        }
        
        scrollToBottom()
      }
  } catch (error) {
    isTyping.value = false
    ElMessage.error('发送失败，请重试')
    console.error('发送消息失败:', error)
  }
}

const sendMessage = async () => {
  if (!inputValue.value.trim() || isTyping.value) return
  
  const userMessage = inputValue.value.trim()
  inputValue.value = ''
  
  await sendMessageWithValue(userMessage)
}

const resetChat = () => {
  messages.value = []
  tripStore.resetTrip()
  mapStore.resetMap()
  sessionId.value = null
  localStorage.removeItem('sessionId')
  localStorage.removeItem('currentTripId')
  quickForm.value = {
    days: null,
    crowd: '',
    budget: '',
    interests: []
  }
}

const loadSavedTrip = async () => {
  // 优先从 URL 参数加载行程
  const urlParams = new URLSearchParams(window.location.search)
  const urlTripId = urlParams.get('tripId')
  
  let tripIdToLoad = urlTripId || localStorage.getItem('currentTripId')
  
  if (!tripIdToLoad) return
  
  try {
    const res = await fetch(`/api/trips/${tripIdToLoad}`).then(r => r.json())
    
    if (res.code === 200 && res.data) {
      tripStore.loadTripData(res.data)
      tripStore.setTripId(tripIdToLoad)
      localStorage.setItem('currentTripId', tripIdToLoad)
      
      if (res.data.conversationHistory && res.data.conversationHistory.length > 0) {
        messages.value = res.data.conversationHistory.map(msg => ({
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp,
          ready: msg.ready,
          formOptions: msg.formOptions
        }))
      }
      
      scrollToBottom()
    } else if (res.code === 404) {
      localStorage.removeItem('currentTripId')
      tripStore.setTripId(null)
    }
  } catch (error) {
    console.error('加载已保存行程失败:', error)
    localStorage.removeItem('currentTripId')
  }
}

onMounted(() => {
  scrollToBottom()
  loadSavedTrip()
})
</script>

<style scoped>
.ai-chat {
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: #fff;
}

.chat-header {
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  border-bottom: 1px solid #e5e7eb;
  background: #fff;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.assistant-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: linear-gradient(135deg, #9dddd8ff 0%, #c2eae8 100%);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 16px;
}

.assistant-info {
  display: flex;
  flex-direction: column;
}

.assistant-name {
  font-size: 15px;
  font-weight: 600;
  color: #111827;
}

.assistant-status {
  font-size: 12px;
  color: #6b7280;
}

.reset-btn {
  color: #6b7280;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 20px 16px;
}

.tip-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: rgba(102, 126, 234, 0.1);
  border-radius: 8px;
  margin-bottom: 16px;
  font-size: 13px;
  color: #667eea;
  border: 1px solid rgba(102, 126, 234, 0.2);
}

.tip-banner .el-icon {
  font-size: 16px;
}

.welcome-section {
  text-align: center;
  padding: 20px 0;
}

.welcome-section h2 {
  font-size: 22px;
  font-weight: 600;
  color: #111827;
  margin: 0 0 8px;
}

.welcome-section p {
  color: #6b7280;
  font-size: 14px;
  margin: 0 0 24px;
}

.quick-form {
  max-width: 400px;
  margin: 0 auto;
  text-align: left;
}

.form-section {
  margin-bottom: 16px;
}

.form-title {
  font-size: 13px;
  color: #374151;
  margin-bottom: 8px;
  font-weight: 500;
}

.option-buttons {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.message-wrapper {
  display: flex;
  gap: 12px;
  margin-bottom: 24px;
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.message-wrapper.user {
  flex-direction: row-reverse;
}

.message-avatar .avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 600;
  flex-shrink: 0;
}

.avatar.bot {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
}

.avatar.user {
  background: #10b981;
  color: #fff;
}

.message-body {
  max-width: 80%;
}

.message-wrapper.user .message-body {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.message-role {
  font-size: 12px;
  color: #9ca3af;
  margin-bottom: 4px;
}

.message-content {
  padding: 12px 16px;
  border-radius: 12px;
  font-size: 14px;
  line-height: 1.6;
  color: #1f2937;
  background: #f3f4f6;
}

.message-wrapper.user .message-content {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
}

.message-content :deep(.highlight-tag) {
  display: inline-block;
  background: rgba(16, 185, 129, 0.1);
  color: #059669;
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: 500;
}

.typing-indicator {
  display: flex;
  gap: 4px;
  padding: 12px 16px;
  background: #f3f4f6;
  border-radius: 12px;
}

.typing-indicator span {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #9ca3af;
  animation: typing 1.4s infinite;
}

.typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
.typing-indicator span:nth-child(3) { animation-delay: 0.4s; }

@keyframes typing {
  0%, 60%, 100% { transform: translateY(0); }
  30% { transform: translateY(-6px); }
}

@keyframes pulse {
  0% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.1); opacity: 0.8; }
  100% { transform: scale(1); opacity: 1; }
}

.chat-input-area {
  padding: 12px 16px 16px;
  border-top: 1px solid #e5e7eb;
  background: #fff;
}

.input-container {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 8px 12px;
  transition: border-color 0.2s;
}

.input-container:focus-within {
  border-color: #667eea;
}

.chat-input {
  flex: 1;
}

.chat-input :deep(.el-textarea__inner) {
  background: transparent;
  border: none;
  box-shadow: none;
  padding: 4px 0;
  resize: none;
  font-size: 14px;
  line-height: 1.5;
}

.chat-input :deep(.el-textarea__inner):focus {
  box-shadow: none;
}

.send-btn {
  flex-shrink: 0;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
}

.send-btn:hover:not(:disabled) {
  opacity: 0.9;
}

.send-btn:disabled {
  background: #e5e7eb;
  cursor: not-allowed;
}

.input-hint {
  text-align: center;
  margin-top: 8px;
  font-size: 12px;
  color: #9ca3af;
}

/* 分段式状态提示样式 */
.processing-status {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  padding: 12px;
  background: #f8fafb;
  border-radius: 8px;
  font-size: 12px;
}

.status-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  color: #9ca3af;
  transition: all 0.3s ease;
}

.status-step.active {
  color: #667eea;
  font-weight: 500;
}

.status-step .el-icon {
  font-size: 16px;
}

.status-step span {
  font-size: 11px;
  white-space: nowrap;
}

.status-arrow {
  color: #d1d5db;
  font-size: 12px;
}

.status-text {
  margin-top: 8px;
  font-size: 13px;
  color: #667eea;
  font-weight: 500;
}
</style>
