self.addEventListener('install',e=>e.waitUntil(caches.open('ht1').then(c=>c.addAll(['./','index.html','app.js','crypto.js']))));
self.addEventListener('fetch',e=>e.respondWith(fetch(e.request).catch(()=>caches.match(e.request))));
