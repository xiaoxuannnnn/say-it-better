import test from 'node:test';
import assert from 'node:assert/strict';
import {readHistory,writeHistory,upsertHistory,polishedSections,HISTORY_KEY} from '../src/lib/history.js';
const first={id:'one',createdAt:'2026-10-07T10:00:00Z',question:{q:'Describe your project.'},answer:'I led a launch.',star:null};
test('draft and AI result update one attempt and survive reload',()=>{
 const store=new Map();const storage={getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)};
 let records=upsertHistory([],first);
 records=upsertHistory(records,{...first,createdAt:'2026-10-07T10:05:00Z',star:{situation:'A launch.',task:'Lead it.',action:'I led it.',result:'',mode:'ai'}});
 assert.equal(records.length,1);assert.equal(records[0].createdAt,first.createdAt);
 writeHistory(storage,records);assert.deepEqual(readHistory(storage),records);assert.ok(store.has(HISTORY_KEY));
});
test('separate attempts on the same question are retained, newest first',()=>{
 const records=upsertHistory([first],{...first,id:'two',createdAt:'2026-10-07T11:00:00Z'});
 assert.equal(records.length,2);assert.equal(records[0].id,'two');
 assert.equal(upsertHistory(records,{...first,id:'empty',answer:'  '}).length,2);
});
test('storage errors are exposed and corrupted history does not crash',()=>{
 assert.deepEqual(readHistory({getItem:()=>'{broken'}),[]);
 assert.deepEqual(readHistory({getItem:()=>'[null,{"id":"bad"}]'}),[]);
 assert.throws(()=>writeHistory({setItem(){throw new Error('quota');}},[first]),/quota/);
});
test('polished prose is labeled in STAR order and missing facts stay empty',()=>{
 const sections=polishedSections({situation:'During my internship…',task:'My goal…',action:'I analyzed…',result:''});
 assert.deepEqual(sections.map(x=>x.key),['situation','task','action','result']);assert.equal(sections[3].text,'');
});
