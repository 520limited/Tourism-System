<template>
  <div class="help-page">
    <div class="back-nav">
      <el-button class="back-btn" @click="goBack" circle size="small">
        <el-icon><ArrowLeft /></el-icon>
      </el-button>
      <span class="nav-title">帮助说明</span>
    </div>

    <div class="help-content">
      <el-card class="help-card">
        <template #header>
          <div class="card-header">
            <el-icon><QuestionFilled /></el-icon>
            <span>快速入门</span>
          </div>
        </template>
        
        <div class="help-section">
          <h3>欢迎使用长沙旅游智能规划系统</h3>
          <p>本系统基于AI技术，为您提供个性化的长沙旅游行程规划服务。以下是快速入门指南：</p>
          
          <el-steps :active="4" direction="vertical" class="guide-steps">
            <el-step title="输入需求">
              <template #description>
                <p>在左侧对话框中，输入您的出行需求，例如：</p>
                <ul>
                  <li>"我想去长沙玩3天，情侣出行，预算1000元"</li>
                  <li>"带父母长沙2日游，喜欢历史文化"</li>
                  <li>"长沙美食之旅，2天，预算500元"</li>
                </ul>
              </template>
            </el-step>
            
            <el-step title="AI规划">
              <template #description>
                <p>AI助手"小沙"会根据您的需求，智能规划行程，包括：</p>
                <ul>
                  <li>景点推荐与时间安排</li>
                  <li>美食餐厅推荐</li>
                  <li>住宿酒店推荐</li>
                  <li>交通路线规划</li>
                </ul>
              </template>
            </el-step>
            
            <el-step title="查看行程">
              <template #description>
                <p>在中间区域查看详细行程，您可以：</p>
                <ul>
                  <li>切换不同天数查看</li>
                  <li>点击景点在地图上定位</li>
                  <li>查看费用明细</li>
                  <li>点击"换一批"更换推荐</li>
                </ul>
              </template>
            </el-step>
            
            <el-step title="保存分享">
              <template #description>
                <p>满意后可以：</p>
                <ul>
                  <li>保存行程到历史记录</li>
                  <li>导出为JSON或HTML格式</li>
                  <li>生成分享链接给朋友</li>
                </ul>
              </template>
            </el-step>
          </el-steps>
        </div>
      </el-card>

      <el-card class="help-card">
        <template #header>
          <div class="card-header">
            <el-icon><Compass /></el-icon>
            <span>功能说明</span>
          </div>
        </template>
        
        <el-collapse v-model="activeCollapse">
          <el-collapse-item title="地图功能" name="map">
            <div class="feature-desc">
              <p>右侧地图区域支持以下功能：</p>
              <ul>
                <li><strong>景点定位</strong>：点击景点卡片，地图自动定位到该景点</li>
                <li><strong>路线规划</strong>：查看景点之间的步行/公交/驾车路线</li>
                <li><strong>周边搜索</strong>：查看景点周边的餐厅、酒店</li>
                <li><strong>实时天气</strong>：显示长沙当前天气情况</li>
              </ul>
            </div>
          </el-collapse-item>
          
          <el-collapse-item title="换一批功能" name="refresh">
            <div class="feature-desc">
              <p>对推荐不满意？点击"换一批"按钮：</p>
              <ul>
                <li><strong>景点</strong>：根据您的偏好推荐新的景点</li>
                <li><strong>美食</strong>：推荐同类型或不同风味的餐厅</li>
                <li><strong>住宿</strong>：推荐同区域或不同价位的酒店</li>
              </ul>
              <p class="tip">提示：换一批功能使用高德地图实时数据，确保推荐真实有效</p>
            </div>
          </el-collapse-item>
          
          <el-collapse-item title="费用计算" name="cost">
            <div class="feature-desc">
              <p>系统自动计算行程费用，包括：</p>
              <ul>
                <li><strong>景点门票</strong>：根据实际门票价格计算</li>
                <li><strong>餐饮费用</strong>：按人均消费估算</li>
                <li><strong>住宿费用</strong>：按酒店每晚价格计算</li>
                <li><strong>交通费用</strong>：根据出行方式估算</li>
                <li><strong>应急备用</strong>：预留10%应急资金</li>
              </ul>
              <p class="tip">提示：悬停在"预计花费"上可查看费用明细</p>
            </div>
          </el-collapse-item>
          
          <el-collapse-item title="收藏功能" name="favorite">
            <div class="feature-desc">
              <p>收藏您喜欢的景点、餐厅、酒店：</p>
              <ul>
                <li>点击卡片上的收藏按钮即可收藏</li>
                <li>收藏内容会保存在您的账户中</li>
                <li>下次规划时会优先考虑收藏的地点</li>
              </ul>
            </div>
          </el-collapse-item>
          
          <el-collapse-item title="导出分享" name="export">
            <div class="feature-desc">
              <p>支持多种导出格式：</p>
              <ul>
                <li><strong>JSON格式</strong>：结构化数据，方便二次开发</li>
                <li><strong>HTML格式</strong>：可直接打印或分享</li>
                <li><strong>分享链接</strong>：生成7天有效期的分享链接</li>
              </ul>
            </div>
          </el-collapse-item>
        </el-collapse>
      </el-card>

      <el-card class="help-card">
        <template #header>
          <div class="card-header">
            <el-icon><ChatDotRound /></el-icon>
            <span>常见问题</span>
          </div>
        </template>
        
        <el-collapse>
          <el-collapse-item title="Q: 如何修改已生成的行程？" name="q1">
            <p>A: 您可以通过以下方式修改行程：</p>
            <ul>
              <li>在对话框中继续与AI对话，提出修改要求</li>
              <li>点击"换一批"更换特定景点/餐厅/酒店</li>
              <li>保存行程后，在历史记录中重新编辑</li>
            </ul>
          </el-collapse-item>
          
          <el-collapse-item title="Q: 推荐的景点/餐厅是否真实存在？" name="q2">
            <p>A: 是的！所有推荐都经过高德地图API验证：</p>
            <ul>
              <li>景点坐标来自高德地图真实数据</li>
              <li>餐厅信息实时获取</li>
              <li>酒店数据来自真实商家</li>
            </ul>
          </el-collapse-item>
          
          <el-collapse-item title="Q: 如何查看历史行程？" name="q3">
            <p>A: 点击顶部导航栏的"历史行程"按钮，或访问 /history 页面。登录用户的历史行程会保存在云端，游客模式仅保存在本地。</p>
          </el-collapse-item>
          
          <el-collapse-item title="Q: 预算超支怎么办？" name="q4">
            <p>A: 系统会在预算超支时显示警告，您可以：</p>
            <ul>
              <li>点击"查看建议"获取节省方案</li>
              <li>更换为免费景点</li>
              <li>选择经济型住宿</li>
              <li>增加小吃比例，减少正餐</li>
            </ul>
          </el-collapse-item>
          
          <el-collapse-item title="Q: 数据安全吗？" name="q5">
            <p>A: 我们重视您的数据安全：</p>
            <ul>
              <li>密码采用加密存储</li>
              <li>行程数据仅保存在您的账户中</li>
              <li>分享链接7天后自动失效</li>
              <li>不会向第三方泄露您的信息</li>
            </ul>
          </el-collapse-item>
        </el-collapse>
      </el-card>

      <el-card class="help-card">
        <template #header>
          <div class="card-header">
            <el-icon><Phone /></el-icon>
            <span>联系我们</span>
          </div>
        </template>
        
        <div class="contact-info">
          <div class="contact-item">
            <el-icon><Message /></el-icon>
            <span>邮箱：3209654864@qq.com</span>
          </div>
          <div class="contact-item">
            <el-icon><ChatDotSquare /></el-icon>
            <span>在线客服：无</span>
          </div>
          <div class="contact-item">
            <el-icon><Location /></el-icon>
            <span>地址：湖南省长沙市岳麓区麓山门..。</span>
          </div>
        </div>
        
        <div class="feedback-section">
          <h4>问题反馈</h4>
          <el-input
            v-model="feedbackContent"
            type="textarea"
            :rows="4"
            placeholder="请描述您遇到的问题或建议..."
          />
          <el-button type="primary" class="submit-btn" @click="submitFeedback">提交反馈</el-button>
        </div>
      </el-card>
    </div>
    <div class="right-bac">
      <div class="right-mark">
        <p>2026湖南大学毕业设计</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ArrowLeft, QuestionFilled, Compass, ChatDotRound, Phone, Message, ChatDotSquare, Location } from '@element-plus/icons-vue'

