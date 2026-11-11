const fs=require('node:fs'), assert=require('node:assert/strict');
const esbuild=require('esbuild');
const {chromium}=require('playwright');
(async()=>{
 const built=await esbuild.build({stdin:{contents:"import React from 'react';import {createRoot} from 'react-dom/client';import App from './components/App';createRoot(document.getElementById('root')).render(React.createElement(App));",resolveDir:process.cwd()},bundle:true,write:false,format:'iife',jsx:'automatic',alias:{'@':process.cwd()},plugins:[{name:'offline',setup(build){build.onLoad({filter:/lib\/(history|analytics)\.ts$/},()=>({contents:"export const track=()=>{}; export const findMatch=()=>{throw Error('History must not be read')}; export const saveGreeting=()=>{};",loader:'js'}));}}]});
 const browser=await chromium.launch();const page=await browser.newPage();await page.route('http://jobmate.test/**',route=>route.fulfill({body:'<html><body></body></html>',contentType:'text/html'}));const records=[];
 try{
 for(const mode of ['success','error','history']){
 await page.goto('http://jobmate.test/');
 await page.setContent('<main>聊天页，没有职位详情</main><div id="root"></div>');
 await page.evaluate(mode=>{window.calls=[];window.chrome={storage:{local:{get:async()=>({deepseekApiKey:'test'})},onChanged:{addListener(){},removeListener(){}}},runtime:{sendMessage:async m=>{window.calls.push(m);await new Promise(r=>setTimeout(r,150));return mode==='error'?{error:'请先上传简历'}:{result:{greeting:'固定技能招呼语',score:null,scoreReason:''}}}}};sessionStorage.clear();},mode);
 await page.addScriptTag({content:built.outputFiles[0].text});
 const button=mode==='history'?page.getByRole('button',{name:'查历史招呼语 →'}):page.getByRole('button',{name:'通用',exact:false}).first();
 if(mode==='history')await button.click();else {const buttons=page.locator('button');let clicked=false;for(let i=0;i<await buttons.count();i++){const text=await buttons.nth(i).innerText();if(text.includes('通用')){await buttons.nth(i).click();clicked=true;break;}}assert.ok(clicked,'generate button found');}
 await page.locator('[data-testid="jd-missing-notice"]').waitFor();
 await page.waitForTimeout(250);
 assert.equal(await page.locator('[data-testid="jd-missing-notice"]').count(),1);
 assert.ok((await page.locator('body').innerText()).includes('不进行岗位匹配评分'));
 assert.ok(!(await page.locator('body').innerText()).includes('匹配度'));
 const calls=await page.evaluate(()=>window.calls);assert.deepEqual(calls,[{type:'GENERATE_RESUME_GREETING'}]);
 if(mode==='error')assert.ok((await page.locator('body').innerText()).includes('请先上传简历'));
 else assert.ok((await page.locator('body').innerText()).includes('未获取 JD · 基于简历技能生成'));
 records.push({mode,calls,passed:true});console.log('PASS f03-'+mode);
 }
 }finally{await browser.close();}
 fs.writeFileSync('tests/local/f03-results.json',JSON.stringify({kind:'real React App, synthetic DOM, mocked chrome runtime; no API',records},null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
