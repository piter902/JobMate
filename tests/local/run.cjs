const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const compile = file => ts.transpileModule(fs.readFileSync(file, 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
(async () => {
 const browser = await chromium.launch({headless:true});
 const page = await browser.newPage();
 const source = compile('lib/jd-extractor.ts');
 const prompt = compile('lib/prompt.ts');
 const jd = '岗位职责：负责React前端页面开发和维护。任职要求：熟悉TypeScript、React和浏览器基础，能够独立完成页面开发、联调和问题排查。';
 const detail = text => '<div class="job-detail"><div class="job-sec-text">'+text+'</div></div>';
 const cases = [
  {id:'clean',html:detail(jd),status:'valid',text:jd},
  {id:'noise',html:'<nav>导航噪声</nav><aside>'+detail('推荐其他岗位')+'</aside><div class="message-list">'+detail('历史聊天')+'</div>'+detail(jd),status:'valid',text:jd},
  {id:'long',html:detail(jd+'完整岗位内容'.repeat(900)+'末尾要求标记'),status:'valid',tail:'末尾要求标记'},
  {id:'missing',html:'<main>聊天页面，没有职位详情</main>',status:'missing'},
  {id:'short',html:detail('任职要求：React'),status:'incomplete'},
  {id:'collapsed',html:'<section>'+detail(jd)+'<button>展开更多</button></section>',status:'incomplete'},
  {id:'multiple',html:detail(jd)+detail(jd+'另一岗位'),status:'ambiguous'},
  {id:'hidden',html:'<div style="display:none">'+detail('旧岗位')+'</div>'+detail(jd),status:'valid',text:jd},
 ];
 const records=[];
 try {
  for(const c of cases) {
   await page.setContent(c.html);
   const actual = await page.evaluate(({source,prompt})=>{
    const exports={}; new Function('exports',source)(exports);
    const result=exports.extractCurrentJD();
    const prompts={};new Function('exports',prompt)(prompts);
    return {result,user:result.status==='valid'?prompts.buildExtractAndGeneratePrompt(result.text,'none','固定测试简历：React和TypeScript个人项目。').user:null};
   },{source,prompt});
   let error=null;
   try {assert.equal(actual.result.status,c.status);if(c.text) assert.equal(actual.result.text,c.text);if(c.tail) assert.ok(actual.user.includes(c.tail));}
   catch(e){error=e.message;}
   records.push({id:c.id,input:c.html,expected:c.status,actual,error});
   console.log((error?'FAIL':'PASS')+' '+c.id);
  }
 } finally {await browser.close();}
 fs.writeFileSync(path.join(__dirname,'results.json'),JSON.stringify({time:new Date().toISOString(),kind:'synthetic DOM, real extractor and prompt; no API calls',records},null,2));
 if(records.some(r=>r.error)) process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});
