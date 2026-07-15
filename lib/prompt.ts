import type { FocusOption } from './types';

const FOCUS_INSTRUCTIONS: Record<FocusOption, string> = {
  none: '',
  experience: '重点提及简历中与JD匹配的工作年限、行业背景、岗位类型。',
  skills: '重点提及简历中与JD共同拥有的具体技术、工具、语言名称。',
  projects: '重点提及简历中与JD业务场景相关的具体项目经验。',
};

export function buildSystemPrompt(focus: FocusOption): string {
  const fi = FOCUS_INSTRUCTIONS[focus];
  const focusLine = fi ? `\n${fi}` : '';

  return `你是求职者，正在Boss直聘上给HR发送首次招呼语。

输出一个JSON对象（不要其他内容）：
{"greeting":"招呼语","score":85,"scoreReason":"一句话依据"}

规则（极其重要）：
- 你是求职者对着HR说话，语气礼貌自信，不是HR招人
- greeting只能使用简历中明确写出的信息，严禁编造任何技能、经验、项目
- 如果简历没有某项JD要求的能力，绝不在招呼语中提及
- 简历中未出现的关键词（工具名、技术名、公司名等），一概不提
- 如果简历内容很少，简短概括即可，不要脑补
- 50-150字，不用"您好，我是XXX"开头${focusLine}

score规则：
- 严格对照简历和JD，逐项比对技能、经验、学历
- 简历中缺乏的关键要求，每条扣10-20分
- 不要给虚高的分数`;
}

export function buildUserPrompt(resumeText: string, jdText: string, focus: FocusOption): string {
  const labels: Record<FocusOption, string> = {
    none: '通用',
    experience: '经验匹配',
    skills: '技能',
    projects: '项目经历',
  };

  return `【我的简历（只有这些是真实的）】
${resumeText || '（未提供简历）'}

【目标职位JD】
${jdText}

侧重点：${labels[focus]}`;
}

// 从页面文本提取信息并生成招呼语（一次调用）

// 从页面文本提取信息并生成招呼语（一次调用）
export function buildExtractAndGeneratePrompt(pageText: string, focus: FocusOption, resumeText: string): {
  system: string;
  user: string;
} {
  const focusMap: Record<FocusOption, string> = {
    none: '通用',
    experience: '经验匹配',
    skills: '技能',
    projects: '项目经历',
  };

  return {
    system: `你是求职者的AI助手。从Boss直聘页面提取信息，逐维度匹配JD和简历，生成招呼语。

返回JSON（不要任何其他内容）：
{
  "company": "公司/企业名称（如：阿里巴巴、华为技术、创远高新），不要填成岗位名",
  "jobTitle": "岗位名称（如：前端开发工程师、产品经理），不要填成公司名",
  "bossName": "HR/发布人姓名",
  "jdText": "JD原文截取",
  "dimensions": [
    {"requirement": "JD中明确列出的一个要求", "matched": true, "evidence": "简历中的匹配证据"},
    {"requirement": "JD中的另一个要求", "matched": false, "evidence": "简历中缺乏"}
  ],
  "score": 75,
  "matchedCount": 6,
  "totalCount": 8,
  "greeting": "招呼语",
  "scoreReason": "匹配6/8项。优势：xxx。短板：缺yyy"
}

===== 逐维度打分规则 =====

1. 从JD原文中提取每一条明确列出的任职要求，作为独立维度。
   包括：学历、专业、年限、每项技术/工具/语言、行业背景、
   每项软技能（沟通/文档/管理等）、证书资质、其他硬性条件。
   只提取JD中明确写出的，不编造维度。

2. 逐维度对比简历：
   - matched=true → evidence写"简历中：{具体匹配内容}"
   - matched=false → evidence写"简历中无此项"

3. 评分：score = round((matchedCount / totalCount) * 100)
   例如：8个维度中6个匹配 → 75分

4. 招呼语规则（极其重要）：
   - 你是求职者给HR发消息
   - 只提及 matched=true 的维度，绝口不提不匹配的
   - 简历中没有的能力/经验/技能，一个字都不准编造
   - 50-150字，不用"您好，我是XXX"开头
   - 侧重点"${focusMap[focus]}"：优先展开该维度

5. scoreReason格式："匹配X/Y项。优势：[关键匹配点]。短板：[关键缺失]"`,

    user: `【我的简历（只有这些是真实的，不能超出此范围）】
${resumeText || '（未提供简历）'}

【Boss直聘页面文本】
${pageText.slice(0, 4000)}

侧重点：${focusMap[focus]}

请逐维度对比分析，生成招呼语。`,
  };
}
