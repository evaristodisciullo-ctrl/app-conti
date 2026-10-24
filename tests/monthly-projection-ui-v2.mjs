import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {extname,resolve,sep} from 'node:path';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';

const root=resolve('www'),mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml'};
const server=createServer(async(req,res)=>{try{const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=resolve(root,path==='/'?'index.html':'.'+path);if(file!==root&&!file.startsWith(root+sep)){res.writeHead(403).end();return}res.writeHead(200,{'content-type':mime[extname(file)]||'application/octet-stream','cache-control':'no-store'}).end(await readFile(file))}catch{res.writeHead(404).end('Not found')}});
await new Promise((ok,fail)=>{server.once('error',fail);server.listen(4175,'127.0.0.1',ok)});
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true,locale:'it-IT'});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const isoMonth=date=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;
const shift=(ym,n)=>{const [year,month]=ym.split('-').map(Number),date=new Date(year,month-1+n,1);return isoMonth(date)};
const monthLabel=ym=>{const [year,month]=ym.split('-').map(Number),label=new Intl.DateTimeFormat('it-IT',{month:'long',year:'numeric'}).format(new Date(year,month-1,1));return label[0].toLocaleUpperCase('it-IT')+label.slice(1)};
try{
 await page.goto('http://127.0.0.1:4175/',{waitUntil:'networkidle'});
 const fixture=await page.evaluate(()=>{
  const now=new Date(),key=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`,nextDate=new Date(now.getFullYear(),now.getMonth()+1,1),next=`${nextDate.getFullYear()}-${String(nextDate.getMonth()+1).padStart(2,'0')}`;
  const date=(ym,day)=>`${ym}-${String(day).padStart(2,'0')}`;
  const state={version:2,balance:1000,entries:[
   {id:'test-current-income',kind:'income',description:'Entrata del mese',amount:120,date:date(key,5),datePrecision:'day'},
   {id:'test-current-expense',kind:'expense',description:'Uscita del mese',amount:50,date:date(key,8),datePrecision:'day'},
   {id:'test-future-income',kind:'income',description:'Entrata futura',amount:500,date:date(next,5),datePrecision:'day'},
   {id:'test-future-expense',kind:'expense',description:'Uscita futura',amount:200,date:date(next,8),datePrecision:'day'}
  ],history:[],financeNotifications:{enabled:false,defaultTime:'09:00'},todo:{tasks:[],done:[],notifications:{enabled:false,rule:{advanceDays:0,time:'09:00'}}}};
  localStorage.setItem('inOrdineV2State',JSON.stringify(state));return {key,next};
 });
 await page.reload({waitUntil:'networkidle'});const persisted=await page.evaluate(()=>localStorage.getItem('inOrdineV2State'));await page.locator('[data-go="money"]').click();
 assert.equal(await page.locator('[data-home-month-nav]').count(),1,'Home has one monthly navigation bar');
 assert.equal(await page.locator('.section-kicker + .balance > [data-home-month-nav]').count(),1,'month navigation is inside the balance card at its top');
 assert.equal(await page.locator('[data-home-month-nav]').evaluate(nav=>getComputedStyle(nav).backgroundColor),'rgb(243, 245, 249)','Home month navigation has the requested light-gray rectangle');
 assert.equal(await page.locator('.month-nav b').innerText(),monthLabel(fixture.key),'Home opens on the current month');
 assert.equal(await page.locator('.balance .balance-label small').innerText(),'Saldo reale','current month retains the actual balance label');
 const values=async()=>page.locator('.balance').evaluate(card=>({initial:card.querySelector('.balance-art-wrap strong')?.textContent.trim(),receive:card.querySelector('.finance-summary-metrics span:nth-child(1) b')?.textContent.trim(),pay:card.querySelector('.finance-summary-metrics span:nth-child(2) b')?.textContent.trim(),ending:card.querySelector('.finance-summary-metrics span:nth-child(3) b')?.textContent.trim()}));
 assert.deepEqual(await values(),{initial:'1.000,00 €',receive:'120,00 €',pay:'50,00 €',ending:'1.070,00 €'},'current month shows exact real and pending figures');
 await page.locator('[data-home-month-step="1"]').click();
 assert.equal(await page.locator('.month-nav b').innerText(),monthLabel(fixture.next),'next arrow changes the selected month');
 assert.equal(await page.locator('.balance .balance-label small').innerText(),'Saldo iniziale previsto','future month is labeled as a forecast');
 assert.equal(await page.locator('#setBalance').isDisabled(),true,'real balance cannot be changed while viewing a future month');
 assert.deepEqual(await values(),{initial:'1.070,00 €',receive:'500,00 €',pay:'200,00 €',ending:'1.370,00 €'},'future month rolls the previous projected ending forward exactly once');
 await page.locator('[data-home-month-step="-1"]').click();
 assert.equal(await page.locator('.month-nav b').innerText(),monthLabel(fixture.key),'previous arrow returns to the same month');
 assert.deepEqual(await values(),{initial:'1.000,00 €',receive:'120,00 €',pay:'50,00 €',ending:'1.070,00 €'},'returning restores the identical figures');
 assert.equal(await page.evaluate(()=>localStorage.getItem('inOrdineV2State')),persisted,'month navigation does not alter or create saved operations');
 await page.locator('[data-home-month-step="-1"]').click();
 assert.equal(await page.locator('.balance .balance-label small').innerText(),'Saldo storico non ricostruibile','past months do not display invented historical balances');
 assert.equal(await page.locator('.balance-art-wrap strong').innerText(),'—','unreconstructible past balance is left blank');
 assert.equal(await page.locator('#setBalance').isDisabled(),true,'real balance editing is unavailable while viewing past months');
 await page.locator('[data-go="landing"]').click();await page.locator('[data-go="money"]').click();
 assert.equal(await page.locator('.month-nav b').innerText(),monthLabel(fixture.key),'re-entering Home resets the selection to the current month');
 assert.equal(await page.evaluate(()=>localStorage.getItem('inOrdineV2State')),persisted,'re-entry still preserves all persisted data');
 for(const width of [320,360,390,430]){
  await page.setViewportSize({width,height:900});
  const geometry=await page.locator('[data-home-month-nav]').evaluate(nav=>{const n=nav.getBoundingClientRect(),balance=nav.nextElementSibling.getBoundingClientRect(),prev=nav.querySelector('[data-home-month-step="-1"]').getBoundingClientRect(),next=nav.querySelector('[data-home-month-step="1"]').getBoundingClientRect(),label=nav.querySelector('b').getBoundingClientRect();return {n:{left:n.left,right:n.right,top:n.top,bottom:n.bottom},balance:{left:balance.left,right:balance.right,top:balance.top,bottom:balance.bottom},prev:{left:prev.left,right:prev.right},next:{left:next.left,right:next.right},label:{left:label.left,right:label.right},documentWidth:document.documentElement.scrollWidth,viewport:innerWidth}});
  assert.equal(geometry.documentWidth,geometry.viewport,`no horizontal overflow at ${width}px`);
  assert.ok(geometry.n.left>=geometry.balance.left&&geometry.n.right<=geometry.balance.right,`month bar remains aligned with summary at ${width}px`);
  assert.ok(geometry.n.bottom<=geometry.balance.top,`month bar does not overlap summary at ${width}px`);
  assert.ok(geometry.prev.right<=geometry.label.left&&geometry.label.right<=geometry.next.left,`arrows and month label remain distinct at ${width}px`);
  assert.ok(geometry.balance.bottom>geometry.balance.top,`summary card remains visible at ${width}px`);
  if(width===390)await page.screenshot({path:'/tmp/in-ordine-monthly-home.png',fullPage:true});
 }
 assert.deepEqual(errors,[],'Home month navigation produces no browser errors');
 console.log('Monthly projection UI tests passed: current/future/past states, exact values, navigation, persistence, 320/360/390/430 px layout');
}finally{await browser.close();server.close()}
