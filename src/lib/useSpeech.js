import { useEffect, useRef, useState } from 'react';
import { speechText } from './practice.js';
export function useSpeech(onFinish) {
  const [recording, setRecording] = useState(false);
  const [starting, setStarting] = useState(false);
  const [finalText, setFinalText] = useState('');
  const [interim, setInterim] = useState('');
  const [error, setError] = useState('');
  const recognition = useRef(null), latest = useRef(''), finish = useRef(onFinish), shouldFinish = useRef(false);
  finish.current = onFinish;
  const supported = typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  function cancel() {
    shouldFinish.current = false;
    const r = recognition.current; recognition.current = null;
    if (r) { r.onend = r.onresult = r.onerror = r.onstart = null; r.abort(); }
    setRecording(false); setStarting(false); setInterim('');
  }
  function reset() { cancel(); latest.current = ''; setFinalText(''); setError(''); }
  function start(language) {
    if (recognition.current) return;
    if (!supported) { setError('当前浏览器不支持实时字幕，请使用支持语音识别的 Chrome / Safari，或在下方输入回答。'); return; }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const r = new SR(); recognition.current = r; shouldFinish.current = true;
    latest.current = ''; setFinalText(''); setInterim(''); setError(''); setStarting(true);
    r.lang = language; r.continuous = true; r.interimResults = true;
    r.onstart = () => { setStarting(false); setRecording(true); };
    r.onresult = event => {
      const parts = speechText(event.results);
      setFinalText(parts.final); setInterim(parts.interim);
      latest.current = [parts.final, parts.interim].filter(Boolean).join(' ');
    };
    r.onerror = event => {
      const errors = { 'not-allowed': '麦克风权限被拒绝。请允许麦克风后重试，或输入回答。', 'audio-capture': '没有检测到麦克风，请检查设备。', network: '语音识别网络连接失败。已显示的字幕仍保留，可编辑后继续。', 'no-speech': '没有识别到声音，请再试一次。' };
      if (event.error !== 'aborted') setError(errors[event.error] || '语音识别已中断，请重试或输入回答。');
    };
    r.onend = () => {
      recognition.current = null; setRecording(false); setStarting(false); setInterim(''); setFinalText(latest.current);
      if (shouldFinish.current && latest.current.trim()) finish.current(latest.current);
    };
    try { r.start(); } catch { cancel(); setError('无法启动麦克风，请重试或输入回答。'); }
  }
  function stop() { recognition.current?.stop(); }
  useEffect(() => () => { shouldFinish.current = false; const r = recognition.current; if (r) { r.onend = r.onresult = r.onerror = r.onstart = null; r.abort(); } }, []);
  return { recording, starting, finalText, interim, error, supported, start, stop, reset };
}
