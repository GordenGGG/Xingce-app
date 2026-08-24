# 行测备考助手 - 项目交接文档

> 本文档面向接手该项目的开发者/Agent，提供完整的项目状态、架构、约定与注意事项。

## 一、当前状态摘要

- **版本**：v1.1.0（SemVer）
- **Git 分支**：master（无远程，纯本地）
- **提交历史**：3 次（初始化 → OCR 自动解析 → v1.1.0）
- **运行状态**：本地版 http://localhost:3000 可用；PWA 线上版 https://gordenggg.github.io/Xingce-app/ 已部署
- **项目所有者**：GordenGGG

## 二、核心架构

### 2.1 两种运行形态

**本地服务器版（primary，开发主战场）**
- 路径：根目录 `server.js` + `public/`
- 数据流：浏览器 → Express 后端 → DeepSeek/Qwen-VL/SenseVoice
- 优点：API Key 可放服务端 `.env`，前端无需暴露；便于调试
- 缺点：只能本机/局域网访问

**PWA 纯前端版（用于分享/手机）**
- 路径：`pwa/`
- 数据流：浏览器 → 直连 DeepSeek/Qwen-VL/SenseVoice（无后端）
- 优点：可托管到 GitHub Pages，任何网络可用
- 缺点：API Key 存前端 localStorage，有泄露风险

### 2.2 提示词单一权威来源

`prompts/` 目录是提示词的**唯一权威来源**：
- 本地版：`server.js` 直接读取 `prompts/*.js`
- PWA 版：`pwa/build.js` 把 `prompts/*.js` 打包成 `pwa/prompts.js`

**修改提示词的标准流程**：
1. 编辑 `prompts/<模块>.js`
2. 本地版刷新页面即生效（server.js 每次请求时读取）
3. PWA 版：运行 `node pwa/build.js` 重新生成 `pwa/prompts.js`
4. 部署 PWA：把 `pwa/prompts.js` 上传到 GitHub

### 2.3 六大模块提示词

| 模块 | 文件 | SOP 方法 |
|---|---|---|
| 政治理论 | politics.js | 关键词映射法 |
| 常识判断 | common_sense.js | 关键词映射法 |
| 言语理解 | verbal.js | 行文结构解构法（逐空过筛）|
| 数量关系 | quantitative.js | 题型模板与秒杀法 |
| 判断推理 | judgment.js | 特征图与公式化翻译 |
| 资料分析 | data_analysis.js | 结构阅读与极限速算 |
| 分类器 | classifier.js | 轻量模块识别 |

每个模块模板包含占位符：
- `{{text}}` - 题目原文
- `{{userAnswer}}` - 考生答案
- `{{correctAnswer}}` - 正确答案
- `{{userThought}}` - 考生思考过程

## 三、API 契约

### 3.1 POST /api/ocr-vision
- 入参：`{ imageData: string(base64 dataURL), dashscopeApiKey: string }`
- 出参：`{ question: string, correctAnswer: string, userAnswer: string }`
- AI：Qwen-VL-Plus（视觉）

### 3.2 POST /api/classify
- 入参：`{ text: string, apiKey: string }`
- 出参：`{ module: string }`
- AI：DeepSeek（轻量分类）

### 3.3 POST /api/analyze
- 入参：`{ text, module, userThought, userAnswer, detectedCorrect, apiKey }`
- 出参：完整 Markdown 解析（含知识点、原始 Markdown）
- AI：DeepSeek（两阶段：分类 + 深度解析）

### 3.4 POST /api/chat
- 入参：`{ questionText, analysisText, history, message, apiKey }`
- 出参：`{ reply: string }`
- AI：DeepSeek（多轮对话）

### 3.5 POST /api/detect-answer
- 入参：`{ text, apiKey }`
- 出参：`{ correct, userAnswer }`
- AI：DeepSeek（答案兜底识别）

### 3.6 POST /api/speech-to-text
- 入参：`{ audioBase64, mimeType, dashscopeApiKey }`
- 出参：`{ text: string }`
- AI：SenseVoice（ASR）

## 四、答案识别逻辑（重点）

答案识别采用**三层策略**：

