# JobMate

AI 求职助手浏览器扩展。在 Boss 直聘上自动分析职位匹配度并生成个性化招呼语。

## 下载

> 请前往 [Releases](https://github.com/piter902/JobMate/releases) 下载最新版本 `jobmate-0.1.0-chrome.zip`。

## 功能

- **智能匹配分析**：LLM 提取 JD 要求，逐维度对比简历，核心能力一票否决制打分（技术岗跨栈直接 0 分，通用岗正常打分）
- **招呼语生成**：仅基于简历匹配点生成招呼语，绝不编造不虚构
- **多简历管理**：支持多份 PDF/DOCX，一键切换，选中哪个用哪个
- **历史缓存**：按公司+岗位存储，聊天页自动匹配历史招呼语
- **自动填入**：100ms 轮询检测聊天输入框，写入指定招呼语
- **隐私优先**：简历浏览器本地解析，不经过任何服务器

## 安装

1. 从 [Releases](https://github.com/piter902/JobMate/releases) 下载 `jobmate-0.1.0-chrome.zip` 并解压
2. 打开 Chrome → `chrome://extensions/` → 开启右上角「开发者模式」
3. 点击「加载已解压的扩展程序」→ 选择解压后的文件夹
4. 点击工具栏 **JobMate** 图标 → 填入 DeepSeek API Key → 上传简历

## 使用

### 生成招呼语

1. 打开 Boss 直聘任意职位页
2. 页面右上角出现 JobMate 浮动面板
3. 选择侧重点「通用」「技能」「经验匹配」「项目经历」
4. AI 分析匹配度并生成招呼语，自动复制到剪贴板
5. 点击「立即沟通」→ Ctrl+V 粘贴发送

### 查看历史

1. 在聊天页或任意职位页点击「查历史招呼语 →」
2. 有缓存直接展示，无缓存用历史 JD 重新生成
3. 无 JD 则提示先到职位详情页生成一次

### 切换简历

1. 点击工具栏 JobMate 图标
2. 上传多份简历（PDF / DOCX）
3. 点击某份简历即切换，重新生成时基于新简历

## 技术栈

- **框架**：WXT + React 18 + TypeScript
- **AI**：DeepSeek Chat API
- **简历解析**：pdfjs-dist（PDF）/ mammoth（DOCX）
- **存储**：chrome.storage.local + sessionStorage
- **统计**：PostHog

## 隐私说明

- 简历文件在浏览器本地解析为纯文本，不经过任何第三方服务器
- DeepSeek API Key 由用户自行提供，仅用于调用 DeepSeek API
- 生成招呼语时，简历文本和 JD 文本会发送到 DeepSeek 服务器
- PostHog 匿名统计仅记录生成次数及评分，不含简历和 JD 内容

## 开发

```bash
npm install        # 安装依赖
npm run dev        # 开发模式
npm run build      # 生产构建
npm run zip        # 打包
```

## 许可

MIT
