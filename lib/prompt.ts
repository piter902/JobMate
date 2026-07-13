import type { FocusOption } from './types';

const FOCUS_INSTRUCTIONS: Record<FocusOption, string> = {
  none: '',
  experience: '打招呼时重点突出简历与JD在年限、行业背景、岗位类型上的匹配。',
  skills: '打招呼时重点突出简历与JD在技术栈、工具、语言上的匹配。',
  projects: '打招呼时重点突出简历与JD在业务场景、项目方向上的匹配。',
};

function buildSystemPrompt(focus: FocusOption): string {
  const fi = FOCUS_INSTRUCTIONS[focus];
  const focusLine = fi ? `\n${fi}` : '';

  return `你是招聘求职助手。基于简历和JD，输出一个JSON对象，不要输出任何其他内容。

{
  "greeting": "招呼语文字",
  "score": 85,
  "scoreReason": "关键匹配点或明显短板"
}

字段说明：
- greeting: 用于Boss直聘首次沟通的招呼语,50-150字,语气专业自然
- score: 0-100整数,综合技能/经验/学历匹配度
- scoreReason: 一句话核心依据${focusLine}

只输出JSON,不要markdown代码块,不要解释。`;
}

function buildUserPrompt(resumeText: string, jdText: string, focus: FocusOption): string {
  const labels: Record<FocusOption, string> = {
    none: '通用',
    experience: '经验匹配',
    skills: '技能',
    projects: '项目经历',
  };

  return `简历：
${resumeText || '（未提供）'}

JD：
${jdText}

侧重点：${labels[focus]}`;
}

export { buildSystemPrompt, buildUserPrompt };
