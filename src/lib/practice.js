export const STAR_FIELDS = [
  ['situation', 'S', 'Situation', '当时的背景、问题或机会是什么？'],
  ['task', 'T', 'Task', '你的目标和责任是什么？'],
  ['action', 'A', 'Action', '你具体做了什么，为什么？'],
  ['result', 'R', 'Result', '产生了什么结果，有哪些证据？'],
];
export function filterQuestions(questions, category, subcategory = 'All Marketing') {
  return questions.filter(q => (category === 'All' || q.cat === category) &&
    (category !== 'Marketing' || subcategory === 'All Marketing' || q.subcat === subcategory));
}
export function speechText(results) {
  let final = '', interim = '';
  for (const result of Array.from(results)) {
    if (result.isFinal) final += result[0].transcript + ' ';
    else interim += result[0].transcript + ' ';
  }
  return { final: final.trim(), interim: interim.trim() };
}
export function localStar(text, question = '') {
  const sections = { situation: '', task: '', action: '', result: '' };
  const unassigned = [];
  const sentences = text.match(/[^。！？!?\n]+[。！？!?]?/g)?.flatMap(x => x.split(/(?<=[.])\s+(?=[A-Z])/)) || [];
  for (const raw of sentences) {
    const sentence = raw.trim();
    if (!sentence) continue;
    let field;
    if (/\b(as a result|resulted|achieved|increased|decreased|improved|learned|outcome|grew|reduced)\b|最终|结果|提升了|增长了|降低了|学到了/i.test(sentence)) field = 'result';
    else if (/\b(my task|my goal|our goal|objective|responsible for|needed to|aimed to)\b|目标|任务|负责|需要/i.test(sentence)) field = 'task';
    else if (/\b(i (?:led|created|analyzed|analysed|organized|organised|decided|worked|built|tested|launched|interviewed|proposed)|we (?:launched|tested|created|built))\b|我(?:首先|组织|分析|设计|开展|制定|提出)|我们(?:开展|测试|推出)/i.test(sentence)) field = 'action';
    else if (/\b(at the time|last year|last month|when i|our team|the company|we faced|during)\b|当时|去年|上个月|背景|面临|期间/i.test(sentence)) field = 'situation';
    if (field) sections[field] += (sections[field] ? ' ' : '') + sentence;
    else unassigned.push(sentence);
  }
  return { ...sections, rewritten: '', missing: STAR_FIELDS.filter(([k]) => !sections[k]).map(([, , label, hint]) => `${label}：${hint}`), unassigned, mode: 'local',
    note: /^(how would|what|is |should )/i.test(question) ? '这道题偏观点或假设情境。STAR 可用于补充实例；不要把预期结果说成已经发生的成果。' : '' };
}
export function localResumeQuestions(text, role = '') {
  const lines = text.split(/\n+/).map(x => x.trim()).filter(x => x.length >= 24 && !/@|https?:|(?:\+?\d[\d\s()-]{8,}\d)/.test(x));
  const anchors = [...new Set(lines)].sort((a,b) => Number(/项目|负责|营销|增长|campaign|project|led|launch|marketing/i.test(b))-Number(/项目|负责|营销|增长|campaign|project|led|launch|marketing/i.test(a))).slice(0, 3);
  return anchors.flatMap((source, index) => [
    { id: `resume-${index}-overview`, cat: 'Resume', q: 'Walk me through the experience highlighted below. What was your personal contribution?', source, framework: 'Situation → your responsibility → specific actions → evidence of results', starter: 'In this experience, I was responsible for...', expressions: ['take ownership of', 'clarify my individual contribution', 'measure the impact'] },
    { id: `resume-${index}-decision`, cat: 'Resume', q: `What was the hardest decision in this experience, and what would you do differently${role.trim() ? ` in a ${role.trim().slice(0,100)} role` : ' next time'}?`, source, framework: 'Context → options → trade-off → decision → learning', starter: 'The most difficult trade-off was...', expressions: ['weigh the alternatives', 'make an informed trade-off', 'apply the learning'] },
  ]);
}
export function readSaved(storage) {
  try { const value = JSON.parse(storage.getItem('sayit-saved') || '[]'); return Array.isArray(value) ? value.filter(x => typeof x === 'string') : []; } catch { return []; }
}
