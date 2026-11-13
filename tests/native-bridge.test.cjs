const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const {buildSync} = require('esbuild');
const path = require('node:path');
const code = buildSync({entryPoints:[path.join(__dirname,'../src/native-bridge.ts')],bundle:true,write:false,format:'iife'}).outputFiles[0].text;
function harness(create) {
  const responses = [];
  let handler;
  const window = {Translator:{create},addEventListener(type,fn){handler=fn},postMessage(data){responses.push(data)}};
  vm.runInNewContext(code,{window,location:{origin:'https://x.com'},Error,Set,Number});
  return {responses,async send(text,id='1',origin='https://x.com') {
    handler({source:window,origin,data:{type:'__XCN_NATIVE_REQ_V2',id,action:'translate',text}});
    for(let i=0;i<5;i++) await new Promise(resolve=>setImmediate(resolve));
    return responses.find(x=>x.id===id&&'ok' in x);
  }};
}
test('fixed Chinese for short words; reuse model; preserve literals and blank lines',async()=>{
  const calls=[]; let created=0;
  const h=harness(async options=>{
    created++;assert.equal(options.sourceLanguage,'zh');assert.equal(options.targetLanguage,'en');
    return {translate:async text=>{calls.push(text);return {'喜欢':'Like','我不喜欢':'I do not like it','有指南吗？':'Is there a guide?'}[text]||text}};
  });
  assert.equal((await h.send('喜欢')).result,'Like');
  assert.equal((await h.send('我不喜欢\n\n@OpenAI 有指南吗？ https://example.com/ #AI','2')).result,'I do not like it\n\n@OpenAI Is there a guide? https://example.com/ #AI');
  assert.equal(created,1); assert.deepEqual(calls,['喜欢','我不喜欢','有指南吗？']);
});
test('a failed model initialization can retry without caching a rejection',async()=>{
  let attempts=0;const h=harness(async()=>{if(++attempts===1)throw new Error('download failed');return {translate:async()=> 'Like'};});
  assert.equal((await h.send('喜欢')).ok,false);
  assert.equal((await h.send('喜欢','2')).result,'Like');assert.equal(attempts,2);
});
test('ignore foreign-origin and oversized requests',async()=>{
  let called=0;const h=harness(async()=>{called++;return {translate:async()=> 'x'};});
  assert.equal(await h.send('喜欢','1','https://other.example'),undefined);
  assert.equal(await h.send('中'.repeat(451),'2'),undefined);assert.equal(called,0);
});
