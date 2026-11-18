const fs=require('fs'),ts=require('typescript'),assert=require('node:assert/strict');
const m={};new Function('exports',ts.transpileModule(fs.readFileSync('lib/greeting-format.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText)(m);
const expected='你好，我是测试用户。\n1. 熟悉用户访谈。\n2. 能够分析问卷数据。';
// This file only covers the literal escape regression shown in the screenshot.
const escaped=expected.replace(/\n/g,'\\n');
assert.equal(m.normalizeGreeting(escaped),expected);
assert.equal(m.normalizeGreeting(expected.replace(/\n/g,'\\r\\n')),expected);
assert.equal(m.normalizeGreeting(m.normalizeGreeting(escaped)),expected);
assert.deepEqual(m.inspectGreeting(escaped).errors,[]);
console.log('PASS f05-literal-newline normalization and idempotence');
const {chromium}=require('playwright'),esbuild=require('esbuild');
(async()=>{
 const built=esbuild.buildSync({stdin:{contents:"import React from 'react';import {createRoot} from 'react-dom/client';import App from './components/App';createRoot(document.getElementById('root')).render(<App/>);",resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,format:'iife',jsx:'automatic',alias:{'@':process.cwd()}});
 const browser=await chromium.launch();try{
 for(const mode of ['generate','session','history']){
 const page=await browser.newPage();await page.route('http://jobmate.test/**',r=>r.fulfill({body:'<html><body></body></html>',contentType:'text/html'}));await page.goto('http://jobmate.test/');
 await page.evaluate(({mode,raw})=>{
 document.body.innerHTML='<main style="white-space:pre-wrap"></main><div id="root"></div>';
 document.querySelector('main').textContent='测试岗位\n10-15K\n北京\n经验不限\n本科\n收藏\n立即沟通\n举报\n微信扫码分享\n职位描述\n负责用户研究，整理调研结果，开展问卷分析。\n去App\n与BOSS随时沟通\n前往App\n与BOSS随时沟通\n工作地址\n测试地址';
 const company=document.createElement('span');company.className='boss-info-attr';company.textContent='测试公司';document.body.append(company);
 window.saved={ga_history:[{company:'测试公司',jobTitle:'测试岗位',greeting:raw,score:88,time:0}]};window.copied='';window.calls=0;
 Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>{window.copied=text;}},configurable:true});
 window.chrome={storage:{local:{get:async key=>key==='deepseekApiKey'?{deepseekApiKey:'test'}:{[key]:window.saved[key]},set:async v=>Object.assign(window.saved,v)},onChanged:{addListener(){},removeListener(){}}},runtime:{sendMessage:async()=>{window.calls++;return {result:{company:'测试公司',jobTitle:'测试岗位',jdText:'固定测试岗位描述，用于验证换行，不访问网络。',greeting:raw,score:88,scoreReason:''}}}}};
 if(mode==='session')sessionStorage.setItem('ga_result',JSON.stringify({greeting:raw,score:88,scoreReason:''}));
 },{mode,raw:expected.replace(/\n/g,'\\n')});
 await page.addScriptTag({content:built.outputFiles[0].text});
 if(mode==='generate')await page.getByRole('button',{name:'通用',exact:true}).click();
 if(mode==='history')await page.getByRole('button',{name:'查历史招呼语 →'}).click();
 const greeting=page.getByText(expected,{exact:true});await greeting.waitFor();
 await page.getByRole('button',{name:/复制|已复制/}).click();
 assert.equal(await page.evaluate(()=>window.copied),expected);assert.equal(await greeting.textContent(),expected);assert.equal(await greeting.evaluate(el=>getComputedStyle(el).whiteSpace),'pre-wrap');assert.equal(await page.getByText('未按分点格式生成，可重新生成',{exact:true}).count(),0);
 if(mode!=='history')assert.equal(await page.evaluate(()=>JSON.parse(sessionStorage.getItem('ga_result')).greeting),expected);
 if(mode==='generate')assert.equal(await page.evaluate(()=>window.saved.ga_history[0].greeting),expected);
 assert.equal(await page.evaluate(()=>window.calls),mode==='generate'?1:0);
 console.log('PASS f05-app-'+mode+' display/copy/cache');await page.close();
 }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
