# JobMate · 个人改进版

基于 [piter902/JobMate](https://github.com/piter902/JobMate) 二次开发的 AI 求职辅助 Chrome 扩展，采用 WXT、React 和 TypeScript 构建，接入 DeepSeek，帮助求职者整理简历、分析岗位要求并生成个性化招呼语。

本版本重点改进招聘职位描述（JD）提取、简历解析与编辑确认流程，完善 JD 缺失时的处理逻辑，并优化招呼语展示格式。

> 本仓库为个人维护的 Fork。原作者 Releases 中的安装包不包含本仓库的新增改动，体验本版本请从本仓库源码构建。

## 核心功能

- **简历管理**：支持 PDF/DOCX 简历解析，以及解析结果的预览、编辑与确认保存。
- **岗位信息提取**：从招聘页面文本中识别和提取有效 JD。
- **岗位匹配分析**：结合当前简历与有效 JD，调用 DeepSeek 生成匹配分析。
- **招呼语生成**：根据简历和岗位信息生成个性化招呼语，以“一句介绍＋编号优势”的格式展示。

## 相对原项目的改进

### 1、招聘 JD 提取

新增列表详情页与独立职位详情页的 JD 识别规则，过滤无关页面信息，减少模型输入中的冗余内容，降低 token 消耗。

### 2、JD 缺失处理

当前页面未提取到有效 JD 时：

- 提示用户当前缺少有效岗位信息。
- 不复用历史 JD。
- 不进行岗位匹配评分。
- 仅根据当前简历中的技能生成招呼语。

### 3、简历解析与编辑确认

改进 PDF/DOCX 的阅读顺序、章节识别和正文归属，保留纯文本及章节标记。

上传简历后，用户可以预览解析结果、编辑内容并确认保存，便于在分析前检查和修正解析偏差。

### 4、招呼语展示

采用“一句介绍＋编号优势”的格式，每点独占一行，便于阅读、检查和复制使用。
<img width="1609" height="873" alt="打招呼效果" src="https://github.com/user-attachments/assets/31e6e9fd-d803-407a-a2b6-a45cbb33b498" />


## 技术栈

| 技术                                    | 用途           |
| ------------------------------------- | ------------ |
| WXT                                   | 浏览器扩展开发与构建   |
| React                                 | 扩展界面开发       |
| TypeScript                            | 类型检查与代码组织    |
| DeepSeek Chat API                     | 岗位匹配分析与招呼语生成 |
| pdfjs-dist                            | PDF 简历解析     |
| mammoth                               | DOCX 简历解析    |
| chrome.storage.local / sessionStorage | 用户本地数据与会话存储  |

## 安装与开发

### 下载

> 请前往 [Releases](https://github.com/JudyLeeRun/JobMate/releases) 下载最新版本 `jobmate-0.2.0-chrome.zip`。

### 加载到 Chrome

1. 打开 `chrome://extensions/`。
2. 开启右上角的“开发者模式”。
3. 点击“加载已解压的扩展程序”。
4. 选择构建生成的 Chrome 扩展目录，具体路径以构建输出为准。
5. 点击工具栏中的 JobMate 图标，配置自己的 DeepSeek API Key。

### 常用开发命令

```bash
npm run dev      # 启动开发模式
npm run build    # 生产构建
npm run zip      # 打包扩展
```

## 使用流程

1. 打开扩展，配置 DeepSeek API Key。
2. 上传 PDF 或 DOCX 简历。
3. 预览解析结果，按需编辑并确认保存。
4. 打开 Boss 直聘职位页面，在 JobMate 面板中发起分析与生成。
5. 检查匹配分析和招呼语，确认符合真实经历后再使用。

未提取到有效 JD 时，扩展会提示用户，不进行匹配评分，并仅基于当前简历的技能生成招呼语。

## 验证

已针对部分 JD 提取场景、简历doc和pdf文件开展本地测试，并进行真实 DeepSeek 调用验证。

## 隐私与数据处理

- 简历文件在浏览器本地解析。
- 调用 DeepSeek 进行分析或生成时，相关简历文本和 JD 文本会发送至 DeepSeek 服务。
- DeepSeek API Key 由用户自行提供。
- 沿用原项目 PostHog 统计相关说明

## 问题反馈

欢迎通过本仓库的 [Issues](https://github.com/JudyLeeRun/JobMate/issues) 反馈问题或提出建议。

反馈时请尽量提供：

- 浏览器及扩展版本。
- 复现步骤。
- 预期结果与实际结果。
- 已脱敏的截图或页面文本。

请勿上传真实简历、API Key 或其他个人敏感信息。

## 项目来源与许可

本项目基于 [piter902/JobMate](https://github.com/piter902/JobMate) 二次开发，感谢原作者的开源贡献。本 README 的“相对原项目的改进”部分说明本 Fork 的主要修改。

原项目采用 MIT 许可证。请保留原有许可证与版权声明，具体条款以仓库中的 LICENSE 文件为准。
