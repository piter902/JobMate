# JobMate

AI 求职助手浏览器扩展。在 Boss 直聘上自动分析职位匹配度并生成个性化招呼语。

## 功能

- **智能匹配分析**：提取 JD 要求，逐维度对比简历，核心能力一票否决制打分
- **招呼语生成**：基于匹配点生成专业招呼语，不编造不虚构
- **多简历管理**：上传多份 PDF/DOCX 简历，一键切换
- **历史缓存**：按公司+岗位存储招呼语，聊天页自动匹配
- **自动填入**：轮询检测聊天输入框，自动填入招呼语
- **隐私优先**：简历本地解析，不上传任何服务器

## 安装

1. 下载 `recruitment-greeting-plugin-0.1.0-chrome.zip` 并解压
2. 打开 Chrome → `chrome://extensions/` → 开启右上角「开发者模式」
3. 点击「加载已解压的扩展程序」→ 选择解压后的文件夹
4. 点击工具栏 JobMate 图标 → 配置 DeepSeek API Key → 上传简历

## 使用

### 生成招呼语

1. 打开 Boss 直聘任意职位详情页
2. 页面右上角出现 JobMate 面板
3. 点击「通用」「技能」「经验匹配」「项目经历」选择侧重点
4. 等待 AI 分析匹配度并生成招呼语
5. 点击「📋 复制招呼语」→ Ctrl+V 粘贴到聊天框

### 查看历史招呼语

1. 在聊天页点击「查历史招呼语 →」
2. 自动从缓存匹配该职位的招呼语
3. 如果无缓存，尝试用缓存的 JD 重新生成

### 切换简历

1. 点击工具栏 JobMate 图标
2. 上传多份简历（支持 PDF / DOCX）
3. 点击某份简历即切换为当前使用
4. 重新生成招呼语时会基于新简历

## 技术栈

- **框架**：WXT + React 18 + TypeScript
- **AI**：DeepSeek Chat API
- **简历解析**：pdfjs-dist / mammoth
- **数据存储**：chrome.storage.local（纯本地）
- **分析统计**：PostHog

## 隐私说明

- 简历 PDF/DOCX 在浏览器本地解析为纯文本，不经过任何服务器
- DeepSeek API Key 由用户自行提供，仅通过 HTTPS 发送到 DeepSeek 服务器
- 招呼语生成时，简历文本和 JD 文本会发送到 DeepSeek API
- 使用数据统计通过 PostHog 匿名上报（仅记录生成次数，不含简历/JD内容）

## 开发

```bash
# 安装依赖
npm install

# 开发构建
npm run dev

# 生产构建
npm run build

# 打包
npm run zip
```

## 许可

MIT

## 下载

> 请前往 [Releases](https://github.com/piter902/JobMate/releases) 页面下载最新版本。
