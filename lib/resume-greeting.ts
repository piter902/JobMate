import type { GreetingResult } from './types';

// Only explicitly marked skills are used; never infer skills from projects or a JD.
export function generateResumeGreeting(resume: string): GreetingResult {
  if (!resume.trim()) throw new Error('请先上传并选择当前简历');
  const lines = resume.split(/\r?\n/);
  const skills: string[] = [];
  let inSkills = false;
  for (const line of lines) {
    const heading = line.match(/^\s*(?:【([^】]+)】|(?:专业技能|技能清单|技术技能|技能|Skills)[:：]?)\s*(.*)$/i);
    if (heading) {
      inSkills = /专业技能|技能清单|技术技能|^技能$|^Skills$/i.test(heading[1] || line.replace(/[:：].*$/, '').trim());
      if (inSkills && heading[2].trim()) skills.push(heading[2].trim());
      continue;
    }
    if (/^\s*(?:教育经历|教育背景|实习经历|工作经历|项目经历|个人项目|自我评价|获奖经历|证书)[:：]?\s*$/.test(line)) inSkills = false;
    if (inSkills && line.trim()) skills.push(line.trim());
  }
  const text = skills.join('；').trim();
  return {
    greeting: text ? '您好，我的简历中列出的技能包括：' + text + '。希望有机会进一步交流，谢谢！'
      : '您好，希望有机会了解贵公司的招聘机会并进一步交流，我可以提供简历供您参考，谢谢！',
    score: null,
    scoreReason: '',
  };
}
