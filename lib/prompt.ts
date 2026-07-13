import type { FocusOption } from './types';

const FOCUS_INSTRUCTIONS: Record<FocusOption, string> = {
  none: '',
  experience: '重点突出简历中与 JD 要求年限、行业背景、岗位类型最匹配的经历。',
  skills: '重点突出简历中与 JD 要求技术栈、工具、语言等技能标签的匹配。',
  projects: '重点突出简历中与 JD 描述业务场景最相关的项目。',
};

const SYSTEM_PROMPT = `你是一个专业的求职助手。根据用户的简历和职位描述，生成一段简短的招呼语（用于招聘平台首次沟通）。要求：
1. 50-150字
2. 语气专业但不生硬
3. 突出简历与JD的匹配点
4. 不用"您好，我是XXX"开头（平台会自动显示姓名）
5. 不要编造简历里没有的内容`;

export function buildSystemPrompt(focus: FocusOption): string {
  const instruction = FOCUS_INSTRUCTIONS[focus];
  if (!instruction) return SYSTEM_PROMPT;
  return `${SYSTEM_PROMPT}\n\n${instruction}`;
}

export function buildUserPrompt(resumeText: string, jdText: string, focus: FocusOption): string {
  const labels: Record<FocusOption, string> = {
    none: '无侧重',
    experience: '侧重经验匹配',
    skills: '侧重技能',
    projects: '侧重项目经历',
  };

  return `## 我的简历
${resumeText || '（未提供简历，请仅根据职位描述生成）'}

## 职位描述
${jdText}

## 侧重点
${labels[focus]}

请生成招呼语：`;
}
