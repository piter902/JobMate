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
    system: `你是求职者的AI助手。从Boss直聘页面文本中提取关键信息，并生成招呼语。

返回JSON（不要其他内容）：
{
  "company": "公司名称",
  "jobTitle": "岗位名称",
  "bossName": "HR/发布人姓名",
  "jdText": "职位描述原文（从页面文本中截取，不要修改）",
  "greeting": "招呼语文字",
  "score": 85,
  "scoreReason": "评分依据"
}

规则：
- company/jobTitle/bossName: 从页面文本中识别，找不到就填空字符串""
- jdText: 原文截取任职要求/岗位职责/职位描述部分，不改动文字
- greeting: 你是求职者给HR发消息,50-150字,只用简历中的真实信息,不编造
- score: 0-100,综合技能/经验/学历匹配度
- scoreReason: 一句话`,

    user: `【我的简历】
${resumeText || '（未提供）'}

【Boss直聘页面文本】
${pageText.slice(0, 4000)}

侧重点：${focusMap[focus]}`,
  };
}
