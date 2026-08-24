# 行测备考助手（PWA 部署目录）

> **本目录是 `pwa/` 的发布快照**，由 `pwa/` 同步而来，仅用于 GitHub Pages 等静态托管发布。
> 日常开发请直接修改 `pwa/`（提示词改 `prompts/` 后运行 `node pwa/build.js` 重新打包），然后重新同步本目录。

行测题目 OCR 识别 + DeepSeek 智能解析 + 错题复盘

## 使用方式

1. 打开 [GitHub Pages 链接]
2. 点击右上角 ⚙️ 设置 → 配置你的 API Key
   - **DeepSeek API Key**：从 [platform.deepseek.com](https://platform.deepseek.com/api_keys) 获取
   - **DashScope API Key**：从 [bailian.console.aliyun.com](https://bailian.console.aliyun.com) 获取
3. 上传题目截图 → AI 自动解析

## 安装到手机

- **Android**：用 [PWABuilder](https://pwabuilder.com) 输入本页 URL → 打包 APK
- **iPhone**：Safari 打开 → 分享 → 添加到主屏幕

## 技术栈

纯前端 PWA，API 调用直连 DeepSeek + 阿里 DashScope，无后端服务器。
