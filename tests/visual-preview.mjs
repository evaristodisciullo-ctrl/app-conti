import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import { chromium } from 'playwright';

const output = resolve(process.argv[2] || '/tmp/in-ordine-v2-rendered-preview');
const sizes = [[360,800],[390,844],[412,915],[430,932]];
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.json':'application/json'};
const root=resolve('www');
const server=createServer(async(req,res)=>{try{const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=resolve(root,path==='/'?'index.html':'.'+path);if(file!==root&&!file.startsWith(root+sep)){res.writeHead(403).end();return}const data=await readFile(file);res.writeHead(200,{'content-type':mime[extname(file)]||'application/octet-stream','cache-control':'no-store'}).end(data)}catch{res.writeHead(404).end('Not found')}});
await new Promise((ok,fail)=>{server.once('error',fail);server.listen(0,'127.0.0.1',ok)});
const address=server.address();
const now=new Date();
const ym=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
const date=(day)=>`${ym}-${String(day).padStart(2,'0')}`;
const previous=new Date(now.getFullYear(),now.getMonth()-1,1);
const prevYm=`${previous.getFullYear()}-${String(previous.getMonth()+1).padStart(2,'0')}`;
const sample={version:2,balance:1445.5,profile:{fullName:''},appColor:'Blu',entries:[
 {id:'preview-income',kind:'income',description:'Stipendio',amount:1500,date:date(15),category:'Stipendio',supplier:'De Cecco',recurrence:'monthly'},
 {id:'preview-expense',kind:'expense',description:'Visita dentista',amount:180,date:date(20),category:'Salute',supplier:'Studio dentistico',recurrence:'none'}
],history:[
 {id:'preview-income-done',kind:'income',description:'Stipendio',amount:1850,date:date(2),category:'Stipendio',supplier:'De Cecco',completedAt:date(2)},
 {id:'preview-expense-done',kind:'expense',description:'Spesa alimentare',amount:404.5,date:date(5),category:'Spesa',supplier:'',completedAt:date(5)}
],adjustments:[],budgetPlans:[{month:ym,total:2200,limits:{Casa:750,Spesa:350,Salute:250}}],budgets:{},todo:{setupDone:true,tasks:[
 {id:'preview-task-dentist',description:'Appuntamento dal dentista',date:date(29),notify:true,recurrence:'none'},
 {id:'preview-task-car',description:'Fare rifornimento',date:date(12),notify:false,recurrence:'none'}
],done:[{id:'preview-task-done',description:'Prenotare la visita',date:date(3),completedAt:date(3)}],color:'Verde E.D.S.',theme:'light',notifications:{enabled:true,rule:{timing:'same',time:'09:00',overdue:'none'},sent:{}}},preferences:{textSize:'medium',reduceAnimations:false,lightTheme:true,showSuggestions:true,dateFormat:'dd/mm/yyyy',categories:['Stipendio','Pensione','Casa','Spesa','Auto','Salute','Tempo libero','Altro']}};
const browser=await chromium.launch({headless:true});
const errors=[];
await mkdir(output,{recursive:true});
const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});
page.on('pageerror',error=>errors.push(error.message));
await page.addInitScript((data)=>localStorage.setItem('inOrdineV2State',JSON.stringify(data)),sample);
const base=`http://127.0.0.1:${address.port}/`;
await page.goto(base,{waitUntil:'networkidle'});
await page.waitForFunction(()=>document.querySelector('.home-art')?.complete&&document.querySelector('.home-art')?.naturalWidth>0);

async function snap(name){
 await page.waitForTimeout(90);
 const state=await page.evaluate(()=>({w:innerWidth,sw:document.documentElement.scrollWidth,bw:document.body.scrollWidth,arts:[...document.querySelectorAll('.hero-art,.section-art')].map(x=>({alt:x.alt,loaded:x.complete&&x.naturalWidth>0}))}));
 assert.ok(state.sw<=state.w&&state.bw<=state.w,`${name} overflows: ${JSON.stringify(state)}`);
 assert.ok(state.arts.every(x=>x.loaded),`${name} illustration failed to load: ${JSON.stringify(state.arts)}`);
 await page.screenshot({path:resolve(output,`${name}.png`),fullPage:true});
 await page.screenshot({path:resolve(output,`phone-${name}.png`),fullPage:false});
}

await snap('01-home');
await page.locator('[data-go="money"]').click(); await snap('02-conti-economici');
await page.locator('[data-go="income"]').click(); await snap('03-entrate');
await page.locator('[data-go="money"]').click(); await page.locator('[data-go="expense"]').click(); await snap('04-pagamenti');
await page.locator('[data-go="money"]').click(); await page.locator('[data-go="movements"]').click(); await snap('05-movimenti');
await page.locator('[data-go="money"]').click(); await page.locator('[data-go="summary"]').click();
assert.ok(await page.locator('.summary-difference strong').evaluate(el=>el.getBoundingClientRect().width>0),'summary amount is visible');
await snap('06-riepilogo');
await page.locator('[data-go="money"]').click(); await page.locator('[data-go="budget"]').click(); await snap('07-budget');
await page.goto(base,{waitUntil:'networkidle'}); await page.locator('[data-go="todo"]').click(); await snap('08-cose-da-fare');
await page.locator('[data-go="todo-active"]').click(); await snap('09-attivita');
await page.locator('[data-go="todo"]').click(); await page.locator('[data-go="todo-done"]').click(); await snap('10-completate');
await page.locator('[data-go="todo"]').click(); await page.locator('[data-go="todo-add"]').click(); await snap('11-nuova-attivita');
await page.locator('[data-go="todo"]').click(); await page.locator('[data-go="landing"]').click(); await page.locator('[data-go="money"]').click(); await page.locator('[data-go="settings"]').click(); await snap('12-impostazioni');
await page.locator('[data-go="appearance"]').click(); await snap('13-colori-e-tema');
assert.equal(errors.length,0,`browser errors: ${errors.join('; ')}`);

for(const [width,height] of sizes){
 await page.setViewportSize({width,height});
 for(const [name,open] of [['home',async()=>{}],['money',async()=>page.locator('[data-go="money"]').click()],['todo',async()=>page.locator('[data-go="todo"]').click()]]){
  await page.goto(base,{waitUntil:'networkidle'});
  await open();
  await page.waitForFunction(()=>[...document.querySelectorAll('.brand-logo,.eds-logo')].some(x=>x.complete&&x.naturalWidth>0));
  const m=await page.evaluate(()=>({w:innerWidth,sw:document.documentElement.scrollWidth,bw:document.body.scrollWidth,logo:[...document.querySelectorAll('.brand-logo,.eds-logo')].some(x=>x.complete&&x.naturalWidth>0)}));
  assert.ok(m.sw<=width&&m.bw<=width&&m.logo,`${name} responsive ${width}x${height}: ${JSON.stringify(m)}`);
 }
 console.log(`PASS visual preview ${width}x${height}`);
}
console.log(`Rendered 13 application screens to ${output}`);
await browser.close();
await new Promise(ok=>server.close(ok));
