export interface ResumeLine { text: string; standalone: boolean; fontSize: number|null; boldRatio: number|null; page: number; region: string }
export type HeadingDecision = {kind:'confirmed';title:string}|{kind:'candidate';title:string;reasons:string[]}|{kind:'body'};
const titles=new Set(('个人信息 基本信息 个人简介 求职意向 教育背景 教育经历 学习经历 工作经历 工作经验 实习经历 实习经验 实践经历 社会实践 校园经历 校园实践 校园活动 学生工作 社团经历 志愿经历 项目经历 项目经验 科研经历 科研成果 研究经历 竞赛经历 专业技能 个人技能 技能特长 技术技能 语言能力 技能证书 资格证书 获奖情况 获奖经历 荣誉奖项 自我评价 个人优势').split(' '));
export function classifyHeading(line:ResumeLine):HeadingDecision {
 const title=line.text.replace(/\s+/gu,'');
 if(!line.standalone)return {kind:'body'};
 if(/^[\u4e00-\u9fff]{2,5}$/.test(title))return {kind:'confirmed',title};
 const semantic=titles.has(title)||/^[\u4e00-\u9fff]{2,12}(经历|经验|背景|技能|证书|评价|荣誉|奖项|成果|实践|活动|能力|简介|意向)$/.test(title);
 return semantic?{kind:'candidate',title,reasons:['独立行命中标题词表或结尾词，但不符合2–5个汉字条件']}:{kind:'body'};
}
export interface ResumeTrace { line: ResumeLine; decision: HeadingDecision }
export function formatResumeLines(lines:ResumeLine[],warnings:string[],trace?:ResumeTrace[]):string {
 return lines.map(l=>{
 const d=classifyHeading(l);
 trace?.push({line:l,decision:d});
 if(d.kind==='candidate')warnings.push('第'+l.page+'页待检查标题“'+d.title+'”：'+d.reasons.join('；'));
 return d.kind==='confirmed'?'【'+d.title+'】':d.kind==='candidate'?d.title:l.text;
 }).join('\n');
}
