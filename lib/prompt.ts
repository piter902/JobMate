import type { FocusOption } from './types';

const FOCUS_INSTRUCTIONS: Record<FocusOption, string> = {
  none: '',
  experience: '重点突出简历中与 JD 要求年限、行业背景、岗位类型最匹配的经历。',
  skills: '重点突出简历中与 JD 要求技术栈、工具、语言等技能标签的匹配。',
  projects: '重点突出简历中与 JD 描述业务场景最相关的项目。',
};

const SYSTEM_PROMPT = `你是一个专业的求职助手。根据用户的简历和职位描述，生成一段简短的招呼语，并评估匹配度。

你必须严格返回以下JSON格式，不要包含任何其他内容：
{"greeting":"招呼语内容","score":85,"scoreReason":"一句话说明匹配/不匹配的关键点"}

要求：
1. greeting: 50-150字，语气专业但不生硬，突出简历与JD的匹配点，不用"您好，我是XXX"开头
2. score: 0-100的整数，综合评估技能、经验、学历、行业匹配度
3. scoreReason: 一句话，说明打分的核心依据（关键优势或明显短板）
4. 不要编造简历里没有的内容`;

export function buildSystemPrompt(focus: FocusOption): string {
  const instruction = FOCUS_INSTRUCTIONS[focus];
  if (!instruction) return SYSTEM_PROMPT;
  return `${SYSTEM_PROMPT}\n\n${instruction}`;
}

export function buildUserPrompt(resumeText: string, jdText: string, focus: FocusOption): string {
  const labels: Record<FocusOption, string> = {
    none: '通用',
    experience: '经验匹配',
    skills: '技能',
    projects: '项目经历',
  };

  return `## 我的简历
${resumeText || '（未提供简历）'}

## 职位描述
${jdText}

## 侧重点
${labels[focus]}`;
}
