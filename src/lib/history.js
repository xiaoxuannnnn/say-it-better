export const HISTORY_KEY = 'sayit-practice-history-v1';
export function readHistory(storage) {
  try {
    const data = JSON.parse(storage.getItem(HISTORY_KEY) || '[]');
    return Array.isArray(data) ? data.filter(x => x && typeof x.id === 'string' && typeof x.question?.q === 'string' && typeof x.answer === 'string' && Number.isFinite(Date.parse(x.createdAt))) : [];
  } catch { return []; }
}
export function upsertHistory(records, attempt) {
  if (!attempt.answer.trim()) return records;
  const previous = records.find(x => x.id === attempt.id);
  return [{...attempt,createdAt:previous?.createdAt || attempt.createdAt},...records.filter(x=>x.id!==attempt.id)]
    .sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt));
}
export function writeHistory(storage, records) { storage.setItem(HISTORY_KEY,JSON.stringify(records)); }
export function polishedSections(star) {
  return ['situation','task','action','result'].map(key=>({key,text:typeof star?.[key]==='string'?star[key]:''}));
}
