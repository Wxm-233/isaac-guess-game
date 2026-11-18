import { MAX_GUESSES, TYPE_LABELS, compare, chargeLabel, searchItems, roundStatus, submitGuess, restoreRound } from './game.js';

const $ = s => document.querySelector(s);
const KEY = 'isaac-guess-demo-v1';
const escape = s => String(s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let data, items, byId, state, stats = { played:0, won:0, best:null };
let matches = [], activeIndex = 0, composing = false, storageOK = true;
const input = $('#guess-input');
const list = $('#suggestions');
const modal = $('#modal');

function save() {
  try { localStorage.setItem(KEY, JSON.stringify({ round:state, stats })); }
  catch { storageOK = false; $('#save-note').textContent = '当前浏览器无法保存进度'; }
}
function randomId() {
  const random = new Uint32Array(1);
  const limit = 2 ** 32 - (2 ** 32 % items.length);
  do { crypto.getRandomValues(random); } while (random[0] >= limit);
  return items[random[0] % items.length].id;
}
function newRound() {
  const previous = state?.targetId;
  let targetId;
  do { targetId = randomId(); } while (targetId === previous && items.length > 1);
  state = { version:data.version, targetId, guesses:[], revealed:false, counted:false };
  input.value = ''; closeSuggestions(); message(''); save(); render(); input.focus();
}
function message(text) { $('#message').textContent = text; }
function closeSuggestions() {
  list.hidden = true; input.setAttribute('aria-expanded','false'); input.removeAttribute('aria-activedescendant');
}
function image(item, cls = '') { return `<img class="${cls}" src="${escape(item.image)}" alt="" width="34" height="34">`; }
function showMatches() {
  matches = searchItems(items, input.value, state.guesses); activeIndex = 0;
  if (!input.value.trim() || roundStatus(state)!=='playing') { closeSuggestions(); return; }
  list.innerHTML = matches.length ? matches.map((item,i)=>`<div class="suggestion" role="option" id="option-${item.id}" aria-selected="${i===0}" data-id="${item.id}">${image(item)}<span><strong>${escape(item.name)}</strong><small>${escape(item.english)}</small></span><span class="suggestion-id">#${item.id}</span></div>`).join('') : '<div class="no-match" role="status">没有找到可猜的道具，试试其他名字或俗称。</div>';
  list.hidden = false; input.setAttribute('aria-expanded','true'); updateActive(false);
}
function updateActive(scroll = true) {
  const options = [...list.querySelectorAll('[role=option]')];
  options.forEach((el,i)=>el.setAttribute('aria-selected',String(i===activeIndex)));
  const selected = options[activeIndex];
  if (selected) { input.setAttribute('aria-activedescendant',selected.id); if(scroll) selected.scrollIntoView({block:'nearest'}); }
  else input.removeAttribute('aria-activedescendant');
}
function guess(id) {
  const result = submitGuess(state, id, items);
  if (result.error) { message(result.error); return; }
  state = result.state; input.value=''; closeSuggestions();
  const feedback = compare(byId.get(id), byId.get(state.targetId));
  const status = roundStatus(state);
  message(status === 'won' ? '猜中了！就是这件道具。' : status === 'lost' ? '八次机会用完了，答案已揭晓。' : feedback.adjacent ? '小彩蛋：这件道具的 ID 与答案仅差 1！' : `已猜 ${state.guesses.length} 次，再看看这一行的线索。`);
  finish(); save(); render();
  if(status==='playing') input.focus();
  else $('#result').scrollIntoView({block:'nearest',behavior:'smooth'});
}
function finish() {
  if (roundStatus(state)==='playing' || state.counted) return;
  stats.played++;
  if (roundStatus(state)==='won') { stats.won++; stats.best = stats.best == null ? state.guesses.length : Math.min(stats.best,state.guesses.length); }
  state.counted = true;
}
function feedbackCell(value, feedback) {
  const level = typeof feedback === 'string' ? feedback : feedback.level;
  const direction = typeof feedback === 'string' ? '' : feedback.direction;
  const label = {correct:'完全匹配',close:'部分匹配或接近',wrong:'不匹配'}[level];
  const mark = {correct:'✓',close:'≈',wrong:'×'}[level];
  return `<td><div class="feedback ${level}" title="${label}${direction ? direction==='↑' ? '，目标更高' : '，目标更低' : ''}"><span class="cell-values">${escape(value)}</span><span class="${direction?'direction':'cell-symbol'}" aria-label="${label}">${direction||mark}</span></div></td>`;
}
function render() {
  const status = roundStatus(state), over = status !== 'playing';
  const remaining = MAX_GUESSES - state.guesses.length;
  $('#attempt-counter').innerHTML = over ? status === 'won' ? '<strong>猜对了！</strong>' : '<strong>本局结束</strong>' : `剩余 <strong>${remaining}</strong> 次机会`;
  $('#health-row').innerHTML = Array.from({length:8},(_,i)=>`<span aria-hidden="true" class="heart ${i>=remaining?'used':''}">♥</span>`).join('');
  $('#health-row').setAttribute('aria-label',`剩余 ${remaining} 次机会`);
  input.disabled = over; $('#guess-button').disabled = over; $('#give-up').disabled = over; $('#restart').disabled = false;
  input.placeholder = over ? '这一局结束了，准备好再撒一把了吗？' : '输入道具名、俗称、拼音或英文…';
  $('#empty-state').hidden = state.guesses.length>0 || over;
  const target = byId.get(state.targetId);
  $('#guess-rows').innerHTML = state.guesses.map((id,index)=>{
    const item = byId.get(id), f = compare(item,target);
    return `<tr class="${index===state.guesses.length-1?'latest ':''}${f.correct?'win':''}"><td><div class="item-identity">${image(item)}<div><strong>${escape(item.name)}</strong><small class="${f.adjacent?'adjacent':''}">${f.correct ? '✓ 就是它' : f.adjacent ? 'ID 相邻 · 仅差 1' : `第 ${index+1} 次猜测`}</small></div></div></td>${feedbackCell(`${item.quality} 级`,f.quality)}${feedbackCell(TYPE_LABELS[item.type],f.type)}${feedbackCell(item.pools.join(' · ')||'无常规道具池',f.pools)}${feedbackCell(item.tags.join(' · ')||'无所列标签',f.tags)}${feedbackCell(chargeLabel(item.charge),f.charge)}${feedbackCell(item.unlock?'是':'否',f.unlock)}</tr>`;
  }).join('');
  $('#result').hidden=!over;
  if(over) renderResult(target,status);
  $('#stat-played').textContent=stats.played;
  $('#stat-rate').textContent=stats.played ? `${Math.round(stats.won/stats.played*100)}%` : '—';
  $('#stat-best').textContent=stats.best ?? '—';
  if(!storageOK) $('#save-note').textContent='当前浏览器无法保存进度';
}
function renderResult(item,status) {
  const section=$('#result'); section.className=`result ${status==='lost'?'lost':''}`;
  section.innerHTML=`<div class="result-top"><div class="result-icon">${image(item)}</div><div><span class="result-eyebrow">${status==='won'?'ITEM FOUND · 找到了':'MYSTERY REVEALED · 答案揭晓'}</span><h2>${status==='won'?`${state.guesses.length} 次，成功撒出来了！`:'下次一定认得你。'}</h2><p class="result-name">${escape(item.name)}<span class="result-english">${escape(item.english)} · #${item.id}</span></p></div></div><p class="result-description">${escape(item.description || '这件道具的中文效果说明暂未收录，可通过下方 Wiki 查看详情。')}</p><div class="result-properties"><span>品质 ${item.quality}</span><span>${TYPE_LABELS[item.type]}</span><span>${escape(item.pools.join(' / ')||'无常规道具池')}</span><span>${escape(chargeLabel(item.charge))}</span></div><div class="result-actions"><button id="play-again" class="primary-button">↻ 再撒一把</button><button id="share-result" class="text-button">复制战绩</button><a href="https://isaac.huijiwiki.com/wiki/C${item.id}" target="_blank" rel="noopener noreferrer">查看 Wiki ↗</a></div>`;
  $('#play-again').addEventListener('click',newRound);
  $('#share-result').addEventListener('click',share);
}
async function share() {
  const target=byId.get(state.targetId), square={correct:'🟩',close:'🟨',wrong:'⬜'};
  const text=`撒一把 · 单人练习 ${roundStatus(state)==='won'?state.guesses.length:'X'}/8\n${state.guesses.map(id=>{const f=compare(byId.get(id),target);return [f.quality.level,f.type,f.pools,f.tags,f.charge.level,f.unlock].map(x=>square[x]).join('');}).join('\n')}`;
  try { await navigator.clipboard.writeText(text); $('#share-result').textContent='已复制 ✓'; }
  catch { openModal(`<h2>分享战绩</h2><p>复制下方文字即可分享，不会包含答案。</p><textarea aria-label="战绩文本" readonly style="width:100%;height:180px;padding:12px">${escape(text)}</textarea>`); $('#modal textarea').select(); }
}
function openModal(content) { closeSuggestions(); $('#modal-content').innerHTML=content; if(!modal.open) modal.showModal(); }
function confirmAction(title,body,label,action) {
  openModal(`<h2>${title}</h2><p>${body}</p><div class="dialog-actions"><button class="text-button" id="cancel-action">继续猜</button><button class="primary-button" id="confirm-action">${label}</button></div>`);
  $('#cancel-action').onclick=()=>modal.close(); $('#confirm-action').onclick=()=>{modal.close();action();};
}
$('#modal-close').onclick=()=>modal.close();
modal.addEventListener('click',event=>{if(event.target===modal){const r=modal.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)modal.close();}});
$('#rules-button').onclick=()=>openModal(`<h2>怎么撒一把？</h2><p>每局随机抽取一件道具。你有 8 次机会，每次提交后会显示你猜的道具属性，并与答案比较。猜中道具本身即获胜。</p><ul><li><strong>品质：</strong>相同为绿，相差 1 为黄；箭头始终指向答案的方向。</li><li><strong>类型：</strong>主动、被动、跟班。跟班属于被动的细分，两者之间显示黄色。</li><li><strong>道具池 / 标签：</strong>集合完全相同为绿，有交集为黄，没有交集为灰。双方都没有所列属性时为绿。道具池采用普通模式。</li><li><strong>充能：</strong>分普通格数、计时和特殊机制；只有机制相同才比较数值。计时相差 1 帧为黄，其他不相等为灰。两件被动都显示“不适用”，判为绿。特殊机制只比较类别。</li><li><strong>需解锁：</strong>是否关联解锁成就。</li><li><strong>ID 彩蛋：</strong>猜测与答案的 ID 恰好相差 1 时提示，不提示 ID 大小。</li></ul><p>颜色匹配只是线索；不同道具可能有相同属性。搜索支持中文、常用俗称、英文、拼音、拼音首字母和 ID。↑↓ 选择候选，Enter 提交，Esc 收起。</p>`);
$('#about-button').onclick=()=>openModal(`<h2>题库与来源</h2><p>本地单人 Demo · ${data?.items.length ?? "—"} 件图鉴道具。属性按${escape(data?.gameVersion ?? "忏悔+")}配置整理，排除隐藏道具；普通模式道具池。标签展示常见主题标签，共 18 类，不包含内部机制标签。</p><ul><li>游戏配置快照：从忏悔+原版资源提取品质、类型、道具池、标签、充能及解锁状态。</li><li><a target="_blank" rel="noopener" href="https://github.com/wofsauge/External-Item-Descriptions">External Item Descriptions</a>：中文名称与效果说明，合并忏悔+版本修订；中文说明仅用于结束后的介绍。</li><li><a target="_blank" rel="noopener" href="https://github.com/Swashua/Bindings-of-Isaac-Cheat-Sheet">Bindings of Isaac Cheat Sheet</a>：道具图标。</li><li><a target="_blank" rel="noopener" href="https://github.com/shnlfriberg/csgofriberg">弗一把</a>：玩法参考，本 Demo 独立实现。</li></ul><p>常用俗称为 Demo 补充表，后续可合并 Wiki 索引。道具图像属于原游戏权利人。游戏进度与战绩仅保存在此浏览器。</p>`);
$('#give-up').onclick=()=>confirmAction('要揭晓答案吗？','揭晓后本局会结束，并计入未猜中的战绩。','揭晓答案',()=>{state.revealed=true;finish();save();render();message('答案已揭晓。');$('#result').scrollIntoView({block:'nearest',behavior:'smooth'});});
$('#restart').onclick=()=>{if(roundStatus(state)==='playing'&&state.guesses.length)confirmAction('换一件道具？','当前猜测进度会清空。这一局不会计入战绩。','换一局',newRound);else newRound();};
input.addEventListener('input',()=>{if(!composing){message('');showMatches();}});
input.addEventListener('compositionstart',()=>{composing=true;});
input.addEventListener('compositionend',()=>{composing=false;showMatches();});
input.addEventListener('focus',()=>{if(items&&input.value.trim())showMatches();});
input.addEventListener('keydown',event=>{
  if(event.isComposing||composing||event.keyCode===229)return;
  if(event.key==='Escape'){closeSuggestions();return;}
  if(['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();if(list.hidden)showMatches();else if(matches.length){activeIndex=(activeIndex+(event.key==='ArrowDown'?1:-1)+matches.length)%matches.length;updateActive();}}
});
$('#guess-form').addEventListener('submit',event=>{event.preventDefault();if(composing||!items||roundStatus(state)!=='playing')return;const candidates=searchItems(items,input.value,state.guesses);if(!candidates.length){message('请输入道具名，并从匹配结果中选择。');return;}guess(candidates[list.hidden?0:activeIndex]?.id??candidates[0].id);});
list.addEventListener('pointerdown',event=>{const option=event.target.closest('[data-id]');if(option){event.preventDefault();guess(Number(option.dataset.id));}});
// Enter implicitly clicks the submit button before the form's submit event.
// Keep the active suggestion available until either submission path consumes it.
document.addEventListener('click',event=>{if(!event.target.closest('#guess-form'))closeSuggestions();});
document.addEventListener('keydown',event=>{if(event.key==='/'&&!modal.open&&!['INPUT','TEXTAREA'].includes(document.activeElement.tagName)&&!input.disabled){event.preventDefault();input.focus();}});

async function init() {
  try {
    const response=await fetch(new URL('./data/items.json',import.meta.url)); if(!response.ok)throw new Error('题库读取失败');
    data=await response.json();
    // Resolve bundled icons from this app's directory, including Pages project paths.
    items=data.items.map(item=>({...item,image:new URL(item.image.replace(/^\/+/,''),import.meta.url).href}));
    byId=new Map(items.map(x=>[x.id,x]));
    try {
      const stored=JSON.parse(localStorage.getItem(KEY)||'null');
      if(stored){state=restoreRound(JSON.stringify(stored.round),data);const s=stored.stats;if(s&&Number.isInteger(s.played)&&s.played>=0&&Number.isInteger(s.won)&&s.won>=0&&s.won<=s.played&&(s.best===null||(Number.isInteger(s.best)&&s.best>=1&&s.best<=8)))stats=s;}
    }catch{}
    $('#dataset-count').textContent=`${items.length} 件道具`;
    $('.version-pill').title=data.gameVersion;
    $('#hero-item-one').src=byId.get(105).image;$('#hero-item-two').src=byId.get(118).image;
    $('#starter-items').innerHTML=[105,4,182].map(id=>{const item=byId.get(id);return `<button class="starter" type="button" data-id="${id}">${image(item)}${escape(item.name)}</button>`;}).join('');
    $('#starter-items').addEventListener('click',event=>{const el=event.target.closest('[data-id]');if(el)guess(Number(el.dataset.id));});
    if(!state)newRound();else{finish();save();render();}
  } catch(error) {
    $('#empty-state').innerHTML='<h2>题库暂时没有加载成功</h2><p>请确认本地服务正在运行，然后刷新页面。</p><button class="primary-button" onclick="location.reload()" style="margin-top:20px">重新加载</button>';
    $('#dataset-count').textContent='加载失败';message(error.message);
  }
}
init();
