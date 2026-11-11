const fs=require('fs'),ts=require('typescript'),assert=require('node:assert/strict');
const api={};new Function('exports',ts.transpileModule(fs.readFileSync('lib/resume-headings.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText)(api);
const base={text:'教育背景',standalone:true,fontSize:14,boldRatio:1,page:1,region:'body'};
const cases=[
 ['unknown-strong',{text:'成长足迹'},'confirmed'],
 ['spaced',{text:'教 育 背 景'},'confirmed'],
 ['dictionary-plain',{fontSize:10,boldRatio:0},'confirmed'],
 ['dictionary-bold-only',{fontSize:10},'confirmed'],
 ['dictionary-large-only',{boldRatio:0},'confirmed'],
 ['unknown-short-plain',{text:'甲乙公司',fontSize:10,boldRatio:0},'confirmed'],
 ['inline',{text:'教育背景 北京某大学'},'body'],
 ['not-standalone',{standalone:false},'body'],
 ['unknown-bold',{boldRatio:null,fontSize:10},'confirmed'],
 ['unknown-bold-large',{boldRatio:null},'confirmed'],
 ['long-semantic',{text:'专业技能与资格证书'},'candidate'],
 ['inline-brackets',{text:'【研究方向】：农业分析'},'body'],
 ['unformatted-brackets',{text:'【教育背景】',fontSize:10,boldRatio:0},'body'],
];
for(const [id,changes,expected]of cases){assert.equal(api.classifyHeading({...base,...changes}).kind,expected,id);console.log('PASS f04-rule-'+id);}
const warnings=[];const text=api.formatResumeLines([{...base},{...base,text:'本科学习内容',fontSize:10,boldRatio:0},{...base,text:'科研足迹'},{...base,text:'科研项目内容',fontSize:10,boldRatio:0}],warnings);
assert.equal(text,'【教育背景】\n本科学习内容\n【科研足迹】\n科研项目内容');
console.log('PASS f04-rule-section-boundaries');
