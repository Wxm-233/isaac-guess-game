// Optional browser QA: PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs node tests/browser.mjs
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
const dataset=JSON.parse(await readFile(new URL('../public/data/items.json',import.meta.url),'utf8'));
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH});
const errors=[];
const base=process.env.DEMO_URL||'http://127.0.0.1:5173';
const shots=process.env.SCREENSHOT_DIR||'/tmp/isaac-demo-screenshots';
await mkdir(shots,{recursive:true});
async function setup(viewport={width:1440,height:1000},saved={round:{version:dataset.version,targetId:105,guesses:[],revealed:false,counted:false},stats:{played:0,won:0,best:null}}){
 const context=await browser.newContext({viewport});
 await context.addInitScript(saved=>{if(!localStorage.getItem('isaac-guess-demo-v1'))localStorage.setItem('isaac-guess-demo-v1',JSON.stringify(saved));},saved);
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base);await page.waitForFunction(count=>document.querySelector('#dataset-count').textContent===`${count} 件道具`,dataset.items.length);
 return {context,page};
}
async function guess(page,query){await page.locator('#guess-input').fill(query);await page.locator('[role=option]').first().waitFor();await page.locator('#guess-input').press('Enter');}
try{
 // Check actual content bounds, including long pool names and the suggestion menu.
 for(const width of [320,390,550,760,850,1024,1280,1440,1920]){
  const layout=await setup({width,height:1000},{round:{version:dataset.version,targetId:105,guesses:[1,33,42],revealed:false,counted:false},stats:{played:0,won:0,best:null}});
  const field=layout.page.locator('#guess-input');
  await field.fill('妈妈');
  const metrics=await layout.page.evaluate(()=>{
   const table=document.querySelector('.table-scroll');
   const row=document.querySelector('#guess-rows tr');
   const cells=[...row.querySelectorAll('td')].map(el=>el.getBoundingClientRect());
   const menu=document.querySelector('#suggestions').getBoundingClientRect();
   return {page:document.documentElement.scrollWidth,viewport:innerWidth,table:table.scrollWidth,tableWidth:table.clientWidth,inputFont:parseFloat(getComputedStyle(document.querySelector('#guess-input')).fontSize),menuLeft:menu.left,menuRight:menu.right,card:getComputedStyle(row).display,labels:[...row.querySelectorAll('.feedback-label')].map(el=>el.textContent),nameY:cells[0].top,poolsY:cells[3].top,qualityY:cells[1].top,main:document.querySelector('main').getBoundingClientRect().width};
  });
  assert.ok(metrics.page<=width,`${width}px page overflows`);
  assert.ok(metrics.table<=metrics.tableWidth+1,`${width}px results require horizontal scrolling`);
  assert.ok(metrics.inputFont>=16,`${width}px input text is too small`);
  assert.ok(metrics.menuLeft>=0&&metrics.menuRight<=width,`${width}px suggestions overflow`);
  if(width<=760){
   assert.equal(metrics.card,'grid');
   assert.deepEqual(metrics.labels,['品质','类型','道具池','标签','充能','需解锁']);
   assert.ok(metrics.nameY<metrics.qualityY&&metrics.qualityY<metrics.poolsY);
  }
  if(width===1920)assert.ok(metrics.main>=1800,'desktop content should use most of the viewport');
  await field.press('Escape');await field.blur();
  if([390,1920].includes(width))await layout.page.screenshot({path:`${shots}/layout-${width}.png`,fullPage:true,animations:'disabled'});
  await layout.context.close();
 }
 const previous={round:{version:'repentance-1.7.9b-demo-1',targetId:105,guesses:[1,2],revealed:false,counted:false},stats:{played:7,won:4,best:2}};
 const migration=await setup(undefined,previous);
 const migrated=await migration.page.evaluate(()=>JSON.parse(localStorage.getItem('isaac-guess-demo-v1')));
 assert.equal(migrated.round.version,dataset.version);
 assert.deepEqual(migrated.round.guesses,[]);
 assert.deepEqual(migrated.stats,previous.stats);
 assert.equal(await migration.page.locator('.version-pill').getAttribute('title'),dataset.gameVersion);
 await migration.page.locator('#about-button').click();
 assert.ok((await migration.page.locator('#modal-content').innerText()).includes(dataset.gameVersion));
 await migration.context.close();
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
