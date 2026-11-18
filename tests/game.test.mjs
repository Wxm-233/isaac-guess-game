import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { compare,compareSet,compareCharge,chargeLabel,searchItems,submitGuess,roundStatus,restoreRound } from '../public/game.js';

const data=JSON.parse(readFileSync(new URL('../public/data/items.json',import.meta.url)));
const items=data.items, byId=new Map(items.map(x=>[x.id,x]));
const round = (targetId=105)=>({version:data.version,targetId,guesses:[],revealed:false,counted:false});

test('717 unique non-hidden collectibles, every item has complete local resources and search data',()=>{
 assert.equal(items.length,717);assert.equal(byId.size,717);
 for(const x of items){
  assert.ok(x.name&&x.english&&x.pinyin&&x.initials&&x.description,`missing text ${x.id}`);
  assert.ok(Number.isInteger(x.quality)&&x.quality>=0&&x.quality<=4);
  assert.ok(existsSync(new URL(`../public${x.image}`,import.meta.url)),`missing image ${x.id}`);
  assert.ok(['active','passive','familiar'].includes(x.type));
  assert.equal(x.charge!==null,x.type==='active');
  assert.equal(typeof x.unlock,'boolean');
 }
 for(const id of [59,656,714,715])assert.ok(!byId.has(id));
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
