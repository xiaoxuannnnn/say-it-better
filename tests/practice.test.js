import test from 'node:test';
import assert from 'node:assert/strict';
import { QUESTIONS } from '../src/questions.js';
import { filterQuestions, localStar, localResumeQuestions, speechText, readSaved } from '../src/lib/practice.js';
import handler, {validateInput,validateOutput} from '../api/practice.js';
test('all 50 original questions are retained and FMCG nests under Marketing',()=>{
  assert.equal(QUESTIONS.length,50);assert.equal(new Set(QUESTIONS.map(q=>q.q)).size,50);
  assert.equal(filterQuestions(QUESTIONS,'Marketing').length,23);
  assert.equal(filterQuestions(QUESTIONS,'Marketing','General Marketing').length,14);
  assert.equal(filterQuestions(QUESTIONS,'Marketing','Marketing-FMCG').length,9);
  assert.equal(QUESTIONS.some(q=>q.cat==='FMCG'),false);
});
test('interim speech is replaced by final results rather than duplicated',()=>{
  const final=Object.assign([{transcript:'I led the campaign.'}],{isFinal:true});
  const partial=Object.assign([{transcript:'We improved'}],{isFinal:false});
  assert.deepEqual(speechText([final,partial]),{final:'I led the campaign.',interim:'We improved'});
  const corrected=Object.assign([{transcript:'We improved sales by 15%.'}],{isFinal:true});
  assert.deepEqual(speechText([final,corrected]),{final:'I led the campaign. We improved sales by 15%.',interim:''});
});
test('local STAR preserves unsupported sentences and never invents a result',()=>{
  const value=localStar('Last year our team faced a tight deadline. My goal was to launch on time. I created a weekly plan. This is another detail.');
  assert.match(value.situation,/Last year/);assert.match(value.task,/My goal/);assert.match(value.action,/weekly plan/);
  assert.equal(value.result,'');assert.equal(value.rewritten,'');assert.ok(value.missing.some(x=>x.startsWith('Result')));assert.deepEqual(value.unassigned,['This is another detail.']);
});
test('hypothetical answer is flagged and numbers are preserved',()=>{
  const value=localStar('As a result, sales increased by 15.5%.','How would you launch a product?');
  assert.match(value.result,/15\.5%/);assert.ok(value.note);
});
test('resume questions quote actual experience and skip contact information',()=>{
  const resume='candidate@example.com\nI led a beverage launch campaign and coordinated three retail partners.\nI analyzed consumer interviews to improve our packaging strategy.';
  const questions=localResumeQuestions(resume,'Brand Manager');assert.equal(questions.length,4);
  for(const q of questions){assert.ok(resume.includes(q.source));assert.ok(!q.source.includes('@'));}
  assert.match(questions[1].q,/Brand Manager/);
});
test('malformed saved state cannot crash practice',()=>{
  assert.deepEqual(readSaved({getItem:()=>'{bad'}),[]);assert.deepEqual(readSaved({getItem:()=>'{}'}),[]);assert.deepEqual(readSaved({getItem:()=>'["good",null,4]'}),['good']);
});
test('AI input limits and generated resume citations are enforced',()=>{
  assert.ok(validateInput({action:'star',text:'a'.repeat(8001)}));assert.ok(validateInput({action:'resume',text:'abc'}));
  assert.equal(validateInput({action:'resume',text:'Relevant experience '.repeat(3)}),null);
  const questions=[{q:'What did you do?',source:'invented employer',framework:'STAR',starter:'I...',expressions:[]}];
  assert.equal(validateOutput('resume',{questions},'actual employer'),false);
});
function response(){return {code:200,headers:{},setHeader(k,v){this.headers[k]=v;},status(x){this.code=x;return this;},json(x){this.body=x;return this;}};}
test('unconfigured API is explicit and rejects cross-origin requests',async()=>{
  const saved=process.env.OPENAI_API_KEY;delete process.env.OPENAI_API_KEY;
  try {
    let res=response();await handler({method:'GET',headers:{}},res);assert.equal(res.body.available,false);
    res=response();await handler({method:'POST',headers:{},body:{action:'star',text:'I led a project last year.'}},res);assert.equal(res.code,503);
    res=response();await handler({method:'POST',headers:{origin:'https://unrelated.example',host:'say-it-better.example'},body:{}},res);assert.equal(res.code,403);
  } finally {if(saved)process.env.OPENAI_API_KEY=saved;}
});
test('AI errors never expose upstream keys, and valid structured STAR is accepted',async()=>{
  const fetchBefore=global.fetch,keyBefore=process.env.OPENAI_API_KEY;process.env.OPENAI_API_KEY='unit-test-not-a-real-key';
  const expected={situation:'A launch.',task:'Deliver it.',action:'I led it.',result:'',rewritten:'I led a launch.',missing:['What was the result?'],note:''};
  try {
    global.fetch=async(url,options)=>{const body=JSON.parse(options.body);assert.equal(body.response_format.type,'json_schema');return {ok:true,json:async()=>({choices:[{finish_reason:'stop',message:{content:JSON.stringify(expected)}}]})};};
    let res=response();await handler({method:'POST',headers:{},body:{action:'star',text:'I led a launch.'}},res);assert.equal(res.code,200);assert.equal(res.body.mode,'ai');
    global.fetch=async()=>({ok:false,status:401});res=response();await handler({method:'POST',headers:{},body:{action:'star',text:'I led a launch.'}},res);assert.equal(res.code,502);assert.ok(!JSON.stringify(res.body).includes('unit-test'));
  } finally {global.fetch=fetchBefore;if(keyBefore)process.env.OPENAI_API_KEY=keyBefore;else delete process.env.OPENAI_API_KEY;}
});
test('quota errors are distinguished from temporary rate limits without exposing provider details',async()=>{
  const oldFetch=global.fetch,oldKey=process.env.OPENAI_API_KEY;process.env.OPENAI_API_KEY='unit-test-key';
  try {
    for(const [code,expected] of [['insufficient_quota','AI_QUOTA_EXCEEDED'],['credit_balance_exhausted','AI_QUOTA_EXCEEDED'],['rate_limit_exceeded','AI_RATE_LIMITED']]){
      global.fetch=async()=>({ok:false,status:429,json:async()=>({error:{code,message:'private provider details'}})});
      const res=response();await handler({method:'POST',headers:{'x-forwarded-for':'quota-test'},body:{action:'star',text:'I led a launch last year.'}},res);
      assert.equal(res.code,429);assert.equal(res.body.code,expected);assert.ok(!JSON.stringify(res.body).includes('private provider details'));
    }
  }finally{global.fetch=oldFetch;if(oldKey)process.env.OPENAI_API_KEY=oldKey;else delete process.env.OPENAI_API_KEY;}
});
