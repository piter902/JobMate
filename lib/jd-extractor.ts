// Two-stage F01: visible page text capped once, then local boundary extraction.
const START_PREFIX=['收藏','立即沟通','举报','微信扫码分享'];
function matchStart(parts:string[],index:number):number|null {
 if(!START_PREFIX.every((text,offset)=>parts[index+offset]===text))return null;
 let cursor=index+START_PREFIX.length;
 if(parts[cursor]==='不合适')cursor++;
 return parts[cursor]==='职位描述'?cursor+1:null;
}
const END=['去App','与BOSS随时沟通','前往App','与BOSS随时沟通','工作地址'];
export function getPageText():string {
 const root=document.querySelector('main, [role="main"], .main, .container') as HTMLElement|null;
 // Do not recapture diagnostic text as page input.
 const panels=Array.from(document.querySelectorAll<HTMLElement>('[data-jobmate-debug]'));
 const displays=panels.map(el=>el.style.display);
 try {
  panels.forEach(el=>{el.style.display='none';});
  return ((root||document.body).innerText||'').replace(/\r\n?/g,'\n').replace(/\n{3,}/g,'\n\n').trim().slice(0,4000);
 } finally {panels.forEach((el,i)=>{el.style.display=displays[i];});}
}
function extractByRuleA(pageText:string):string[] {
 const parts=pageText.replace(/\r\n?/g,'\n').split(/\n+/).map(s=>s.trim()).filter(Boolean);
 const at=(i:number,marker:string[])=>marker.every((v,n)=>parts[i+n]===v);
 const found:string[]=[];
 for(let start=5;start<parts.length;start++){
  const bodyStart=matchStart(parts,start);
  if(bodyStart===null)continue;
  let end=bodyStart;
  while(end<parts.length&&!at(end,END)&&matchStart(parts,end)===null)end++;
  if(!at(end,END)||end===bodyStart)continue;
  const address=parts[end+END.length];
  if(!address||['热门职位','热门城市','求职工具','查看更多信息','点击查看地图'].includes(address))continue;
  found.push([...parts.slice(start-5,start),'职位描述',...parts.slice(bodyStart,end),'工作地址',address].join('\n'));
 }
 return [...new Set(found)];
}
const DETAIL_STOPS=new Set(['竞争力分析','查看完整个人竞争力','BOSS 安全提示','BOSS安全提示','公司介绍','工商信息','更多职位','看过该职位的人还看了','精选职位','点击查看地图']);
const DETAIL_HEADERS=new Set(['招聘中','最新']);
function extractByRuleB(pageText:string):{texts:string[];reasons:string[]} {
 const parts=pageText.replace(/\r\n?/g,'\n').split(/\n+/).map(s=>s.trim()).filter(Boolean);
 const texts:string[]=[],reasons:string[]=[];
 const headers=parts.map((v,i)=>DETAIL_HEADERS.has(v)?i:-1).filter(i=>i>=0);
 if(!headers.length)reasons.push('规则B：未找到独立的“招聘中”或“最新”片段');
 for(const h of headers){
  const title=parts[h+1],meta=parts[h+2];
  const metaValid=meta&&/(经验不限|在校|应届|\d+\s*[-–至]\s*\d+年|\d+年以上)/.test(meta)&&/(本科|硕士|博士|大专|高中|中专|学历不限)/.test(meta)&&meta.trim().split(/\s+/).length>=3;
  if(!title||!metaValid){reasons.push('规则B：岗位头部或地点、经验、学历行不完整');continue;}
  const nextHeader=headers.find(i=>i>h)??parts.length;
  const relative=parts.slice(h+3,nextHeader).indexOf('职位描述');
  if(relative<0){reasons.push('规则B：岗位头部后未找到独立的“职位描述”');continue;}
  const start=h+3+relative+1;
  let end=start;
  while(end<nextHeader&&parts[end]!=='工作地址'&&!DETAIL_STOPS.has(parts[end]))end++;
  if(end===start||end===nextHeader){reasons.push('规则B：正文为空或缺少结束边界');continue;}
  const output=[title,meta,'职位描述',...parts.slice(start,end)];
  // Address may follow company information; do not include intervening modules.
  let addressIndex=-1;
  for(let i=end;i<nextHeader;i++){
   if(['更多职位','看过该职位的人还看了','精选职位','点击查看地图'].includes(parts[i]))break;
   if(parts[i]==='工作地址'){addressIndex=i;break;}
  }
  const address=addressIndex>=0?parts[addressIndex+1]:undefined;
  if(address&&!DETAIL_STOPS.has(address)&&!DETAIL_HEADERS.has(address)&&!['工作地址','职位描述'].includes(address)){
   output.push('工作地址',address);
   // Preserve the original layout's recruiter tail when explicitly bounded.
   if(addressIndex===end){
    const tailStart=end+2;let stop=tailStart;
    while(stop<nextHeader&&!DETAIL_STOPS.has(parts[stop])&&parts[stop]!=='工作地址')stop++;
    if(stop<nextHeader)output.push(...parts.slice(tailStart,stop));
   }
  }else if(addressIndex===end){reasons.push('规则B：工作地址标记后的地址片段缺失');continue;}
  texts.push(output.join('\n'));
 }
 return {texts:[...new Set(texts)],reasons};
}
function candidates(pageText:string):string[] {
 const a=extractByRuleA(pageText);
 // Preserve rule A ambiguity; never let rule B override multiple complete A blocks.
 return a.length?a:extractByRuleB(pageText).texts;
}
export function extractJDText(pageText:string):string|null {
 const found=candidates(pageText);return found.length===1?found[0]:null;
}
export function extractCurrentJD(pageText = getPageText()):{text:string;status:'valid'|'incomplete'|'missing'|'ambiguous';reason:string} {
 const found=candidates(pageText);
 if(found.length===1)return {text:found[0],status:'valid',reason:''};
 if(found.length>1)return {text:'',status:'ambiguous',reason:'文本中存在多个不同的完整岗位块，暂无法唯一确定当前岗位'};
 const evidence=/职位描述|工作职责|岗位职责|任职资格|任职要求|微信扫码分享|工作地址/.test(pageText);
 return evidence?{text:'',status:'incomplete',reason:'详情文本未按边界规则完整匹配，请等待详情加载后重试'}:
 {text:'',status:'missing',reason:'当前页面未找到岗位JD'};
}
export function extractJD():string|null {
 const result=extractCurrentJD();return result.status==='valid'?result.text:null;
}