const router = useRouter()
const activeCollapse = ref(['map'])
const feedbackContent = ref('')

const goBack = () => {
  router.push('/')
}

const submitFeedback = () => {
  if (!feedbackContent.value.trim()) {
    ElMessage.warning('请输入反馈内容')
    return
  }
  
  ElMessage.success('感谢您的反馈，我们会尽快处理')
  feedbackContent.value = ''
}
</script>

<style scoped>
.help-page {
  min-height: 100%;
  background: linear-gradient(180deg, #e8f6f5 0%, #f5f7fa 20%);
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

.right-bac {
  position: fixed;
  margin: 20px;
  border-radius: 12px;
  right: 0;
  top: 0;
  width: 50%;
  height: 50%;
  background: url("../assets/hnu2.jpg");
  background-size: cover;
  background-position: center;
  z-index: 0;
  opacity: 0.9;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
}

.right-mark {
  text-align: center;
  padding-bottom: 20px;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.3));
  padding-top: 40px;
}

.right-mark p {
  margin: 0;
  color: rgba(255, 255, 255, 0.8);
  font-size: 14px;
  letter-spacing: 2px;
}

.help-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
  max-width: 900px;
  position: relative;
  z-index: 1;
}

.help-card {
  border-radius: 12px;
  border: none;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
  overflow: hidden;
  transition: all 0.3s ease;
}

