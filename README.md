<div align="center">

# 🗺️ Changsha Travel Intelligence Planner (CTIP)

**基于多服务集成的旅游模糊需求精准转化及行程优化系统**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-green.svg)](https://nodejs.org/)
[![Vue.js](https://img.shields.io/badge/Vue.js-3.x-4FC08D?logo=vue.js&logoColor=white)](https://vuejs.org/)
[![MySQL](https://img.shields.io/badge/MySQL-8.0-4479A1?logo=mysql&logoColor=white)](https://www.mysql.com/)
[![Qwen](https://img.shields.io/badge/Qwen-API-blue.svg)](https://bailian.console.aliyun.com/)

**毕业设计作品 | 2026届**

</div>

---

## 📋 摘要 (Abstract)

本系统是一个面向长沙旅游场景的 **AI 驱动智能行程规划平台**，实现了从自然语言模糊需求到结构化行程方案的端到端转化。系统采用前后端分离架构，集成通义千问大语言模型、高德地图开放平台、和风天气服务三大外部能力，通过多轮对话交互、TSP 路线优化、热度预测避峰等算法，为用户提供个性化、可解释的旅游决策支持。

**关键词**: 智能行程规划 · 自然语言理解 · 多源数据融合 · 路线优化 · 偏好学习

---

## 🏗️ 系统架构 (System Architecture)

```
┌─────────────────────────────────────────────────────────────────────┐
│                         客户端层 (Client Layer)                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐            │
│  │ AI 对话   │  │ 行程详情  │  │ 地图可视化 │  │ 用户中心  │            │
│  │ ChatView  │  │ TripDetail│  │ AmapViewer│  │ Profile  │            │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘            │
│       └──────────────┴──────────────┴──────────────┘                 │
│                        Vue 3 + Pinia + Element Plus                  │
└───────────────────────────────┬─────────────────────────────────────┘
                                │ HTTP / WebSocket
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         服务端层 (Server Layer)                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                    Express.js Application                     │    │
│  ├──────────┬──────────┬──────────┬──────────┬─────────────────┤    │
│  │ 认证模块  │ 规划引擎  │ 行程管理  │ 用户服务  │   中间件        │    │
│  │ Auth     │ Planning │  Trip    │  User    │ RateLimit      │    │
│  │          │ Controller│Controller│         │ Logger         │    │
│  └────┬─────┴────┬─────┴────┬─────┴────┬─────┴────────────────┘    │
│       │          │           │          │                            │
│  ┌────▼──────────▼──────────▼──────────▼────────────────────┐       │
│  │                   业务逻辑层 (Services)                    │       │
│  │ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐  │       │
│  │ │AI 引擎  │ │地图服务  │ │天气服务  │ │路线优化  │ │偏好学习 │  │       │
│  │ │Qwen API│ │Amap API│ │QWeather│ │TSP算法  │ │画像构建 │  │       │
│  │ └────────┘ └────────┘ └────────┘ └────────┘ └────────┘  │       │
│  └───────────────────────────────────────────────────────────┘       │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
              ┌─────────────────┼─────────────────┐
              ▼                 ▼                 ▼
        ┌──────────┐     ┌──────────┐     ┌──────────┐
        │ 通义千问  │     │ 高德地图  │     │ 和风天气  │
        │ Qwen LLM │     │ Amap POI  │     │ Weather  │
        └──────────┘     └──────────┘     └──────────┘
                                │
                          ┌─────▼─────┐
                          │   MySQL    │
                          │  Database  │
                          └───────────┘
```

---

## 🛠️ 技术栈 (Tech Stack)

| 层级 (Layer) | 技术 (Technology) | 版本 (Version) | 用途 (Purpose) |
|:---|:---|:---:|:---|
| **前端框架** | Vue.js | 3.x | 渐进式 JavaScript 框架 |
| **构建工具** | Vite | 5.x | 下一代前端构建工具 |
| **UI 组件库** | Element Plus | 2.x | 基于 Vue 3 的组件库 |
| **状态管理** | Pinia | 2.x | Vue 官方状态管理 |
| **路由管理** | Vue Router | 4.x | 客户端路由 |
| **后端运行时** | Node.js | ≥18 | JavaScript 运行环境 |
| **Web 框架** | Express | 4.x | 极简 Web 服务框架 |
| **ORM/驱动** | mysql2 | 3.x | MySQL 数据库驱动 |
| **关系数据库** | MySQL | 8.0 | 持久化存储 |
| **AI 引擎** | 通义千问 (Qwen) | qwen-plus | 大语言模型 API |
| **LBS 服务** | 高德地图 | REST API v3 | 地理位置与路径规划 |
| **气象服务** | 和风天气 | v7 | 天气数据接口 |
| **限流中间件** | express-rate-limit | 7.x | API 请求频率控制 |

---

## ✨ 核心功能 (Core Features)

### 🔤 自然语言需求解析 (NLU)
- 支持中文模糊需求输入（如 *"情侣两天游，预算1000，想看博物馆和吃小吃"*）
- 基于 LLM 的语义解析 → 结构化参数提取（天数/预算/人群类型/兴趣标签）
- 多轮对话上下文维护，支持增量式需求修正

### 🧠 AI 行程生成引擎
- **Prompt Engineering**: 结构化提示词模板 + Few-shot 示例增强输出稳定性
- **JSON Schema 约束**: 强制 LLM 输出符合预定义 schema 的结构化数据
- **容错修复机制**: `fixJSON()` 后处理函数应对格式异常

### 🗺️ TSP 路线优化 (Route Optimization)
- **算法**: 最近邻贪心法 (Nearest Neighbor Heuristic)
- **复杂度**: O(n²)，适用于 N < 20 的城市景点规模
- **近似比**: 通常达到全局最优的 85%+，且时间效率优异
- **输入**: 含经纬度的景点序列 → **输出**: 最优访问顺序 + 节省距离/时间

### 🚦 交通方式智能推荐 (Transport Recommendation)
多因子加权评分模型：
$$Score(w) = \alpha \cdot TimeNorm + \beta \cdot CostNorm + \gamma \cdot ComfortNorm + \delta \cdot WeatherFactor$$

其中：
- $\alpha, \beta, \gamma, \delta$ 为权重系数（根据用户偏好动态调整）
- $WeatherFactor$ 为天气惩罚项（雨天步行/骑行降权）

支持模式：🚶 步行 / 🚇 地铁 / 🚌 公交 / 🚗 打车 / 🚗 驾车

### 📊 热度预测与避峰调度 (Crowd Prediction)
- **预测模型**: 多因子加权回归（历史基线 × 时段系数 × 天气影响 × 节假日倍率）
- **调度算法**: 贪心策略避峰优化，每轮选择 `crowdLevel` 最低的景点×时隙组合
- **约束条件**: 高峰时段 (level > 0.8) 自动排除；每个景点占用连续时间段

### 👤 用户偏好学习系统 (Preference Learning)
```
行为采集 (Behavior Collection) 
    ↓
特征提取 (Feature Extraction: 场景/预算/节奏/交通偏好)
    ↓
加权画像构建 (Weighted Profile Construction)
    ↓
个性化推荐 (Personalized Recommendation)
```
- 显式反馈：收藏/取消收藏/评分
- 隐式反馈：浏览时长/点击顺序/修改操作

---

## 🛡️ 可靠性设计 (Reliability Design)

### 三层限流防护体系 (Rate Limiting)

| 层级 | 机制 | 配置参数 | 防御目标 |
|:---|:---|:---|:---|
| **L1 - HTTP 层** | express-rate-limit | 600次/min (10/s) | 全局请求频率 |
| **L2 - 并发控制** | 令牌桶 (Token Bucket) | maxConcurrent=5 | 异步任务并发数 |
| **L3 - QPS 限制** | 滑动窗口 (Sliding Window) | maxQPS=8, minInterval=120ms | 第三方API调用速率 |

> **设计原理**: 令牌桶控空间维度（并发），滑动窗口控时间维度（吞吐），最小间隔防突发穿透——三者正交互补。

### 外部服务容错 (Fault Tolerance)
- **自动重试**: 指数退避策略 ($800ms → 1600ms → 2400ms$)，最多 3 次
- **熔断降级**: 连续失败后返回缓存/AI生成数据作为兜底
- **超时保护**: axios `timeout: 40s` 防止长时间阻塞

---

## 📁 项目结构 (Project Structure)

```
changsha-travel-planner/
├── client/                           # 前端应用 (Vue 3 + Vite)
│   ├── src/
│   │   ├── views/                    # 页面视图组件
│   │   │   ├── MainPlanner.vue       # 主界面 (三栏布局)
│   │   │   ├── Login.vue / Register.vue
│   │   │   ├── History.vue / Settings.vue / Help.vue
│   │   ├── components/               # 业务组件
│   │   │   ├── AIChat.vue            # AI 对话面板
│   │   │   ├── TripDetail.vue        # 行程详情展示
│   │   │   └── AmapViewer.vue        # 高德地图渲染
│   │   ├── stores/                   # Pinia 状态管理
│   │   │   ├── tripStore.js          # 行程状态
│   │   │   ├── mapStore.js           # 地图状态
│   │   │   └── userStore.js          # 用户状态
│   │   ├── api/                      # Axios 封装
│   │   └── router/                   # 路由配置
│   └── vite.config.js                # Vite 配置 (含代理)
│
├── server/                           # 后端服务 (Express)
│   ├── app.js                        # 应用入口
│   ├── controllers/                  # 路由控制器层
│   │   ├── apiController.js          # 路由聚合器
│   │   ├── authController.js         # 认证/用户管理
│   │   ├── planningController.js     # 行程规划/AI对话
│   │   ├── tripController.js         # 行程CRUD/路线/导出
│   │   ├── favoriteController.js     # 收藏管理
│   │   ├── preferenceController.js   # 偏好学习
│   │   └── popularityController.js   # 热度预测
│   ├── services/                     # 业务逻辑层
│   │   ├── ai/
│   │   │   ├── qwenAIService.js      # 通义千问封装
│   │   │   └── aiPromptGenerator.js  # Prompt 模板引擎
│   │   ├── external/
│   │   │   ├── amapService.js        # 高德地图 (含 ConcurrencyLimiter)
│   │   │   └── webSearchService.js   # Web搜索 (含 RateLimiter)
│   │   ├── trip/
│   │   │   ├── smartPlanningService.js    # 智能规划核心
│   │   │   ├── popularityPredictionService.js  # 热度预测
│   │   │   ├── dynamicPopularityService.js     # 动态热度
│   │   │   └── exportService.js             # 导出服务
│   │   ├── user/
│   │   │   ├── userService.js        # 用户 CRUD
│   │   │   ├── preferenceLearningService.js  # 偏好学习
│   │   │   └── favoriteService.js    # 收藏逻辑
│   │   └── logger.js                 # 统一日志
│   ├── database/
│   │   └── db.js                     # 建表SQL + 连接池
│   ├── middleware/
│   │   └── index.js                  # 限流/日志/错误处理
│   └── logs/                         # 日志目录
│
├── .env                              # 环境变量 (敏感信息, 不提交)
├── .env.example                      # 环境变量模板
├── package.json                      # 项目配置 & 脚本
└── README.md                         # 本文件
```

---

## 🚀 快速开始 (Quick Start)

### 环境先决条件 (Prerequisites)

| 依赖 | 最低版本 | 推荐版本 | 验证命令 |
|:---|:---:|:---:|:---|
| Node.js | ≥ 18.0 | ≥ 20 LTS | `node --version` |
| npm | ≥ 9.0 | ≥ 10 | `npm --version` |
| MySQL | ≥ 8.0 | 8.0+ | `mysql --version` |

### 安装步骤 (Installation)

```bash
# 1. 克隆仓库
git clone <repository-url>
cd changsha-travel-planner

# 2. 安装所有依赖 (前端 + 后端)
npm run install:all

# 3. 配置环境变量
cp .env.example .env
# 编辑 .env 文件，填入以下密钥:
```

#### 必需的环境变量 (Required Environment Variables)

| 变量名 | 说明 | 获取地址 |
|:---|:---|:---|
| `QWEN_API_KEY` | 通义千问 API Key | [阿里云百炼控制台](https://bailian.console.aliyun.com) |
| `AMAP_KEY` | 高德 Web服务 Key | [高德开放平台](https://console.amap.com/dev/key/app) |
| `AMAP_WEB_KEY` | 高德 Web端安全密钥 | 同上 |
| `AMAP_JS_KEY` | 高德 JS API Key | 同上 |
| `QWEATHER_KEY` | 和风天气 API Key | [和风天气开发者控制台](https://dev.qweather.com) |
| `DB_HOST` | MySQL 主机地址 | 默认 `localhost` |
| `DB_PORT` | MySQL 端口 | 默认 `3306` |
| `DB_USER` | MySQL 用户名 | 默认 `root` |
| `DB_PASSWORD` | MySQL 密码 | 你的数据库密码 |
| `DB_NAME` | 数据库名称 | 默认 `travel_planner` |
| `PORT` | 后端服务端口 | 默认 `3002` |

### 启动开发服务器 (Development)

```bash
# 方式一：同时启动前后端 (推荐)
npm run dev
# → Server: http://localhost:3002
# → Client: http://localhost:5173 (Vite Dev Server)

# 方式二：分别启动
npm run dev:server    # 仅启动后端 :3002
npm run dev:client    # 仅启动前端 :5173
```

### 生产部署 (Production Deployment)

```bash
# 1. 构建前端资源
npm run build:client
# → 输出至 client/dist/

# 2. 启动生产服务器 (Express 自动托管静态文件)
npm run start:server
# → 访问 http://localhost:3002
```

---

## 📊 系统性能指标 (Performance Metrics)

| 指标 | 数值 | 备注 |
|:---|:---:|:---|
| AI 行程生成延迟 | ~3-8s | 取决于 LLM 响应速度 |
| 单次路线规划 | < 500ms | 高德 API 平均响应 |
| 批量 POI 搜索 (20个) | < 3s | 受限于并发限速器 |
| 地图首屏加载 | < 1.5s | SDK 动态加载 + 密钥获取 |
| 并发支持 | 5 外部API / 10 HTTP/s | 限流器配置上限 |

---

## ⚠️ 已知限制与待改进 (Known Limitations)

> 本项目为 **毕业设计学术作品**，以下问题已在设计与实现阶段识别，部分已提供缓解方案。

| 编号 | 问题类别 | 描述 | 当前缓解措施 | 建议改进方向 |
|:---:|:---|:---|:---|:---|
| L01 | **坐标精度** | 高德 POI 搜索可能返回跨省结果 (`citylimit` 非硬性约束) | Haversine 距离校验 (30km 阈值) + 回退策略 | 结合地理围栏 (Geo-fencing) 二次过滤 |
| L02 | **API 限流** | 高德免费版 QPS 较低，批量搜索可能触发 `CUQPS` 限流 | `ConcurrencyLimiter` 三重限速 + 指数退避重试 (3次) | 升级付费套餐或引入 Redis 分布式限流 |
| L03 | **LLM 稳定性** | AI 输出 JSON 格式偶尔不规范 (中文标点/缺失字段) | `fixJSON()` 容错函数 + Schema 强约束 Prompt | 引入 JSON Mode 或 Function Calling |
| L04 | **会话存储** | Session 仅内存存储，重启丢失，不支持多实例 | 开发环境够用 | 生产环境迁移至 Redis Store |
| L05 | **连接池健康** | MySQL 长连接可能因超时断开 | mysql2 内置重连机制 | 增加心跳检测 (keep-alive interval) |
| L06 | **数据时效性** | 景点价格/评分由 LLM 知识库生成，可能与实际不符 | 提示用户以实际为准 | 定期爬取或接入实时数据源 |

---

## 📚 相关文献与致谢 (References & Acknowledgments)

### 外部服务
- [**通义千问 (Qwen)**](https://bailian.console.aliyun.com/) - 阿里云百炼平台大语言模型
- [**高德开放平台**](https://lbs.amap.com/) - 地理位置服务 (POI/路线/天气)
- [**和风天气**](https://dev.qweather.com/) - 气象数据服务

### 开源依赖
- [Vue.js](https://vuejs.org/) - 渐进式 JavaScript 框架
- [Express.js](https://expressjs.com/) - Node.js Web 应用框架
- [Element Plus](https://element-plus.org/) - Vue 3 UI 组件库
- [Pinia](https://pinia.vuejs.org/) - Vue 状态管理

---

## 📄 许可证 (License)

本项目采用 [MIT License](LICENSE) 开源协议。

```
MIT License

Copyright (c) 2026 Changsha Travel Intelligence Planner

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.
```

---

<div align="center">

**Made with ❤️ for 毕业设计 (Graduation Project 2026)**

*如有问题或建议，欢迎提 Issue 或 Pull Request*

</div>
