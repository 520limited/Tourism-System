<template>
  <div class="not-found">
    <div class="content">
      <h1>404</h1>
      <p>页面不存在</p>
      <el-button type="primary" @click="$router.push('/')">返回首页</el-button>
    </div>
  </div>
</template>

<script setup>
</script>

<style scoped>
.not-found {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.content {
  text-align: center;
}

.content h1 {
  font-size: 80px;
  color: #909399;
  margin-bottom: 20px;
}

.content p {
  font-size: 18px;
  color: #606266;
  margin-bottom: 32px;
}
</style>
