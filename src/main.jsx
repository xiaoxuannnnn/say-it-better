import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Mic, Square, ChevronRight, ChevronLeft, Heart, Shuffle, Lightbulb, Bookmark, Home, Upload, FileText, X } from 'lucide-react';
import { QUESTIONS } from './questions.js';
import { STAR_FIELDS, filterQuestions, localStar, localResumeQuestions, readSaved } from './lib/practice.js';
import { useSpeech } from './lib/useSpeech.js';
import { extractResume, MAX_RESUME_LENGTH } from './lib/files.js';
import './style.css';

function App() {
  const [mode,setMode] = useState('business'), [view,setView] = useState('practice');
  const [category,setCategory] = useState('All'), [subcat,setSubcat] = useState('All Marketing'), [index,setIndex] = useState(0), [hint,setHint] = useState(0);
  const [saved,setSaved] = useState(() => { try { return readSaved(window.localStorage); } catch { return []; } });
  const [answer,setAnswer] = useState(''), [star,setStar] = useState(null), [starBusy,setStarBusy] = useState(false), [starError,setStarError] = useState('');
  const [language,setLanguage] = useState('en-US');
  const [ai,setAi] = useState({available:false,provider:'AI',loaded:false}), [useAi,setUseAi] = useState(false);
  const [resume,setResume] = useState(''), [role,setRole] = useState(''), [fileName,setFileName] = useState(''), [resumeQuestions,setResumeQuestions] = useState([]), [resumeMode,setResumeMode] = useState('local');
  const [resumeBusy,setResumeBusy] = useState(false), [resumeError,setResumeError] = useState(''), [notice,setNotice] = useState('');
  const captionRef = useRef(null);
  const starRequest = useRef(null), resumeRequest = useRef(null), uploadVersion = useRef(0), fileInput = useRef(null);
  const pool = mode === 'resume' ? resumeQuestions : filterQuestions(QUESTIONS,category,subcat);
  const question = pool[index % (pool.length || 1)];
  const speech = useSpeech(text => { setAnswer(text.slice(0,8000)); organize(text.slice(0,8000)); });
  const locked = speech.recording || speech.starting;
  useEffect(() => { if (captionRef.current) captionRef.current.scrollTop = captionRef.current.scrollHeight; }, [speech.finalText,speech.interim]);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/practice',{signal:controller.signal}).then(r => r.ok ? r.json() : Promise.reject()).then(data => setAi({...data,loaded:true})).catch(() => {if(!controller.signal.aborted)setAi({available:false,provider:'AI',loaded:true});});
    return () => { controller.abort(); starRequest.current?.abort(); resumeRequest.current?.abort(); uploadVersion.current++; };
  },[]);
  async function request(body,controller) {
    const timer = setTimeout(() => controller.abort('timeout'),55000);
    try {
      const response = await fetch('/api/practice',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:controller.signal});
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '请求失败，请重试。');
      return data;
    } finally { clearTimeout(timer); }
  }
  function invalidateStar() { starRequest.current?.abort(); starRequest.current=null; setStarBusy(false); setStarError(''); }
  function resetPractice() { speech.reset(); invalidateStar(); setAnswer(''); setStar(null); setHint(0); }
  function switchMode(next) { resetPractice(); setIndex(0); setMode(next); setView('practice'); }
  function chooseCategory(next) { resetPractice(); setIndex(0); setCategory(next); setSubcat('All Marketing'); }
  function navigate(next) { resetPractice(); setIndex((next+pool.length)%pool.length); }
  async function organize(text = answer) {
    if (!text.trim()) return;
    invalidateStar();
    const local = localStar(text,question?.q); setStar(local);
    if (!(ai.available && useAi)) return;
    const controller = new AbortController(); starRequest.current = controller; setStarBusy(true);
    try {
      const data = await request({action:'star',text,question:question?.q || ''},controller);
      if (starRequest.current === controller) setStar(data);
    } catch (error) {
      if (starRequest.current === controller && (!controller.signal.aborted || controller.signal.reason==='timeout')) setStarError(error.message || 'AI 超时，可先使用本地整理。');
    } finally { if(starRequest.current === controller){setStarBusy(false);starRequest.current=null;} }
  }
  function save(expression) {
    const next = [...new Set([...saved,expression])]; setSaved(next);
    try {localStorage.setItem('sayit-saved',JSON.stringify(next));} catch {setNotice('本次已收藏，但浏览器未允许永久保存。');}
  }
  function removeSaved(expression) {
    const next = saved.filter(x=>x!==expression);setSaved(next);
    try {localStorage.setItem('sayit-saved',JSON.stringify(next));} catch {setNotice('浏览器未能保存更改。');}
  }
  function invalidateResume() {
    resumeRequest.current?.abort();resumeRequest.current=null;setResumeBusy(false);setResumeError('');setResumeQuestions([]);setIndex(0);resetPractice();
  }
  async function upload(file) {
    if (!file) return;
    invalidateResume(); const version=++uploadVersion.current;setResumeBusy(true);setFileName('');setResume('');
    try { const text=await extractResume(file);if(version===uploadVersion.current){setResume(text);setFileName(file.name);} }
    catch(error){if(version===uploadVersion.current)setResumeError(error.message);}
    finally {if(version===uploadVersion.current)setResumeBusy(false);if(fileInput.current)fileInput.current.value='';}
  }
  async function generateResume(forceLocal=false) {
    invalidateResume();
    if(resume.trim().length<40){setResumeError('请至少粘贴一段具体经历（40 字符以上）。');return;}
    if(!(ai.available&&useAi) || forceLocal){
      const questions=localResumeQuestions(resume,role);
      if(!questions.length){setResumeError('请补充一段项目、职责或成果描述，再生成练习题。');return;}
      setResumeQuestions(questions);setResumeMode('local');return;
    }
    const controller=new AbortController();resumeRequest.current=controller;setResumeBusy(true);
    try {
      const data=await request({action:'resume',text:resume,role},controller);
      if(resumeRequest.current===controller){setResumeQuestions(data.questions.map((q,i)=>({...q,id:`resume-ai-${i}`,cat:'Resume'})));setResumeMode('ai');}
    } catch(error){if(resumeRequest.current===controller && (!controller.signal.aborted||controller.signal.reason==='timeout'))setResumeError(error.message || '生成超时，请重试。');}
    finally {if(resumeRequest.current===controller){setResumeBusy(false);resumeRequest.current=null;}}
  }
  const aiControl = <div className="ai-control">{ai.available ? <label><input type="checkbox" checked={useAi} onChange={e=>{invalidateStar();resumeRequest.current?.abort();resumeRequest.current=null;setResumeBusy(false);setUseAi(e.target.checked);}}/> 使用 {ai.provider} 整理回答 / 生成简历题目 <small>开启后，整理时会发送当前回答；生成题目时会发送确认后的简历文字。不发送原始文件。</small></label> : <p className="small muted">{ai.loaded?'本地模式 · AI 尚未启用。STAR 按关键词归类，简历题目按原文生成模板。':'正在检查 AI 服务…'}</p>}</div>;
  return <main>
    <header><button className="brand" onClick={()=>{resetPractice();setView('practice');}}>Say It Better</button><button className="icon" aria-label={view==='saved'?'Back to practice':'My expressions'} onClick={()=>{resetPractice();setView(view==='saved'?'practice':'saved');}}>{view==='saved'?<Home/>:<Bookmark/>}</button></header>
    {notice&&<p className="status" role="status">{notice}<button className="icon" aria-label="Dismiss" onClick={()=>setNotice('')}><X size={16}/></button></p>}
    {view==='saved'?<section className="saved"><p className="eyebrow">MY EXPRESSIONS</p><h1>Your own business English library.</h1>{saved.length?saved.map(x=><div className="savedrow" key={x}>{x}<button aria-label={`Remove ${x}`} onClick={()=>removeSaved(x)}>×</button></div>):<p className="muted">还没有收藏。练题时点表达旁边的心形即可。</p>}</section>:<>
      <nav className="mode-tabs" aria-label="Practice mode"><button className={mode==='business'?'on':''} onClick={()=>switchMode('business')}>Business Mode</button><button className={mode==='resume'?'on':''} onClick={()=>switchMode('resume')}>Resume Mode</button></nav>
      <section className="hero"><p className="eyebrow">{mode==='business'?'BUSINESS MODE':'RESUME MODE'}</p><h1>{mode==='business'?<>Think in business.<br/>Say it in English.</>:<>Your experience.<br/>Your next interview.</>}</h1><p>{mode==='business'?"Practice one question at a time. Speak, see your words, then shape your story.":'从你的经历出发，一次练好一个项目故事。'}</p></section>
      {aiControl}
      {mode==='business'?<>
        <div className="cats" aria-label="Question categories">{['All','P&G-style','Marketing','Experience','Business Topics'].map(x=><button key={x} aria-pressed={category===(x==='Business Topics'?'Random':x)} className={category===(x==='Business Topics'?'Random':x)?'on':''} onClick={()=>chooseCategory(x==='Business Topics'?'Random':x)}>{x}</button>)}</div>
        {category==='Marketing'&&<div className="subcategories"><span>Marketing →</span>{['All Marketing','General Marketing','Marketing-FMCG'].map(x=><button key={x} aria-pressed={subcat===x} className={subcat===x?'on':''} onClick={()=>{resetPractice();setIndex(0);setSubcat(x);}}>{x}</button>)}</div>}
      </>:<section className="resume-panel">
        <div className="section-heading"><h2>Your résumé</h2>{(resume||resumeBusy)&&<button className="text-button" onClick={()=>{uploadVersion.current++;invalidateResume();setResume('');setRole('');setFileName('');}}>Clear</button>}</div>
        <label className="upload"><Upload size={20}/><span>{resumeBusy&&!resumeRequest.current?'Reading résumé…':fileName||'Choose PDF, DOCX or TXT'}<small>最多 5 MB · 也可以直接粘贴经历</small></span><input ref={fileInput} type="file" accept=".pdf,.docx,.txt" disabled={resumeBusy} onChange={e=>upload(e.target.files?.[0])}/></label>
        <label className="field-label" htmlFor="resume-text">确认或编辑简历文字</label><textarea id="resume-text" value={resume} maxLength={MAX_RESUME_LENGTH} placeholder="粘贴项目背景、你的职责、具体行动和结果…" disabled={resumeBusy} onChange={e=>{uploadVersion.current++;invalidateResume();setFileName('');setResume(e.target.value);}} rows={7}/>
        <p className="small muted">简历只保留在本次页面中，刷新后清除。生成前可删除联系方式等无关信息。</p>
        <label className="field-label" htmlFor="target-role">目标岗位（可选）</label><input id="target-role" value={role} maxLength={120} placeholder="例如 Brand Manager / 产品经理" disabled={resumeBusy} onChange={e=>{invalidateResume();setRole(e.target.value);}}/>
        {resumeError&&<p className="error" role="alert">{resumeError}</p>}
        <div className="button-row"><button className="primary" disabled={resumeBusy||resume.trim().length<40} onClick={()=>generateResume()}>{resumeBusy?'Preparing…':'Generate practice questions'}</button>{resumeError&&ai.available&&useAi&&<button className="text-button" onClick={()=>generateResume(true)}>先用本地模板</button>}</div>
        {resumeQuestions.length>0&&<p className="small muted">{resumeQuestions.length} 道题 · {resumeMode==='ai'?'AI 根据简历生成':'本地模板，引用下方简历原文'}</p>}
      </section>}
      {question&&<article className="card" key={question.id}>
        <div className="meta"><span>{question.subcat==='Marketing-FMCG'?'Marketing / Marketing-FMCG':question.cat==='Random'?'Business Topics':question.cat}</span><span>{index%pool.length+1} / {pool.length}</span></div>
        {question.source&&<details className="source" open><summary><FileText size={14}/> From your résumé</summary><p>{question.source}</p></details>}
        <h2>{question.q}</h2><p className="instruction">Speak for 60–90 seconds. Your words appear below as you talk.</p>
        <div className="speech-settings"><label htmlFor="speech-language">Speech language</label><select id="speech-language" value={language} disabled={locked} onChange={e=>setLanguage(e.target.value)}><option value="en-US">English</option><option value="zh-CN">中文</option></select></div>
        <div className="voice"><button disabled={speech.starting} className={speech.recording?'recording':''} onClick={()=>{if(speech.recording)speech.stop();else{invalidateStar();setStar(null);setAnswer('');speech.start(language);}}} aria-label={speech.recording?'Stop recording':'Start recording'}>{speech.recording?<Square/>:<Mic/>}<span>{speech.starting?'Starting…':speech.recording?'Stop':'Answer'}</span></button></div>
        {(locked||speech.finalText||speech.interim)&&<section className="captions" aria-label="Live captions"><div className="caption-label"><b>CC</b><span>{locked?'LIVE CAPTIONS':'TRANSCRIPT CAPTURED'}</span>{locked&&<span className="live-dot"/>}</div><p ref={captionRef} role="status" aria-live="polite" aria-atomic="true">{speech.finalText}{speech.interim&&<> <span className="interim">{speech.interim}</span></>}{!speech.finalText&&!speech.interim&&'Listening… 开始说话，字幕会显示在这里。'}</p></section>}
        {speech.error&&<p className="error" role="alert">{speech.error}</p>}
        {!speech.supported&&<p className="small muted">当前浏览器不支持实时语音字幕，仍可输入回答并整理。</p>}
        {!locked&&<section className="answer-editor"><label className="field-label" htmlFor="answer-text">YOUR ANSWER · 可修改字幕，也可直接输入</label><textarea id="answer-text" rows={4} maxLength={8000} value={answer} placeholder="Type your answer, or tap Answer to speak…" onChange={e=>{invalidateStar();setStar(null);setAnswer(e.target.value);}}/><div className="button-row"><button className="primary" disabled={!answer.trim()||starBusy} onClick={()=>organize()}>{starBusy?'Organizing…':'Organize with STAR'}</button><span className="small muted">S 情境 → T 任务 → A 行动 → R 结果</span></div></section>}
        {starError&&<p className="error" role="alert">{starError}</p>}
        {star&&<section className="star-section" aria-label="STAR answer"><div className="section-heading"><h3>Your STAR story</h3><span className="small muted">{starBusy?'AI 正在整理…':star.mode==='ai'?'AI 整理':'本地关键词归类 · 请核对'}</span></div>{star.note&&<p className="small muted">{star.note}</p>}<div className="star-grid">{STAR_FIELDS.map(([key,letter,label,prompt])=><label className="star-field" key={key}><span><b>{letter}</b>{label}</span><textarea rows={3} aria-label={`STAR ${label}`} value={star[key]} disabled={starBusy} placeholder={prompt} onChange={e=>setStar({...star,[key]:e.target.value,rewritten:'',missing:[]})}/></label>)}</div>{star.unassigned?.length>0&&<div className="unassigned"><b>尚未归类的原话</b><p>{star.unassigned.join(' ')}</p><small>已保留全部内容，可复制到上方对应部分。</small></div>}{star.missing?.length>0&&<div className="missing"><b>下一次补充这些信息</b>{star.missing.map(x=><p key={x}>{x}</p>)}</div>}{star.rewritten&&<div className="reveal"><small>A MORE NATURAL ANSWER</small><p>{star.rewritten}</p></div>}</section>}
        <div className="hintActions"><button onClick={()=>setHint(Math.min(3,hint+1))}><Lightbulb size={18}/> I don't know how to say it</button></div>
        {hint>=1&&<div className="reveal"><small>THINKING FRAMEWORK</small><p>{question.framework}</p></div>}{hint>=2&&<div className="reveal"><small>STARTER SENTENCE</small><p className="english">“{question.starter}”</p></div>}{hint>=3&&<div className="reveal"><small>USEFUL EXPRESSIONS</small>{question.expressions.map(expression=><div className="exp" key={expression}><span>{expression}</span><button aria-label={`Save ${expression}`} aria-pressed={saved.includes(expression)} onClick={()=>save(expression)}><Heart size={17} fill={saved.includes(expression)?'currentColor':'none'}/></button></div>)}</div>}
        <div className="nav"><button onClick={()=>navigate(index-1)}><ChevronLeft/> Prev</button><button onClick={()=>navigate(Math.floor(Math.random()*pool.length))}><Shuffle/> Random</button><button className="next" onClick={()=>navigate(index+1)}>Next <ChevronRight/></button></div>
      </article>}
      <footer className="small muted">{mode==='business'?'50 questions. One story at a time.':'Your résumé stays in this tab.'} 语音识别由浏览器提供，可能使用浏览器厂商的在线服务。</footer>
    </>}
  </main>;
}
createRoot(document.getElementById('root')).render(<App/>);
