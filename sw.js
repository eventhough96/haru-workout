const CACHE='haru-workout-shell-v1.0.0';
const FILES=['./','./index.html','./styles.css','./engine.js','./app.js','./icon.svg','./icon-192.png','./icon-512.png','./manifest.webmanifest'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES)));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('haru-workout-shell-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;
  if(event.request.mode==='navigate'){
    event.respondWith(fetch(event.request).then(r=>r.ok?r:caches.match('./index.html').then(c=>c||r)).catch(()=>caches.match('./index.html')));return;
  }
  const allowed=new Set(FILES.map(path=>new URL(path,self.registration.scope).href));
  if(!allowed.has(event.request.url))return;
  event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request)));
});