.help-card:hover {
  box-shadow: 0 8px 24px rgba(157, 221, 216, 0.2);
}

.help-card :deep(.el-card__header) {
  background: linear-gradient(135deg, #9dddd8ff 0%, #c2eae8 100%);
  padding: 16px 20px;
  border-bottom: none;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 16px;
  color: #fff;
}

.help-section h3 {
  margin: 0 0 16px;
  font-size: 18px;
  color: #303133;
}

.help-section p {
  color: #606266;
  line-height: 1.8;
}

.guide-steps {
  margin-top: 24px;
}

.guide-steps :deep(.el-step__title) {
  font-weight: 600;
  color: #303133;
}

.guide-steps :deep(.el-step__icon.is-text) {
  background: linear-gradient(135deg, #9dddd8ff 0%, #c2eae8 100%);
  color: #fff;
  border: none;
}

.guide-steps :deep(.el-step.is-success .el-step__icon) {
  background: linear-gradient(135deg, #9dddd8ff 0%, #c2eae8 100%);
}

.guide-steps ul {
  margin: 8px 0;
  padding-left: 20px;
}

.guide-steps li {
  margin: 8px 0;
  color: #606266;
}

.feature-desc {
  padding: 8px 0;
}

.feature-desc ul {
  margin: 8px 0;
  padding-left: 20px;
}

.feature-desc li {
  margin: 6px 0;
  color: #606266;
}

.feature-desc .tip {
  margin-top: 12px;
  padding: 10px 14px;
  background: linear-gradient(135deg, rgba(157, 221, 216, 0.15) 0%, rgba(194, 234, 232, 0.15) 100%);
  border-radius: 8px;
  font-size: 13px;
  color: #5a9e99;
  border-left: 3px solid #9dddd8ff;
}

.contact-info {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 24px;
}

.contact-item {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #606266;
  padding: 12px 16px;
  background: linear-gradient(135deg, rgba(157, 221, 216, 0.08) 0%, rgba(194, 234, 232, 0.08) 100%);
  border-radius: 8px;
  transition: all 0.2s;
}

.contact-item:hover {
  background: linear-gradient(135deg, rgba(157, 221, 216, 0.15) 0%, rgba(194, 234, 232, 0.15) 100%);
}

.contact-item .el-icon {
  color: #9dddd8ff;
  font-size: 18px;
}

.feedback-section h4 {
  margin: 0 0 12px;
  font-size: 15px;
  color: #303133;
}

.submit-btn {
  margin-top: 12px;
  background: linear-gradient(135deg, #9dddd8ff 0%, #c2eae8 100%);
  border: none;
  color: #fff;
}

.submit-btn:hover {
  background: linear-gradient(135deg, #8cd0cbff 0%, #b5ddd9 100%);
}

.help-card :deep(.el-collapse-item__header) {
  font-weight: 500;
  color: #303133;
  transition: all 0.2s;
}

.help-card :deep(.el-collapse-item__header:hover) {
  color: #5a9e99;
}

.help-card :deep(.el-collapse-item__arrow) {
  color: #9dddd8ff;
}

@media (max-width: 1200px) {
  .right-bac {
    width: 40%;
  }
}

@media (max-width: 900px) {
  .right-bac {
    width: 30%;
    opacity: 0.7;
  }
}

@media (max-width: 768px) {
  .right-bac {
    display: none;
  }
}
</style>
