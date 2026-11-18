const fs=require('node:fs'), ts=require('typescript'), assert=require('node:assert/strict');
const moduleExports={};
new Function('exports',ts.transpileModule(fs.readFileSync('lib/resume-greeting.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(moduleExports);
const cases=[
 {id:'marked-skills',resume:'【专业技能】React、TypeScript\n【项目经历】Java项目',includes:'React、TypeScript',excludes:'Java'},
 {id:'plain-skills',resume:'专业技能：React\nTypeScript\n项目经历\nJava',includes:'React',excludes:'Java'},
 {id:'no-skills',resume:'【项目经历】Java项目',excludes:'Java'},
];
const records=cases.map(c=>{const actual=moduleExports.generateResumeGreeting(c.resume);assert.equal(actual.score,null);assert.equal(actual.scoreReason,'');if(c.includes)assert.ok(actual.greeting.includes(c.includes));assert.ok(!actual.greeting.includes(c.excludes));console.log('PASS '+c.id);return {...c,actual};});
assert.throws(()=>moduleExports.generateResumeGreeting(''),/上传/);
console.log('PASS empty-resume');
fs.writeFileSync('tests/local/f02-results.json',JSON.stringify({kind:'local deterministic skills greeting; no API calls',records},null,2));
