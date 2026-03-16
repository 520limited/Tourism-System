# 长沙旅游智能规划系统

一个基于 AI 的智能旅游行程规划系统，为用户提供个性化的长沙旅游行程推荐。

## 功能特性

- **AI 智能对话** - 通过自然语言对话收集用户需求，智能生成行程规划
- **个性化推荐** - 根据用户偏好（人群类型、预算、兴趣等）定制行程
- **高德地图集成** - 实时验证地点坐标，确保行程准确性
- **行程管理** - 支持行程保存、编辑、删除、收藏等功能
- **历史记录** - 保存用户历史行程，方便回顾和管理
- **多维度推荐** - 景点、餐厅、酒店、小吃、饮品、打卡点等

## 技术栈

### 前端
- Vue 3 + Vite
- Pinia 状态管理
- Vue Router 路由
- Element Plus UI 组件库
- 高德地图 JS API

### 后端
- Node.js + Express
- SQLite 数据库
- 通义千问 AI API
- 高德地图 Web API

## 项目结构

```
├── client/                 # 前端项目
│   ├── src/
│   │   ├── api/           # API 接口
│   │   ├── components/    # 组件
│   │   ├── views/         # 页面
│   │   ├── stores/        # 状态管理
│   │   ├── router/        # 路由配置
│   │   └── utils/         # 工具函数
│   └── vite.config.js
│
├── server/                 # 后端项目
│   ├── controllers/       # 控制器
│   ├── services/          # 服务层
│   │   ├── ai/           # AI 服务
│   │   ├── external/     # 外部 API 服务
│   │   ├── trip/         # 行程服务
│   │   └── user/         # 用户服务
│   ├── database/          # 数据库
│   └── app.js             # 入口文件
│
└── .env                    # 环境变量配置
```

## 快速开始

### 环境要求

- Node.js >= 16.0.0
- npm >= 8.0.0

### 安装依赖

```bash
# 安装根目录依赖
npm install

# 安装前端依赖
cd client && npm install

# 安装后端依赖
cd server && npm install
```

### 配置环境变量

在项目根目录创建 `.env` 文件：

```env
# AI 配置
QWEN_API_KEY=your_qwen_api_key

# 高德地图配置
AMAP_KEY=your_amap_key

# 邮件服务配置
EMAIL_SERVICE=smtp.qq.com
EMAIL_USER=your_email@qq.com
EMAIL_PASS=your_email_password

# Session 配置
SESSION_EXPIRE_DAYS=5
```

### 启动项目

```bash
# 启动后端服务 (端口 3002)
cd server && npm run dev

# 启动前端服务 (端口 5173)
cd client && npm run dev
```

### 访问应用

打开浏览器访问 http://localhost:5173

## 主要功能说明

### 1. AI 对话规划

用户可以通过自然语言描述旅行需求，AI 会智能理解并生成个性化行程：
- 出行天数
- 出行人群（情侣、亲子、朋友等）
- 预算范围
- 兴趣偏好
- 住宿区域偏好

### 2. 行程详情

- 每日景点、餐厅、酒店推荐
- 地图可视化展示
- 换一批功能（重新推荐）
- 收藏功能

### 3. 行程管理

- 历史行程查看
- 行程编辑
- 行程删除
- 行程收藏

### 4. 用户中心

- 个人信息管理
- 收藏管理
- 系统设置

## API 接口

### 行程相关

| 接口 | 方法 | 说明 |
|------|------|------|
| /api/trips | GET | 获取行程列表 |
| /api/trips | POST | 创建/更新行程 |
| /api/trips/:id | GET | 获取行程详情 |
| /api/trips/:id | DELETE | 删除行程 |
| /api/trips/:id/favorite | POST | 收藏/取消收藏 |

### AI 规划

| 接口 | 方法 | 说明 |
|------|------|------|
| /api/plan | POST | AI 生成行程规划 |
| /api/chat | POST | AI 对话 |

### 刷新推荐

| 接口 | 方法 | 说明 |
|------|------|------|
| /api/refresh/attractions | POST | 刷新景点推荐 |
| /api/refresh/restaurants | POST | 刷新餐厅推荐 |
| /api/refresh/hotels | POST | 刷新酒店推荐 |

## 开发说明

### 前端开发

```bash
cd client
npm run dev      # 开发模式
npm run build    # 构建生产版本
```

### 后端开发

```bash
cd server
npm run dev      # 开发模式（带热重载）
npm start        # 生产模式
```

### 数据库迁移

```bash
cd server
node database/migrate.js
```

## 注意事项

1. 高德地图 API 有 QPS 限制，系统已实现请求限流（250ms 间隔）
2. AI 生成内容仅供参考，请以实际情况为准
3. 建议在生产环境中配置 HTTPS

## 许可证

MIT License

## 贡献指南

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 提交 Pull Request
