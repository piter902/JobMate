const fs=require('node:fs'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{
 const {createServer}=await import('vite');
 const server=await createServer({configFile:false,resolve:{alias:{'@':process.cwd()}},optimizeDeps:{include:['react','react-dom/client','jszip','pdfjs-dist']},esbuild:{jsx:'automatic'},server:{host:'127.0.0.1',port:0},logLevel:'error'});
 await server.listen();const port=server.httpServer.address().port;
 const browser=await chromium.launch();const page=await browser.newPage();const records=[];
 try{
 await page.goto('http://127.0.0.1:'+port+'/tests/local/fixtures/index.html');
 for(const name of ['single.pdf','columns.pdf','sections.docx']){
 const actual=await page.evaluate(async name=>{
  const {parseResume}=await import('/lib/resume-parser.ts');
  const data=await (await fetch('/tests/local/fixtures/'+name)).arrayBuffer();
  return parseResume(new File([data],name));
 },name);
 assert.equal(typeof actual.text,'string');
 assert.ok(actual.text.includes('React'));
 if(name==='sections.docx')assert.ok(/^【专业技能】$/m.test(actual.text));
 assert.ok(actual.warnings.length>0);
 records.push({name,actual,passed:true});console.log('PASS f04-'+name);
 }
 await page.addInitScript(()=>{
 window.saved={};
 window.chrome={storage:{local:{get:async key=>({[key]:window.saved[key]}),set:async values=>Object.assign(window.saved,values)}},runtime:{getURL:()=>''}};
 });
 await page.reload();
 await page.evaluate(()=>{document.body.innerHTML='<div id="root"></div>';});
 await page.addScriptTag({type:'module',url:'/tests/local/settings-entry.tsx'});
 await page.locator('input[type=file]').setInputFiles('tests/local/fixtures/sections.docx');
 await page.getByLabel('简历文本预览').waitFor();
 assert.equal(await page.evaluate(()=>window.saved.resumes),undefined);
 await page.getByRole('button',{name:'取消',exact:true}).click();
 assert.equal(await page.evaluate(()=>window.saved.resumes),undefined);
 await page.locator('input[type=file]').setInputFiles('tests/local/fixtures/sections.docx');
 await page.getByLabel('简历文本预览').fill('【专业技能】\nReact\n【项目经历】\n人工确认的项目内容');
 await page.getByRole('button',{name:'确认并保存简历',exact:true}).click();
 await page.getByText('简历已确认并保存',{exact:true}).waitFor();
 const stored=await page.evaluate(()=>window.saved.resumes[0]);
 assert.equal(typeof stored.text,'string');assert.ok(stored.text.includes('人工确认的项目内容'));
 console.log('PASS f04-preview-cancel-edit-save');records.push({name:'preview-cancel-edit-save',stored,passed:true});
 const validation=await page.evaluate(async()=>{const m=await import('/lib/resume-layout.ts');return {empty:m.validateResumeText(''),unknown:m.normalizeSections('其他信息\n原始内容')};});
 assert.ok(validation.empty.length);assert.equal(validation.unknown,'其他信息\n原始内容');console.log('PASS f04-empty-and-unknown');
 }finally{await browser.close();await server.close();}
 fs.writeFileSync('tests/local/f04-results.json',JSON.stringify({kind:'real PDF/DOCX synthetic fixtures, real parser in headless browser',records},null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
