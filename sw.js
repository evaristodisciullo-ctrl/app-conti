const CACHE='in-ordine-v9';
const CORE=[
  './','./index.html','./manifest.webmanifest','./icon.svg','./native-bridge.js',
  './assets/landing-bg-1.txt','./assets/landing-bg-2.txt','./assets/landing-bg-3.txt',
  './assets/landing-bg-4.txt','./assets/landing-bg-5.txt','./assets/landing-bg-6.txt',
  './assets/saldo-bg.webp','./assets/home-income-art.webp','./assets/home-payment-art.webp',
  './assets/income-banner-approved.txt','./assets/payment-banner.txt','./assets/setup-income-art.txt','./assets/setup-expense-art.txt','./assets/wallet-art.webp'
];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  e.respondWith(fetch(e.request).then(r=>{const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return r}).catch(()=>caches.match(e.request).then(r=>r||caches.match('./index.html'))));
});
self.addEventListener('notificationclick',e=>{e.notification.close();e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(cs=>cs[0]?cs[0].focus():self.clients.openWindow('./')))});