1. **Qwen-VL 直接返回**：OCR 提示词要求模型从底部统计表提取答案
2. **前端正则兜底**：`parseAnswersFromText()`（public/js/app.js 与 pwa/app.js 各有一份）
3. **DeepSeek 兜底**：`/api/detect-answer`

统计表两种格式：
- **做错**：`A D 55% 31B D`（正确答案=A，你的答案=D）
- **做对**：`B 87x 1920 比 A`（正确答案=B，你的答案=B，因为无"你的答案"列）

正则匹配：
```javascript
// 做错：A + 空格 + D + 空格 + 55%
/^\s*([A-Da-d])\s+([A-Da-d])\s+\d{1,3}\s*[%xX比]/i
// 做对：B + 空格 + 87x
/^\s*([A-Da-d])\s+\d{1,3}\s*[%xX比]/i
```

## 五、遗留问题与废弃代码

### 5.1 废弃但未删除的前端模块

`public/js/` 下以下文件是历史遗留，`app.js` 已不引用，属于死代码：
- `prompts.js`（定义 `PROMPTS` 对象，未使用）
- `deepseek.js`（定义 `callDeepSeek`，未使用）
- `ocr.js`（Tesseract OCR，已被 Qwen-VL 取代）
- `export.js`（`Exporter` 类，未使用）
- `stats.js`（`StatsRenderer` 类，未使用）
- `storage.js`（IndexedDB 存储，未使用）

这些文件仍被 `index.html` 的 `<script>` 标签加载，但 `app.js` 是自包含单体，不依赖它们。**清理建议**：确认无误后可删除这些文件和对应的 `<script>` 引用。

### 5.2 已知问题

- OCR 识别分数（`a/b`）和百分号偶尔不准，属 Qwen-VL 视觉能力限制，需优化 OCR 提示词
- `tesseract.js` CDN 在 index.html 中仍被引用但已不使用
- `启动服务器.bat`、`pwa/启动PWA.bat`、`deploy/推送到GitHub.bat` 有编码损坏（中文乱码），且依赖旧 Node 路径

## 六、开发注意事项（重要）

### 6.1 PowerShell 引号转义

在 Windows PowerShell 环境下，以下内容极易出错：
- `$` 符号（变量插值）
- `\n`、`\s`、`\d` 等正则转义
- 嵌套引号

**推荐做法**：用 Node.js 脚本写文件，避免 PowerShell 内联复杂命令。正则中的反斜杠用 `String.fromCharCode(92)` 构造。

### 6.2 文件编码

- 所有源文件用 UTF-8（无 BOM）
- Windows 批处理 `.bat` 文件用 CRLF 行尾 + UTF-8
- 写含中文的文件必须用 Node.js 的 `fs.writeFileSync(path, content, "utf8")`

### 6.3 Node.js 路径

- 系统 PATH 已有 Node：`C:\Program Files\nodejs\node.exe`（v24.x）
- 旧脚本引用的 `C:\Users\Administrator\.cache\codex-runtimes\...` 已废弃

### 6.4 API Key 安全

- `.env` 已加入 `.gitignore`，不会提交
- PWA 版 Key 存浏览器 localStorage，是设计权衡（分享便利 vs 安全）
- 后端 `getApiKey()` / `getDashScopeKey()` 优先读 `.env`，其次读请求体

## 七、部署流程

### 本地服务器版
```bash
npm start
# 或全局命令 xingce（已配置，见 C:\Users\Administrator\bin\xingce.bat）
```

### PWA 到 GitHub Pages
1. `node pwa/build.js` 打包提示词
2. 把 `pwa/` 下产物（或 `deploy/` 目录）上传到 GitHub 仓库
3. GitHub Settings → Pages → 选 main 分支 root
4. 线上地址：https://gordenggg.github.io/Xingce-app/

### Git 提交
```bash
git add -A
git commit -m "类型: 简短说明"
```
提交信息风格：`v1.1.0: 优化答案识别与题目排版，新增版本显示`

## 八、后续可优化方向

- 清理 `public/js/` 死代码
- 修复损坏的 .bat 脚本
- OCR 分数识别增强（可考虑后处理正则）
- 移动端 UI 适配优化
- 错题数据导出/导入
- 多设备数据同步（需后端/云存储）
