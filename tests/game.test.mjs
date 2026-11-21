import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { compare,compareSet,compareSetMembers,compareUnlock,unlockLabel,compareCharge,chargeLabel,searchItems,submitGuess,roundStatus,restoreRound } from '../public/game.js';

const data=JSON.parse(readFileSync(new URL('../public/data/items.json',import.meta.url)));
const items=data.items, byId=new Map(items.map(x=>[x.id,x]));
const round = (targetId=105)=>({version:data.version,targetId,guesses:[],revealed:false,counted:false});

test('Repentance+ snapshots match the recorded source hashes across checkout line endings',()=>{
 const manifest=JSON.parse(readFileSync(new URL('../data/source-manifest.json',import.meta.url)));
 assert.equal(manifest.gameVersion,'Repentance+ 1.9.7.17.J460');
 for(const source of manifest.sources){
  const text=readFileSync(new URL(`../${source.file}`,import.meta.url),'utf8').replace(/\r\n/g,'\n');
  assert.equal(createHash('sha256').update(text).digest('hex'),source.sha256NormalizedLF,source.file);
 }
});
test('Repentance+ balance changes drive quality, pools, tags, charges and descriptions',()=>{
 assert.equal(data.gameVersion,'忏悔+ 1.9.7.17');
 assert.equal(byId.get(562).quality,4); // Rock Bottom
 assert.equal(byId.get(283).quality,1); // D100
 assert.equal(byId.get(477).quality,3); // Void
 assert.deepEqual(byId.get(477).charge,{kind:'normal',value:4});
 assert.deepEqual(byId.get(351).charge,{kind:'normal',value:6});
 assert.deepEqual(byId.get(111).charge,{kind:'timed',value:120});
 assert.equal(chargeLabel(byId.get(111).charge),'4 秒');
 assert.ok(!byId.get(8).pools.includes('恶魔房'));
 assert.ok(byId.get(623).pools.includes('钥匙大师'));
 assert.ok(byId.get(665).tags.includes('死亡'));
 assert.match(byId.get(117).description,/半心/);
 assert.doesNotMatch(byId.get(643).description,/魂心/);
 assert.match(byId.get(706).description,/品质4 - 2\.0x/);
 assert.match(byId.get(1).description,/射速/); // Base descriptions still survive overlays.
});
test('717 unique non-hidden collectibles, every item has complete local resources and search data',()=>{
 assert.equal(items.length,717);assert.equal(byId.size,717);
 for(const x of items){
  assert.ok(x.name&&x.english&&x.pinyin&&x.initials&&x.description,`missing text ${x.id}`);
  assert.ok(Number.isInteger(x.quality)&&x.quality>=0&&x.quality<=4);
  assert.ok(existsSync(new URL(`../public${x.image}`,import.meta.url)),`missing image ${x.id}`);
  assert.ok(['active','passive','familiar'].includes(x.type));
  assert.equal(x.charge!==null,x.type==='active');
  assert.ok(['none','character','other'].includes(x.unlock.kind));
  if(x.unlock.kind==='character'){
   assert.ok(x.unlock.character&&x.unlock.name);
   assert.equal(typeof x.unlock.tainted,'boolean');
  }
  assert.equal(x.unlock.achievement===null,x.unlock.kind==='none');
 }
 for(const id of [59,656,714,715])assert.ok(!byId.has(id));
});
test('offensive comes from the game tag; unlocks distinguish characters, variants and other conditions',()=>{
 assert.equal(items.filter(x=>x.tags.includes('攻击性')).length,546);
 assert.ok(byId.get(1).tags.includes('攻击性'));
 assert.ok(!byId.get(422).tags.includes('攻击性'));
 assert.equal(unlockLabel(byId.get(114).unlock),'表·以撒');
 assert.equal(unlockLabel(byId.get(723).unlock),'里·以撒');
 assert.equal(unlockLabel(byId.get(105).unlock),'表·???'); // Isaac is the boss, not the required character.
 for(const [a,b,level] of [[114,489,'correct'],[114,723,'close'],[723,114,'close'],[114,105,'wrong'],[619,722,'close'],[541,729,'close'],[331,727,'close'],[20,35,'correct'],[1,2,'correct'],[1,20,'wrong'],[20,114,'wrong']]){
  assert.equal(compareUnlock(byId.get(a).unlock,byId.get(b).unlock),level,`${a} vs ${b}`);
 }
 for(const id of [441,625,628,537,263])assert.equal(byId.get(id).unlock.kind,'other',`all-character, generic-Isaac and challenge conditions: ${id}`);
 assert.equal(byId.get(404).unlock.character,'isaac');
 assert.equal(byId.get(643).unlock.character,'bethany');
 assert.equal(byId.get(258).unlock.character,'lazarus');
});
test('each guessed set member is marked independently without revealing missing target members',()=>{
 assert.deepEqual(compareSetMembers(['宝箱房','商店','宝箱房'],['宝箱房','天使房']),{level:'close',entries:[{value:'宝箱房',level:'correct'},{value:'商店',level:'wrong'}]});
 assert.deepEqual(compareSetMembers(['攻击性'],['攻击性','书本']),{level:'close',entries:[{value:'攻击性',level:'correct'}]});
 assert.deepEqual(compareSetMembers([],[]),{level:'correct',entries:[]});
 assert.deepEqual(compareSetMembers([],['攻击性']),{level:'wrong',entries:[]});
 assert.deepEqual(compareSetMembers(['书本'],[]),{level:'wrong',entries:[{value:'书本',level:'wrong'}]});
 assert.equal(compareSetMembers(['书本','攻击性'],['攻击性','书本']).level,'correct');
});
test('set matching handles overlap, no overlap, order, duplicates and empty sets',()=>{
 assert.equal(compareSet(['a','b'],['b','a']),'correct');
 assert.equal(compareSet(['a','a'],['a']),'correct');
 assert.equal(compareSet(['a','b'],['b','c']),'close');
 assert.equal(compareSet(['a'],['b']),'wrong');
 assert.equal(compareSet([],[]),'correct');
 assert.equal(compareSet([],['a']),'wrong');
});
test('quality direction points to the target; adjacent ID gives no direction',()=>{
 const g={...byId.get(1),quality:1,id:100},t={...byId.get(1),quality:2,id:101};
 assert.deepEqual(compare(g,t).quality,{level:'close',direction:'↑'});
 assert.deepEqual(compare(t,g).quality,{level:'close',direction:'↓'});
 assert.equal(compare(g,t).adjacent,true);assert.equal(compare(g,t).correct,false);
});
test('identical clue values do not win unless item IDs match',()=>{
 const a=byId.get(1), b={...a,id:9000};assert.equal(compare(a,b).correct,false);assert.equal(compare(a,a).correct,true);
});
test('familiar and passive partially match; active and passive do not',()=>{
 assert.equal(compare(byId.get(8),byId.get(1)).type,'close');
 assert.equal(compare(byId.get(105),byId.get(1)).type,'wrong');
});
test('charges distinguish missing, zero, timed, normal and special',()=>{
 assert.equal(chargeLabel(null),'不适用');assert.equal(chargeLabel({kind:'normal',value:0}),'无充能条');
 assert.equal(chargeLabel({kind:'timed',value:90}),'3 秒');
 assert.equal(compareCharge(null,null).level,'correct');
 assert.equal(compareCharge(null,{kind:'normal',value:0}).level,'wrong');
 assert.deepEqual(compareCharge({kind:'normal',value:4},{kind:'normal',value:6}),{level:'wrong',direction:'↑'});
 assert.deepEqual(compareCharge({kind:'normal',value:4},{kind:'timed',value:4}),{level:'wrong',direction:''});
 assert.deepEqual(compareCharge({kind:'special',value:64},{kind:'special',value:6}),{level:'correct',direction:''});
});
test('Chinese, aliases, English, pinyin, initials, full-width input and IDs find the intended item',()=>{
 for(const [q,id] of [['狗头',4],['妈刀',114],['D6',105],['硫磺火',118],['liuhuanghuo',118],['lhh',118],['brimstone',118],['１０５',105],['c105',105],['20/20',245],['科技2',152]]){
  assert.equal(searchItems(items,q)[0]?.id,id,q);
 }
 assert.equal(searchItems(items,'',[]).length,0);
 assert.ok(!searchItems(items,'D6',[105]).some(x=>x.id===105));
 assert.equal(searchItems(items,'不存在的道具abc').length,0);
});
test('duplicates and unknown IDs do not consume guesses',()=>{
 const first=submitGuess(round(),1,items).state;
 assert.ok(submitGuess(first,1,items).error);assert.equal(first.guesses.length,1);
 assert.ok(submitGuess(first,9999,items).error);
});
test('win and eight misses close a round, reveal also closes it',()=>{
 const won=submitGuess(round(),105,items).state;assert.equal(roundStatus(won),'won');assert.ok(submitGuess(won,1,items).error);
 let state=round();for(const id of [1,2,3,4,5,6,7,8])state=submitGuess(state,id,items).state;
 assert.equal(roundStatus(state),'lost');assert.ok(submitGuess(state,105,items).error);
 assert.equal(roundStatus({...round(),revealed:true}),'lost');
});
test('saved progress survives reload; invalid and obsolete saves are discarded',()=>{
 const state={...round(),guesses:[1,2]};assert.deepEqual(restoreRound(JSON.stringify(state),data),state);
 for(const invalid of [{...state,version:'old'},{...state,targetId:9999},{...state,guesses:[1,1]},{...state,guesses:[105,1]},{...state,revealed:'yes'}])assert.equal(restoreRound(JSON.stringify(invalid),data),null);
 assert.equal(restoreRound('{bad',data),null);
});
