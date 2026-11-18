export function normalizeGreeting(text:string):string {
 const normalized=text.replace(/\r\n?/g,'\n')
  // Decode literal escapes only before list markers; preserve other backslashes.
  .replace(/\\r\\n(?=\s*\d{1,2}[.、．）)](?!\d))/g,'\n')
  .replace(/\\n(?=\s*\d{1,2}[.、．）)](?!\d))/g,'\n');
 // Only sequential list markers at sentence/line boundaries are repaired.
 // Do not split decimals, dates, versions or numbers such as 10+.
 const pattern=/(^|[。！？!?；;\n])([ \t]*)(\d{1,2})[.、．）)](?!\d)[ \t]*/g;
 const markers=[...normalized.matchAll(pattern)];
 const sequential=markers.length>0&&markers.every((m,i)=>Number(m[3])===i+1);
 const repaired=sequential?normalized.replace(pattern,(_m,boundary,_space,n)=>boundary+(boundary&&boundary!=='\n'?'\n':'')+n+'. '):normalized;
 return repaired.split('\n').map(line=>line.trim()).join('\n').trim();
}
export function inspectGreeting(raw:string,allowGeneric=false,repair=true):{text:string;errors:string[];warnings:string[]} {
 const text=repair?normalizeGreeting(raw):raw.replace(/\r\n?/g,'\n').trim(),lines=text.split('\n').filter(Boolean),errors:string[]=[],warnings:string[]=[];
 if(!text)return {text,errors:['招呼语为空'],warnings};
 const numbered=lines.filter(l=>/^\d+\.\s*/.test(l));
 if(!numbered.length&&!allowGeneric)errors.push('未按分点格式生成，可重新生成');
 if(numbered.length){
  if(/^\d+\./.test(lines[0]))errors.push('缺少开头介绍');
  const start=lines.findIndex(l=>/^\d+\./.test(l));
  if(lines.slice(start).some(l=>!/^\d+\./.test(l)))errors.push('每条优势需单独一行');
  const content=numbered.map((l,i)=>{const m=l.match(/^(\d+)\.\s*(.*)$/)!;if(Number(m[1])!==i+1)errors.push('编号需从1开始连续排列');if(!m[2])errors.push('存在空条目');return m[2];});
  if(new Set(content).size!==content.length)errors.push('优势条目重复');
  if(content.some(t=>(t.match(/[。！？!?]/g)||[]).length>1))errors.push('每条优势应为一句话');
  if(numbered.length>4)warnings.push('建议优势不超过4条');
  if(content.some(t=>Array.from(t).length>45))warnings.push('部分优势超过45字，建议精简');
 }
 const count=Array.from(text.replace(/\s/g,'')).length;
 if(count>160)warnings.push('建议总长度100–150字，证据不足时可更短');
 if(count>180)warnings.push('总长度超过180字，建议重新生成精简版本');
 return {text,errors:[...new Set(errors)],warnings};
}
