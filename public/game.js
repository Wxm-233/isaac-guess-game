export const MAX_GUESSES = 8;
export const TYPE_LABELS = { active: '主动', passive: '被动', familiar: '跟班' };
export const normalize = (s) => String(s).normalize('NFKC').toLowerCase().replace(/[\s'’!！?？·._/()（）-]/g, '');

export function compareSet(guess, target) {
  const a = new Set(guess), b = new Set(target);
  if (a.size === b.size && [...a].every(v => b.has(v))) return 'correct';
  return [...a].some(v => b.has(v)) ? 'close' : 'wrong';
}

export function compareSetMembers(guess, target) {
  const targetSet = new Set(target);
  return { level:compareSet(guess,target), entries:[...new Set(guess)].map(value=>({value,level:targetSet.has(value)?'correct':'wrong'})) };
}

export function compareUnlock(guess, target) {
  if (guess.kind !== target.kind) return 'wrong';
  if (guess.kind !== 'character') return 'correct';
  if (guess.character !== target.character) return 'wrong';
  return guess.tainted === target.tainted ? 'correct' : 'close';
}

export function unlockLabel(unlock) {
  if (unlock.kind === 'none') return '不需要解锁';
  if (unlock.kind === 'other') return '其他解锁条件';
  return `${unlock.tainted?'里':'表'}·${unlock.name}`;
}

export function compareNumber(guess, target) {
  return { level: guess === target ? 'correct' : Math.abs(guess-target) === 1 ? 'close' : 'wrong', direction: guess === target ? '' : target > guess ? '↑' : '↓' };
}

export function compareCharge(a, b) {
  if (!a || !b) return { level: a === b ? 'correct' : 'wrong', direction: '' };
  if (a.kind !== b.kind) return { level: 'wrong', direction: '' };
  // Numeric arrows make sense for room charges and timed cooldowns only.
  if (a.kind === 'special') return { level: 'correct', direction: '' };
  return compareNumber(a.value, b.value);
}

export function compare(guess, target) {
  return {
    correct: guess.id === target.id,
    adjacent: Math.abs(guess.id - target.id) === 1,
    quality: compareNumber(guess.quality, target.quality),
    type: guess.type === target.type ? 'correct' : guess.type !== 'active' && target.type !== 'active' ? 'close' : 'wrong',
    pools: compareSetMembers(guess.pools, target.pools),
    tags: compareSetMembers(guess.tags, target.tags),
    charge: compareCharge(guess.charge, target.charge),
    unlock: compareUnlock(guess.unlock, target.unlock),
  };
}

export function chargeLabel(charge) {
  if (!charge) return '不适用';
  if (charge.kind === 'timed') return `${Number((charge.value / 30).toFixed(1))} 秒`;
  if (charge.kind === 'special') return '特殊机制';
  return charge.value === 0 ? '无充能条' : `${charge.value} 格`;
}

export function searchItems(items, query, guessed = []) {
  const q = normalize(query);
  if (!q) return [];
  const excluded = new Set(guessed);
  return items.filter(x => !excluded.has(x.id)).map(item => {
    const names = [item.name, item.english, ...(item.aliases || []), String(item.id), `c${item.id}`].map(normalize);
    const phonetics = [item.pinyin || '', item.initials || ''].map(normalize);
    const score = names.includes(q) ? 0 : names.some(n=>n.startsWith(q)) ? 1 : names.some(n=>n.includes(q)) ? 2 : phonetics.some(n=>n && n.startsWith(q)) ? 3 : Infinity;
    return { item, score };
  }).filter(x=>Number.isFinite(x.score)).sort((a,b)=>a.score-b.score || a.item.id-b.item.id).slice(0,12).map(x=>x.item);
}

export function roundStatus(state) {
  if (state.guesses.includes(state.targetId)) return 'won';
  if (state.revealed || state.guesses.length >= MAX_GUESSES) return 'lost';
  return 'playing';
}

export function submitGuess(state, id, items) {
  if (roundStatus(state) !== 'playing') return { error: '这局已经结束，来开下一局吧。' };
  if (!items.some(x=>x.id===id)) return { error: '请从候选列表选择一个道具。' };
  if (state.guesses.includes(id)) return { error: '这个道具已经猜过了，换一个试试。' };
  return { state: { ...state, guesses: [...state.guesses, id] } };
}

export function restoreRound(raw, data) {
  try {
    const s = JSON.parse(raw), ids = new Set(data.items.map(x=>x.id));
    if (s.version !== data.version || !ids.has(s.targetId) || !Array.isArray(s.guesses) || s.guesses.length > MAX_GUESSES || new Set(s.guesses).size !== s.guesses.length || !s.guesses.every(id=>ids.has(id)) || typeof s.revealed !== 'boolean' || typeof s.counted !== 'boolean') return null;
    const hit = s.guesses.indexOf(s.targetId);
    if (hit >= 0 && hit !== s.guesses.length-1) return null;
    return { version:s.version,targetId:s.targetId,guesses:s.guesses,revealed:s.revealed,counted:s.counted };
  } catch { return null; }
}
