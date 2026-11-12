const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),esbuild=require('esbuild');
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
(async()=>{
 const key=process.env.DEEPSEEK_API_KEY;
 if(!key){console.error('未设置 DEEPSEEK_API_KEY；未发起请求。');process.exitCode=2;return;}
 const dir='tests/local/private/f05-live',fixture=path.join(dir,'input.json');
 fs.mkdirSync(dir,{recursive:true});
 const input=fs.existsSync(fixture)?JSON.parse(fs.readFileSync(fixture,'utf8')):{
 source:'Judy解析文本；JD为固定合成测试岗位，不代表真实招聘',resume:fs.readFileSync('tests/local/private/docx-stored.txt','utf8'),
 jd:'测试公司 产品运营实习生。岗位职责：协助内容运营、活动执行和数据复盘。任职要求：具备活动组织经验，了解私域运营，能够使用Excel进行数据整理，具备跨部门协作能力。',focus:'none'};
 const built=esbuild.buildSync({entryPoints:['lib/deepseek.ts','lib/greeting-format.ts'],bundle:true,write:false,outdir:'unused',platform:'node',format:'cjs'});
 const modules=built.outputFiles.map(f=>{const m={exports:{}};new Function('module','exports','require',f.text)(m,m.exports,require);return m.exports;});
 const api=modules.find(m=>m.extractAndGenerate),format=modules.find(m=>m.inspectGreeting);
 const record={time:new Date().toISOString(),route:'extractAndGenerate',input,inputHash:hash(JSON.stringify(input)),requestCount:0,requests:[],responses:[],factReview:{status:'pending_manual_review',note:'请逐条核对简历证据、岗位相关性、熟练程度与到岗信息'}};
 const output=path.join(dir,record.time.replace(/[:.]/g,'-')+'.json');
 const originalFetch=global.fetch,originalConsole={log:console.log,group:console.group,groupEnd:console.groupEnd};
 const start=performance.now();
 global.fetch=async(url,options)=>{
 if(record.requestCount>=1)throw Error('测试限制：最多一次API调用，禁止重试或额外请求');
 record.requestCount++;
 record.requests.push({url:String(url),payload:JSON.parse(options.body)});
 const t=performance.now();
 try{const response=await originalFetch(url,options);record.responses.push({httpStatus:response.status,elapsedMs:Math.round(performance.now()-t),rawBody:await response.clone().text()});return response;}
 catch(e){record.responses.push({elapsedMs:Math.round(performance.now()-t),error:e.message});throw e;}
 };
 try{
 console.log=()=>{};console.group=()=>{};console.groupEnd=()=>{};
 record.parsed=await api.extractAndGenerate(key,input.resume,input.jd,input.focus);
 }catch(e){record.error=e.message.replaceAll(key,'[REDACTED]');}
 finally{global.fetch=originalFetch;Object.assign(console,originalConsole);}
 try{
 const envelope=JSON.parse(record.responses[0].rawBody);record.usage=envelope.usage;
 record.rawContent=envelope.choices?.[0]?.message?.content;
 const match=record.rawContent?.match(/\{[\s\S]*\}/);
 const modelOutput=JSON.parse(match?.[0]||'');record.modelOutput=modelOutput;
 record.rawGreeting=modelOutput.greeting;
 record.checks={
 jsonValid:true,
 fieldsValid:typeof modelOutput.greeting==='string'&&typeof modelOutput.jdText==='string'&&typeof modelOutput.score==='number'&&Array.isArray(modelOutput.dimensions),
 rawFormat:typeof modelOutput.greeting==='string'?format.inspectGreeting(modelOutput.greeting,false,false):null,
 displayFormat:record.parsed?format.inspectGreeting(record.parsed.greeting):null
 };
 }catch(e){record.checks={jsonValid:false,error:e.message};}
 record.totalMs=Math.round(performance.now()-start);
 record.summary={requestCount:record.requestCount,apiSucceeded:!!record.parsed,rawFormatPassed:!!record.checks.rawFormat&&!record.checks.rawFormat.errors.length,formatPassed:!!record.checks.displayFormat&&!record.checks.displayFormat.errors.length,factsVerified:false};
 fs.writeFileSync(output,JSON.stringify(record,null,2).replaceAll(key,'[REDACTED]'));
 console.log('API调用次数：'+record.requestCount+'；结果：'+output);
 if(record.error||!record.checks.fieldsValid||!record.summary.formatPassed)process.exitCode=1;
})().catch(e=>{console.error(e.message);process.exitCode=1});
