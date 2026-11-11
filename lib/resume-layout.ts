export interface PDFWord { str: string; x: number; y: number; width: number; height: number; bold?: boolean }
import { formatResumeLines, type ResumeTrace, type ResumeLine } from './resume-headings';
// Formatting only: never infer new sections at save time.
export function normalizeSections(raw:string):string {
 return raw.replace(/\r/g,'').split('\n').map(l=>l.trim()).join('\n').replace(/\n{3,}/g,'\n\n').trim();
}
export function validateResumeText(text: string): string[] {
 const warnings:string[]=[];
 if(!text.trim()) return ['未提取到文本；扫描版PDF需要先进行文字识别或手动粘贴文本'];
 if(!/【[^】]+】/.test(text)) warnings.push('未识别到章节，请在预览中补充【专业技能】【实习经历】【项目经历】等标题');
 if(text.includes('�')) warnings.push('检测到无法识别的字符，请对照原文件修正');
 return warnings;
}
export function orderPDFWords(words: PDFWord[], width: number, warnings: string[] = [], page = 1, trace?:ResumeTrace[]): string {
 const items=words.filter(w=>w.str.trim());
 // A persistent empty gutter identifies two columns; full-width headings stay above columns.
 const candidates=Array.from({length:9},(_,i)=>width*(0.3+i*0.05));
 let split=0, best=0;
 for(const x of candidates) {
  const left=items.filter(w=>w.x+w.width<x-8),right=items.filter(w=>w.x>x+8);
  const crossing=items.filter(w=>w.x<x+8 && w.x+w.width>x-8);
  const score=Math.min(left.length,right.length);
  if(score>=3 && crossing.length<=1 && score>best){best=score;split=x;}
 }
 const rows=(group:PDFWord[])=>{
  const sorted=[...group].sort((a,b)=>b.y-a.y || a.x-b.x);
  const lines:PDFWord[][]=[];
  for(const item of sorted){
   const row=lines.find(r=>Math.abs(r[0].y-item.y)<=Math.max(2,Math.min(r[0].height,item.height)*0.35));
   if(row)row.push(item);else lines.push([item]);
  }
  const reconstructed:ResumeLine[]=lines.map(row=>{
   row.sort((a,b)=>a.x-b.x);
   const text=row.map((w,i,all)=>i?(w.x-all[i-1].x-all[i-1].width>Math.max(2,w.height*0.2)?' ':'')+w.str:w.str).join('');
   const count=row.reduce((n,w)=>n+w.str.trim().length,0)||1;
   const known=row.every(w=>w.bold!==undefined);
   return {text,standalone:true,fontSize:row.reduce((n,w)=>n+w.height*w.str.trim().length,0)/count,boldRatio:known?row.reduce((n,w)=>n+(w.bold?w.str.trim().length:0),0)/count:null,page,region:String(group[0]?.x||0)};
  });
  return formatResumeLines(reconstructed,warnings,trace);
 };
 if(!split)return rows(items);
 const crossing=items.filter(w=>w.x<split+8&&w.x+w.width>split-8);
 // If a spanning item is inside the column body, reading order is uncertain: preserve rows for manual review.
 const top=crossing.length?Math.min(...crossing.map(w=>w.y)):Infinity;
 if(items.some(w=>!crossing.includes(w)&&w.y>top))return rows(items);
 return [rows(crossing),rows(items.filter(w=>!crossing.includes(w)&&w.x<split)),rows(items.filter(w=>!crossing.includes(w)&&w.x>=split))].filter(Boolean).join('\n');
}
