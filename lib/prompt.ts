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

  return `输出一个JSON对象（不要其他内容）：
{"greeting":"招呼语","score":85,"scoreReason":"一句话依据"}

规则（极其重要）：
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

  return `【简历内容（只有这些是真实的，不能超出）】
${resumeText || '（未提供简历）'}

【职位JD】
${jdText}

侧重点：${labels[focus]}`;
}