// ---- 公司名 ----
export function extractCompany(): string {
  // .boss-info-attr（列表页 + 详情页通用），去掉后缀如" · hr"
  for (const el of document.querySelectorAll('.boss-info-attr, .boss-name')) {
    const raw = trimField(el.textContent || '');
    const text = raw.split('·')[0].trim(); // "大族数控 · hr" → "大族数控"
    if (text.length >= 2 && text.length <= 50) return text;
  }
  return '';
}

// ---- 岗位名 ----
export function extractJobTitle(): string {
  const text=extractJDText(getPageText());
  if(text)return text.split('\n')[0];
  // 聊天页
  for (const el of document.querySelectorAll('.position-name')) {
    const text = trimField(stripSalary(el.textContent || ''));
    if (text.length >= 2 && text.length <= 60) return text;
  }
  // 详情页: .job-title
  for (const el of document.querySelectorAll('.job-title')) {
    const text = trimField(stripSalary(el.textContent || ''));
    if (text.length >= 2 && text.length <= 60) return text;
  }
  // 详情页 h1
  for (const el of document.querySelectorAll('h1')) {
    const text = trimField(stripSalary(el.textContent || ''));
    if (text.length >= 2 && text.length <= 60) return text;
  }
  // 列表页: .job-name
  for (const el of document.querySelectorAll('.job-name')) {
    const text = trimField(stripSalary(el.textContent || ''));
    if (text.length >= 2 && text.length <= 60) return text;
  }
  return '';
}

// ---- 发布人 ----
export function extractBossName(): string {
  // 聊天页: 从 .position-name 定位当前对话区域
  const pos = document.querySelector('.position-name');
  if (pos) {
    let el: Element | null = pos.parentElement;
    for (let i = 0; i < 6 && el; i++) {
      const nameEl = el.querySelector('.name-text');
      if (nameEl) {
        const text = trimField(nameEl.textContent || '');
        if (text.length >= 2 && text.length <= 20) return text;
      }
      el = el.parentElement;
    }
  }
  // 详情/列表页: .name-text（HR 的名字）
  for (const el of document.querySelectorAll('.name-text')) {
    const text = trimField(el.textContent || '');
    if (text.length >= 2 && text.length <= 20) return text;
  }
  return '';
}

// ---- 工具 ----
function stripSalary(text: string): string {
  return text.replace(/\s*\d{1,3}-\d{1,3}[kK](\s*·\s*\d+薪)?/, '').replace(/\s*\d{1,2}[kK]-\d{1,2}[kK]/, '').trim();
}

function trimField(text: string): string {
  return text.replace(/&[a-z]+;/gi, '').replace(/[\t  　]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
}

export function diagnoseJDBoundaries(pageText:string):string[] {
 const parts=pageText.replace(/\r\n?/g,'\n').split(/\n+/).map(s=>s.trim()).filter(Boolean);
 const matches=(marker:string[])=>parts.map((_,i)=>i).filter(i=>marker.every((v,n)=>parts[i+n]===v));
 const starts=parts.map((_,i)=>i).filter(i=>matchStart(parts,i)!==null),ends=matches(END);
 const notes=['起始完整标记：'+starts.length+'组；尾部完整标记：'+ends.length+'组'];
 if(!starts.length)notes.push('起始标记未连续匹配，请核对收藏、立即沟通、举报、微信扫码分享、可选的不合适、职位描述的文字和顺序');
 if(!ends.length)notes.push('尾部标记未连续匹配，请核对去App、与BOSS随时沟通、前往App、与BOSS随时沟通、工作地址');
 for(const start of starts){
  if(start<5)notes.push('起始标记前不足5个非空片段');
  const bodyStart=matchStart(parts,start)!;
  const end=ends.find(i=>i>=bodyStart);
  if(end===undefined)notes.push('起始标记后没有完整尾部标记');
  else {
   if(end===bodyStart)notes.push('两组标记之间没有正文');
   if(!parts[end+END.length])notes.push('工作地址后没有地址片段');
   if(starts.some(i=>i>start&&i<end))notes.push('尾部标记前又遇到另一组起始标记');
  }
 }
 const a=extractByRuleA(pageText);
 if(a.length)notes.push('规则A：'+a.length+'个完整候选');
 else {
  const b=extractByRuleB(pageText);
  notes.push('规则B：'+b.texts.length+'个完整候选');
  if(!b.texts.length)notes.push(...b.reasons);
 }
 if(pageText.length===4000)notes.push('第一次读取已达到4000字符上限');
 return notes;
}
