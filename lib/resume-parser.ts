import type { ResumeTrace } from './resume-headings';
import { normalizeSections, orderPDFWords, validateResumeText } from './resume-layout';
export interface ParseResult { text: string; fileName: string; warnings: string[] }
function result(raw: string, fileName: string, extra: string[] = []): ParseResult {
 const text=normalizeSections(raw);
 return {text,fileName,warnings:[...extra,...validateResumeText(text)]};
}
export async function parsePDF(file: File, trace?: ResumeTrace[]): Promise<ParseResult> {
 const pdfjsLib=await import('pdfjs-dist');
 const worker=await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
 pdfjsLib.GlobalWorkerOptions.workerSrc=worker.default;
 const pdf=await pdfjsLib.getDocument({data:await file.arrayBuffer()}).promise;
 const pages:string[]=[];
 const warnings:string[]=[];
 try {
  for(let i=1;i<=pdf.numPages;i++){
   const page=await pdf.getPage(i),content=await page.getTextContent();
   const words=content.items.filter(item=>'str' in item).map(item=>{
    if(!('str' in item))throw new Error('Invalid text item');
    return {str:item.str,x:item.transform[4],y:item.transform[5],width:item.width,height:Math.abs(item.height)||10,bold:/bold|黑体/i.test((content.styles[item.fontName]?.fontFamily || '')+' '+item.fontName)?true:undefined};
   });
   pages.push(orderPDFWords(words,page.getViewport({scale:1}).width,warnings,i,trace));
  }
 } finally {await pdf.destroy();}
 return result(pages.join('\n\n'),file.name,[...warnings,'PDF按独立行与字数识别章节；复杂版式和短公司名请核对']);
}
export async function parseDocx(file: File, trace?: ResumeTrace[]): Promise<ParseResult> {
 const {readDocx}=await import('./resume-docx');
 const warnings:string[]=[];
 const text=await readDocx(await file.arrayBuffer(),warnings,trace);
 return result(text,file.name,warnings);
}
export async function parseResume(file: File): Promise<ParseResult> {
 const ext=file.name.split('.').pop()?.toLowerCase();
 if(ext==='pdf')return parsePDF(file);
 if(ext==='docx')return parseDocx(file);
 throw new Error('请上传 PDF 或 DOCX 文件');
}

// Diagnostics are opt-in; normal parsing and stored text retain their existing shape.
export async function diagnoseResume(file:File) {
 const trace:ResumeTrace[]=[];
 const ext=file.name.split('.').pop()?.toLowerCase();
 if(ext!=='pdf'&&ext!=='docx')throw new Error('诊断仅支持PDF/DOCX，旧DOC需先转换');
 const result=ext==='pdf'?await parsePDF(file,trace):await parseDocx(file,trace);
 return {result,trace};
}
