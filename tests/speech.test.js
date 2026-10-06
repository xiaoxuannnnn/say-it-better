import test from 'node:test';
import assert from 'node:assert/strict';
import React, {act} from 'react';
import {create} from 'react-test-renderer';
import {useSpeech} from '../src/lib/useSpeech.js';
global.IS_REACT_ACT_ENVIRONMENT=true;
class MockSpeech {
  static instance;
  constructor(){MockSpeech.instance=this;}
  start(){this.onstart?.();}
  stop(){this.onend?.();}
  abort(){this.aborted=true;this.onend?.();}
}
test('speech lifecycle preserves final and interim captions, finishes once, and cancels safely on question change',async()=>{
  global.window={SpeechRecognition:MockSpeech};let speech;const finished=[];
  function Harness(){speech=useSpeech(text=>finished.push(text));return null;}
  let root;await act(()=>{root=create(React.createElement(Harness));});
  await act(()=>speech.start('en-US'));assert.equal(speech.recording,true);
  const result=Object.assign([{transcript:'I led the project.'}],{isFinal:true});
  const interim=Object.assign([{transcript:'Sales grew'}],{isFinal:false});
  await act(()=>MockSpeech.instance.onresult({results:[result,interim]}));assert.equal(speech.finalText,'I led the project.');assert.equal(speech.interim,'Sales grew');
  await act(()=>speech.stop());assert.deepEqual(finished,['I led the project. Sales grew']);assert.equal(speech.recording,false);assert.equal(speech.interim,'');
  await act(()=>speech.start('zh-CN'));const old=MockSpeech.instance;await act(()=>speech.reset());assert.equal(old.aborted,true);assert.equal(old.onresult,null);assert.equal(old.onend,null);assert.equal(speech.finalText,'');assert.equal(finished.length,1);
  await act(()=>speech.start('en-US'));await act(()=>MockSpeech.instance.onerror({error:'not-allowed'}));assert.match(speech.error,/麦克风权限/);
  await act(()=>root.unmount());assert.equal(MockSpeech.instance.aborted,true);delete global.window;
});
test('unsupported browser provides a text fallback without throwing',async()=>{
  global.window={};let speech;function Harness(){speech=useSpeech(()=>{});return null;}
  let root;await act(()=>{root=create(React.createElement(Harness));});assert.equal(speech.supported,false);await act(()=>speech.start('en-US'));assert.match(speech.error,/输入回答/);await act(()=>root.unmount());delete global.window;
});
