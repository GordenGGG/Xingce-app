# 行测备考助手

行测题目截图识别、DeepSeek 智能解析、错题复盘工具。

## 版本

当前版本：**v2.0.0**（语义化版本 SemVer）

版本号规则：`主版本.次版本.修订号`
- 主版本：重大架构变更或不兼容改动
- 次版本：新增功能
- 修订号：bug 修复、体验优化

## 功能特性

- 截图粘贴/上传，Qwen-VL 视觉模型 OCR 识别题目
- 六大模块定制化 SOP 解析（政治理论、常识判断、言语理解、数量关系、判断推理、资料分析）
- 政治理论模块内置**联网搜索**（DeepSeek Responses API web_search），时政以最新官方信息为准并标注来源
- 逐选项/逐空全要素过筛，关键线索加粗标注
- 自动识别正确答案与"我的答案"（支持做对/做错两种统计格式）
- 多轮追问对话与错因复盘
- 错题本地存储（IndexedDB），解析完成**自动入库**（正确答案+我的答案都识别到时）
- 错题本：筛选/搜索/分页、**批量操作**（多选删除/标记掌握/导出选中）、JSON 导入导出
- **重练模式**（隐藏答案自测、提交判定自动更新对错与掌握状态）
- 语音转文字输入（SenseVoice）
- 解析结果截图分享

## 技术栈

- 后端：Node.js + Express
- 前端：原生 HTML/CSS/JS + marked.js + KaTeX
- AI 服务：DeepSeek（解析）、Qwen-VL（OCR）、SenseVoice（语音）
- 存储：IndexedDB（本地）
- PWA：纯静态，无需后端

## 两种运行形态

### 1. 本地服务器版（推荐开发用）

依赖 Node.js 和 npm，启动：

```bash
npm start
# 或 node server.js
```

访问 http://localhost:3000

配置：复制 `.env.example` 为 `.env`，填写 DeepSeek API Key（可选）。DashScope Key 在网页设置面板配置。

### 2. PWA 纯前端版（用于手机/分享）

无需后端服务器，API 调用直接从浏览器发起。

- 本地测试：`cd pwa && node server.js`，访问 http://localhost:8080
- 线上访问：https://gordenggg.github.io/Xingce-app/

提示词修改后需重新打包：`node pwa/build.js`

## 目录结构

```
行测app/
├── server.js              # Express 后端，6 个 API 端点
├── package.json           # 依赖与启动脚本
├── .env.example           # 环境变量模板
├── prompts/               # 六大模块 SOP 提示词（权威来源）
│   ├── classifier.js      #   模块分类器
│   ├── politics.js        #   政治理论
│   ├── common_sense.js    #   常识判断
│   ├── verbal.js          #   言语理解
│   ├── quantitative.js    #   数量关系
│   ├── judgment.js        #   判断推理
│   └── data_analysis.js   #   资料分析
├── public/                # 本地服务器版前端
│   ├── index.html
│   ├── css/style.css
│   └── js/
│       ├── app.js         # 主逻辑（自包含单体）
│       ├── storage.js     # IndexedDB 存储（错题本/统计依赖）
│       ├── stats.js       # 统计图表渲染（Chart.js）
│       └── export.js      # JSON/CSV/PDF 导出
├── pwa/                   # PWA 纯前端版
│   ├── index.html
│   ├── app.js             # 直接调用 API，无后端
│   ├── prompts.js         # 由 build.js 从 prompts/ 打包生成
│   ├── build.js           # 提示词打包脚本
│   ├── manifest.json      # PWA 清单
│   └── sw.js              # Service Worker
├── deploy/                # PWA 发布快照（由 pwa/ 同步，勿直接编辑）
├── docs/                  # 项目文档
└── 参考截图/               # OCR 测试样本
```

## API 接口

所有接口均为 POST，JSON 格式：

| 端点 | 功能 | 使用的 AI |
|---|---|---|
| `/api/ocr-vision` | 截图 OCR 识别 | Qwen-VL |
| `/api/classify` | 题目模块分类 | DeepSeek |
| `/api/analyze` | 完整 SOP 解析 | DeepSeek |
| `/api/chat` | 多轮追问/错因复盘 | DeepSeek |
| `/api/detect-answer` | 答案兜底识别 | DeepSeek |
| `/api/speech-to-text` | 语音转文字 | SenseVoice |

详细契约见 docs/HANDOFF.md

## 开发规范

- 修改提示词：直接编辑 `prompts/` 下对应文件，本地刷新即生效；PWA 版需运行 `node pwa/build.js` 重新打包
- 提交规范：改动后 `git add` + `git commit -m "说明"`，保持小步提交
- API Key 不提交：`.env` 和前端 localStorage 中的 Key 均不进入 Git

## 常见问题

- 服务器启动命令：`npm start`（或全局命令 `xingce`）
- OCR 识别分数/百分号不准：属视觉模型限制，可优化 `/api/ocr-vision` 的提示词
- 手机无法访问 localhost：需部署到 GitHub Pages 或同一局域网
