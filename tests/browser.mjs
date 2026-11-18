// Optional browser QA: PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs node tests/browser.mjs
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser=await chromium.launch({headless:true});
const errors=[];
const base=process.env.DEMO_URL||'http://127.0.0.1:5173';
const shots=process.env.SCREENSHOT_DIR||'/tmp/isaac-demo-screenshots';
await mkdir(shots,{recursive:true});
async function setup(viewport={width:1440,height:1000}){
 const context=await browser.newContext({viewport});
 await context.addInitScript(()=>{if(!localStorage.getItem('isaac-guess-demo-v1'))localStorage.setItem('isaac-guess-demo-v1',JSON.stringify({round:{version:'repentance-1.7.9b-demo-1',targetId:105,guesses:[],revealed:false,counted:false},stats:{played:0,won:0,best:null}}));});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base);await page.waitForFunction(()=>document.querySelector('#dataset-count').textContent==='717 件道具');
 return {context,page};
}
async function guess(page,query){await page.locator('#guess-input').fill(query);await page.locator('[role=option]').first().waitFor();await page.locator('#guess-input').press('Enter');}
try{
 // Enter triggers a synthetic click on the form's submit button before submit.
 // Both keyboard and button submission must keep the highlighted option.
 for (const viewport of [{width:1440,height:1000},{width:390,height:844}]) {
  for (const [keys,method] of [[['ArrowDown'],'enter'],[['ArrowUp'],'enter'],[['ArrowDown','ArrowDown','ArrowUp'],'button']]) {
   const keyboard=await setup(viewport), field=keyboard.page.locator('#guess-input');
   await field.fill('妈妈');
   const options=keyboard.page.locator('[role=option]');
   assert.ok(await options.count()>2);
   const first=await options.first().getAttribute('data-id');
   for(const key of keys)await field.press(key);
   const highlighted=keyboard.page.locator('[role=option][aria-selected=true]');
   const expected=Number(await highlighted.getAttribute('data-id'));
   assert.notEqual(expected,Number(first));
   assert.equal(await field.getAttribute('aria-activedescendant'),await highlighted.getAttribute('id'));
   if(method==='enter')await field.press('Enter');else await keyboard.page.locator('#guess-button').click();
   const submitted=await keyboard.page.evaluate(()=>JSON.parse(localStorage.getItem('isaac-guess-demo-v1')).round.guesses);
   assert.deepEqual(submitted,[expected],`${viewport.width}px ${keys.join(',')} + ${method} must submit highlighted item`);
   assert.equal(await keyboard.page.locator('#guess-rows tr').count(),1);
   await keyboard.context.close();
  }
 }
 const {context,page}=await setup();
 await page.screenshot({path:`${shots}/desktop.png`,fullPage:true});
 assert.equal(await page.locator('.heart:not(.used)').count(),8);
 await page.locator('#guess-input').fill('狗头');assert.match(await page.locator('[role=option]').first().innerText(),/柯吉猫的头/);
 await page.locator('#guess-input').evaluate(el=>el.dispatchEvent(new CompositionEvent('compositionstart')));
 await page.locator('#guess-input').press('Enter');assert.equal(await page.locator('#guess-rows tr').count(),0);
 await page.locator('#guess-input').evaluate(el=>el.dispatchEvent(new CompositionEvent('compositionend')));
 await page.locator('[role=option]').first().click();
 assert.equal(await page.locator('#guess-rows tr').count(),1);
 await page.reload();await page.waitForSelector('#guess-rows tr');assert.equal(await page.locator('#guess-rows tr').count(),1);
 await page.locator('#guess-input').fill('不存在的名字');await page.locator('#guess-button').click();assert.equal(await page.locator('#guess-rows tr').count(),1);
 await page.locator('#guess-input').fill('lhh');assert.match(await page.locator('[role=option]').first().innerText(),/硫磺火/);
 await page.locator('#guess-input').press('Escape');assert.equal(await page.locator('#suggestions').isVisible(),false);
 await guess(page,'D6');assert.match(await page.locator('#result h2').innerText(),/2 次/);
 assert.equal(await page.locator('#guess-input').isDisabled(),true);assert.equal(await page.locator('#stat-played').innerText(),'1');
 await page.screenshot({path:`${shots}/win.png`,fullPage:true});
 await page.reload();await page.waitForSelector('#result h2');assert.equal(await page.locator('#stat-played').innerText(),'1');
 await page.locator('#play-again').click();assert.equal(await page.locator('#guess-rows tr').count(),0);assert.equal(await page.locator('#result').isVisible(),false);
 await page.locator('#give-up').click();await page.locator('#cancel-action').click();assert.equal(await page.locator('#result').isVisible(),false);
 await page.locator('#give-up').click();await page.locator('#confirm-action').click();assert.equal(await page.locator('#stat-played').innerText(),'2');assert.equal(await page.locator('#stat-rate').innerText(),'50%');
 await page.locator('#rules-button').click();assert.equal(await page.locator('#modal').isVisible(),true);await page.keyboard.press('Escape');
 assert.equal(await page.locator('img').evaluateAll(imgs=>imgs.filter(i=>!i.complete||!i.naturalWidth).length),0);
 await context.close();
 const mobile=await setup({width:390,height:844});
 await mobile.page.screenshot({path:`${shots}/mobile.png`,fullPage:true});
 assert.ok(await mobile.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'mobile document overflows');
 for(let i=1;i<=8;i++)await guess(mobile.page,`c${i}`);
 assert.equal(await mobile.page.locator('#guess-rows tr').count(),8);assert.equal(await mobile.page.locator('#result').isVisible(),true);assert.equal(await mobile.page.locator('#stat-rate').innerText(),'0%');
 await mobile.page.screenshot({path:`${shots}/mobile-loss.png`,fullPage:true});
 await mobile.page.reload();await mobile.page.waitForSelector('#result h2');assert.equal(await mobile.page.locator('#stat-played').innerText(),'1');
 assert.deepEqual(errors,[]);
 console.log('PASS: desktop/mobile, aliases/pinyin, IME, guesses, win/loss, refresh, reveal, modal, statistics, images.');
 console.log(`Screenshots: ${shots}`);
 await mobile.context.close();
}finally{await browser.close();}
