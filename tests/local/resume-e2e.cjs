const fs=require('node:fs'),crypto=require('node:crypto'),path=require('node:path');
const {chromium}=require('playwright');
const compact=s=>s.replace(/\s+/g,'');
const expected=['教育背景','校园经历','实习经历','技能证书','自我评价'];
const anchors={'教育背景':['管理科学与工程','主修课程'],'校园经历':['研究生会副主席','活动组织与执行'],'实习经历':['私域流量运营','库存管理'],'技能证书':['语言能力','学校证书']};
(async()=>{
 const {createServer}=await import('vite');const server=await createServer({configFile:false,resolve:{alias:{'@':process.cwd()}},optimizeDeps:{include:['jszip','pdfjs-dist','react','react-dom/client'],esbuild:{jsx:'automatic'}},server:{host:'127.0.0.1',port:0},logLevel:'error'});
 await server.listen();const browser=await chromium.launch();const results=[];
 const dir='tests/local/private';fs.mkdirSync(dir,{recursive:true});
 try{
 const page=await browser.newPage();await page.goto('http://127.0.0.1:'+server.httpServer.address().port+'/tests/local/fixtures/index.html');
 for(const ext of ['pdf','docx']){
 const file=path.join(dir,'judy.'+ext);if(!fs.existsSync(file))throw Error('缺少用户样例 '+file);
 const diagnostic=await page.evaluate(async ext=>{const {diagnoseResume}=await import('/lib/resume-parser.ts');const response=await fetch('/tests/local/private/judy.'+ext);if(!response.ok)throw Error('文件读取失败');return diagnoseResume(new File([await response.arrayBuffer()],'judy.'+ext));},ext);
 const checks=[];const check=(stage,name,pass,detail)=>checks.push({stage,name,pass,detail});
 const lines=diagnostic.trace;
 for(const title of expected){
 const found=lines.filter(t=>compact(t.line.text)===title);
 check('属性提取',title+'独立文字行',found.length===1,{count:found.length});
 if(found.length){const t=found[0];check('章节识别',title+'确认',t.decision.kind==='confirmed',t);}
 }
 const sections=[];let current={title:'前言',text:''};sections.push(current);
 for(const t of lines){if(t.decision.kind==='confirmed'){current={title:t.decision.title,text:''};sections.push(current);}else current.text+=t.line.text+'\n';}
 check('章节识别','五章顺序且不重复',JSON.stringify(sections.slice(1).map(s=>s.title))===JSON.stringify(expected),sections.map(s=>s.title));
 for(const [title,words]of Object.entries(anchors))for(const word of words){
 const owner=sections.filter(s=>compact(s.text).includes(compact(word))).map(s=>s.title);
 check('正文归属',word+'属于'+title,owner.includes(title),{owners:owner,note:'同一事实可在自我评价等章节合法重复；检查目标章节包含，不假定关键词全篇唯一'});
 }
 check('最终字符串','类型为string',typeof diagnostic.result.text==='string');
 check('最终字符串','仅添加章节标记不丢弃文字',compact(diagnostic.result.text.replace(/^【([^】]+)】$/gm,'$1'))===compact(lines.map(t=>t.line.text).join('')));
 await page.evaluate(()=>{
 window.saved={};window.chrome={storage:{local:{get:async key=>({[key]:window.saved[key]}),set:async values=>Object.assign(window.saved,values)}},runtime:{getURL:()=>''}};
 document.body.innerHTML='<div id="root"></div>';
 });
 await page.addScriptTag({type:'module',url:'/tests/local/settings-entry.tsx?format='+ext});
 await page.locator('input[type=file]').setInputFiles(file);
 await page.getByLabel('简历文本预览').waitFor();
 const preview=await page.getByLabel('简历文本预览').inputValue();
 await page.getByRole('button',{name:'确认并保存简历',exact:true}).click();
 await page.getByText('简历已确认并保存',{exact:true}).waitFor();
 const stored=await page.evaluate(()=>window.saved.resumes[0].text);
 check('存储','实际样例预览确认后保存string',typeof stored==='string'&&stored===preview&&stored===diagnostic.result.text);
 fs.writeFileSync(path.join(dir,ext+'-stored.txt'),stored);
 await page.goto('http://127.0.0.1:'+server.httpServer.address().port+'/tests/local/fixtures/index.html');
 const record={file:'judy.'+ext,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),checks,sections,...diagnostic};
 fs.writeFileSync(path.join(dir,ext+'-diagnostics.json'),JSON.stringify(record,null,2));
 fs.writeFileSync(path.join(dir,ext+'-final.txt'),diagnostic.result.text);
 results.push({format:ext,passed:checks.filter(c=>c.pass).length,failed:checks.filter(c=>!c.pass).length,failures:checks.filter(c=>!c.pass)});
 console.log(ext+': '+results.at(-1).passed+' PASS / '+results.at(-1).failed+' FAIL');
 }
 }finally{await browser.close();await server.close();}
 fs.writeFileSync(path.join(dir,'e2e-summary.json'),JSON.stringify({time:new Date().toISOString(),scope:'Judy sample anchors and trace consistency; not an approved full-text gold standard',results},null,2));
 fs.writeFileSync(path.join(dir,'e2e-report.md'),'# 实际简历解析诊断\n\n'+results.map(r=>'## '+r.format+'\n'+r.passed+' PASS / '+r.failed+' FAIL\n'+r.failures.map(c=>'- '+c.stage+'：'+c.name).join('\n')).join('\n\n')+'\n\n完整正文金标尚未人工确认；当前仅验证代表性正文归属与文字保留，不能宣称全文无遗漏。');
 if(results.some(r=>r.failed))process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});
