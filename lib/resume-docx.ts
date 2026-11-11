import JSZip from 'jszip';
import {formatResumeLines,type ResumeTrace,type ResumeLine} from './resume-headings';
const W='http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const children=(el:Element|null,name:string)=>el?Array.from(el.children).filter(e=>e.namespaceURI===W&&e.localName===name):[];
const child=(el:Element|null,name:string)=>children(el,name)[0]||null;
const val=(el:Element|null)=>el?.getAttributeNS(W,'val')??null;
const parse=(text:string)=>new DOMParser().parseFromString(text,'application/xml');
export async function readDocx(buffer:ArrayBuffer,warnings:string[],trace?:ResumeTrace[]):Promise<string>{
 const zip=await JSZip.loadAsync(buffer);
 const source=zip.file('word/document.xml');if(!source)throw new Error('DOCX缺少正文');
 const doc=parse(await source.async('string'));
 const stylesText=await zip.file('word/styles.xml')?.async('string');
 const styles=stylesText?parse(stylesText):null;
 const styleMap=new Map(Array.from(styles?.getElementsByTagNameNS(W,'style')||[]).map(e=>[e.getAttributeNS(W,'styleId')||'',e]));
 type Props={size:number|null;bold:boolean|null};
 const props=(r:Element|null):Partial<Props>=>{
 const b=child(r,'b'),sz=val(child(r,'sz'));const out:Partial<Props>={};
 if(b)out.bold=!['0','false','off'].includes(val(b)||'true');
 if(sz&&Number(sz)>0)out.size=Number(sz)/2;return out;
 };
 const resolve=(id:string|null,seen=new Set<string>()):Partial<Props>=>{
 if(!id||seen.has(id))return {};seen.add(id);const s=styleMap.get(id)||null;
 return {...resolve(val(child(s,'basedOn')),seen),...props(child(s,'rPr'))};
 };
 const defaults=props(styles?.getElementsByTagNameNS(W,'rPrDefault')[0]?.getElementsByTagNameNS(W,'rPr')[0]||null);
 const defaultStyle=Array.from(styleMap.values()).find(e=>e.getAttributeNS(W,'type')==='paragraph'&&e.getAttributeNS(W,'default')==='1');
 // Select one compatibility branch, preventing duplicate DrawingML/VML text boxes.
 for(const alt of Array.from(doc.getElementsByTagName('*')).filter(e=>e.localName==='AlternateContent')){
  const branch=Array.from(alt.children).find(e=>e.localName==='Choice')||Array.from(alt.children).find(e=>e.localName==='Fallback');
  alt.replaceWith(...Array.from(branch?.childNodes||[]));
 }
 const paragraphs=Array.from(doc.getElementsByTagNameNS(W,'p'));
 const lines:ResumeLine[]=[];
 for(const p of paragraphs){
  const ppr=child(p,'pPr');
  const base={size:null,bold:null,...defaults,...resolve(val(child(ppr,'pStyle'))||defaultStyle?.getAttributeNS(W,'styleId')||null)};
  const segments:{text:string;size:number|null;bold:boolean|null}[][]=[[]];
  for(const run of Array.from(p.getElementsByTagNameNS(W,'r')).filter(r=>r.closest('p')===p)){
   const rp=child(run,'rPr');const fmt={...base,...resolve(val(child(rp,'rStyle'))),...props(rp)};
   for(const node of Array.from(run.children)){
    if(node.localName==='t')segments[segments.length-1].push({text:node.textContent||'',...fmt});
    if(['br','cr','tab'].includes(node.localName))segments.push([]);
   }
  }
  const nonempty=segments.filter(seg=>seg.some(s=>s.text.trim()));
  for(const seg of nonempty){
   const text=seg.map(s=>s.text).join('').trim();const n=seg.reduce((n,s)=>n+s.text.trim().length,0)||1;
   lines.push({text,standalone:nonempty.length===1,fontSize:seg.every(s=>s.size!==null)?seg.reduce((n,s)=>n+s.size!*s.text.trim().length,0)/n:null,boldRatio:seg.every(s=>s.bold!==null)?seg.reduce((n,s)=>n+(s.bold?s.text.trim().length:0),0)/n:null,page:1,region:'body'});
  }
 }
 warnings.push('DOCX按段落和样式继承识别；浮动文本框的视觉阅读顺序请在预览核对');
 return formatResumeLines(lines,warnings,trace);
}
