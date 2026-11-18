const fs=require('fs'),assert=require('node:assert/strict'),ts=require('typescript'),esbuild=require('esbuild');
const {chromium}=require('playwright');
const compile=f=>ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const START='收藏\n立即沟通\n举报\n微信扫码分享\n职位描述';
const END='去App\n与BOSS随时沟通\n前往App\n与BOSS随时沟通\n工作地址';
const duties=['参与政府、高校项目申报、流程跟踪、验收等工作','按照公司的项目开发需求，组织制定项目开发计划，跟踪从项目启动到量产的所有相关事宜','监督项目的执行，协调研发团队内部的合作，确保项目进度和质量','负责流程制度优化及细节推进','领导安排的其他工作任务'];
const requirements=['3年以上项目管理或研发质量管理经验优先，本科及以上学历，机械、计算机等相关专业','有政府和高校项目对接经验者优先，独立完成流程设计与主持组织改进的经验优先','精通项目管理、质量管理工具和方法','具备良好的沟通能力和团队合作精神，善于协调和解决项目中遇到的问题','熟悉项目管理专业知识，掌握质量、成本、进度管理知识，具备优秀的计划和执行能力、协调能力和沟通能力','熟悉风险管理流程和解决问题的流程'];
const header='项目管理(J10000)\n-K\n广州\n3-5年\n本科';
const body=['设备研发','研发项目管理','工作职责:',...duties.map((s,i)=>(i+1)+'、'+s+'；'),'任职资格:',...requirements.map((s,i)=>(i+1)+'、'+s+'；'),'纪女士','在线','广州数控 · 招聘专员'].join('\n');
const address='广州黄埔区广州数控设备有限公司22号';
const block=[header,START,body,END,address].join('\n');
const input='首页\n职位\n公司\n控制器项目经理\n广汽集团\n其他岗位列表\n'+block+'\n点击查看地图\n热门职位\n广州天猫运营招聘';
const expected=[header,'职位描述',body,'工作地址',address].join('\n');
(async()=>{
 const browser=await chromium.launch(),page=await browser.newPage(),records=[];
 await page.route('http://jobmate.test/**',r=>r.fulfill({body:'<html><body></body></html>',contentType:'text/html'}));
 const source=compile('lib/jd-extractor.ts');
 const ai=JSON.parse(fs.readFileSync('tests/local/f01-ai-assistant.json','utf8'));
 const detail=JSON.parse(fs.readFileSync('tests/local/f01-detail-page.json','utf8'));
 const latest=JSON.parse(fs.readFileSync('tests/local/f01-detail-latest.json','utf8'));
 const fixtures=[
 ['13-detail-latest-late-address',latest.input,'valid',latest.expected],
 ['11-ai-assistant-optional-control',ai.input,'valid',ai.expected],
 ['12-detail-page-instruction-following',detail.input,'valid',detail.expected],
 ['01-user-sample',input,'valid',expected],
 ['02-blank-lines',input.replace(/\n/g,'\n\n'),'valid',expected],
 ['03-multiple-dom',input,'valid',expected],
 ['04-start-missing',block.replace('微信扫码分享\n',''),'incomplete',null],
 ['05-end-missing',block.replace('前往App\n',''),'incomplete',null],
 ['06-header-short',['项目名称','薪资','地点','学历',START,body,END,address].join('\n'),'incomplete',null],
 ['07-address-missing',[header,START,body,END].join('\n'),'incomplete',null],
 ['08-two-blocks',block+'\n'+block.replace('项目管理(J10000)','另一个岗位'),'ambiguous',null],
 ['09-no-jd','聊天内容，没有职位详情','missing',null],
 ];
 try{
 for(const [id,input,status,text]of fixtures){
 await page.goto('http://jobmate.test/');
 await page.evaluate(({input,id})=>{
 const main=document.createElement('main');main.style.whiteSpace='pre-wrap';main.textContent=input;
 if(id==='03-multiple-dom'){main.className='job-detail';const nested=document.createElement('div');nested.className='detail-content';nested.textContent='';main.append(nested);}
 document.body.append(main);
 },{input,id});
 const actual=await page.evaluate(source=>{const exports={};new Function('exports',source)(exports);return {read:exports.getPageText(),result:exports.extractCurrentJD(),text:exports.extractJDText(exports.getPageText()),diagnostics:exports.diagnoseJDBoundaries(exports.getPageText())};},source);
 let error=null;try{assert.equal(actual.result.status,status);assert.equal(actual.text,text);if(id==='13-detail-latest-late-address'){assert.ok(actual.diagnostics.includes('规则B：1个完整候选'));for(const noise of ['竞争力分析','BOSS 安全提示','公司介绍','工商信息','更多职位','VDE'])assert.ok(!actual.text.includes(noise),noise);}if(id==='12-detail-page-instruction-following'){assert.ok(actual.read.length<=4000);assert.ok(actual.read.includes('工作地址\n北京东城区新世界中心写字楼A座716'));assert.equal(actual.result.text,detail.expected);assert.ok(actual.diagnostics.includes('规则B：1个完整候选'));for(const noise of ['公司基本信息','竞争力分析','BOSS 安全提示','公司介绍','工商信息','更多职位','看过该职位的人还看了','精选职位','jubao@kanzhun.com'])assert.ok(!actual.text.includes(noise),noise);}if(id==='11-ai-assistant-optional-control'){assert.ok(actual.diagnostics[0].includes('起始完整标记：1组；尾部完整标记：1组'));assert.ok(!actual.text.includes('不合适'));}if(text){assert.ok(!text.includes('广汽集团'));assert.ok(!text.includes('热门职位'));}}catch(e){error=e.message;}
 records.push({id,input,expected:{status,text},actual,error});console.log((error?'FAIL ':'PASS ')+id);
 }
 // Real App -> captured runtime message -> actual prompt builder, without a network call.
 await page.goto('http://jobmate.test/');
 await page.evaluate(input=>{document.body.innerHTML='<main style="white-space:pre-wrap"></main><div id="root"></div>';document.querySelector('main').textContent=input+'\n'+'尾部噪声'.repeat(1100);window.calls=[];window.chrome={storage:{local:{get:async()=>({deepseekApiKey:'test'})},onChanged:{addListener(){},removeListener(){}}},runtime:{sendMessage:async m=>{window.calls.push(m);return {error:'test stop after message capture'};}}};},input);
 const built=esbuild.buildSync({stdin:{contents:"import React from 'react';import {createRoot} from 'react-dom/client';import App from './components/App';createRoot(document.getElementById('root')).render(<App/>);",resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,format:'iife',jsx:'automatic',alias:{'@':process.cwd()}});
 await page.addScriptTag({content:built.outputFiles[0].text});await page.getByRole('button',{name:'通用',exact:true}).click();await page.waitForFunction(()=>window.calls.length===1);
 const actual=await page.evaluate(({source,prompt})=>{const ex={},pr={};new Function('exports',source)(ex);new Function('exports',prompt)(pr);return {read:ex.getPageText(),calls:window.calls,user:pr.buildExtractAndGeneratePrompt(window.calls[0].pageText,'none','固定测试简历').user};},{source,prompt:compile('lib/prompt.ts')});
 let error=null;try{assert.equal(actual.read.length,4000);assert.equal(actual.calls[0].type,'EXTRACT_AND_GENERATE');assert.equal(actual.calls[0].pageText,expected);assert.ok(actual.user.includes(expected));assert.ok(!actual.user.includes('其他岗位列表'));}catch(e){error=e.message;}
 records.push({id:'10-app-message-prompt',expected,actual,error});console.log((error?'FAIL ':'PASS ')+'10-app-message-prompt');
 }finally{await browser.close();}
 fs.writeFileSync('tests/local/f01-results.json',JSON.stringify({kind:'boundary extraction plus real App message capture; no API',records},null,2));
 if(records.some(r=>r.error))process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});
