self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
// Authenticated pages, order data and private files are deliberately never cached.
self.addEventListener('fetch',event=>{if(event.request.mode==='navigate')event.respondWith(fetch(event.request).catch(()=>new Response('<!doctype html><html><meta name="viewport" content="width=device-width"><title>DBD · Offline</title><body><h1>You’re offline · Hakuna mtandao</h1><p>Reconnect to shop and manage deliveries. Unganisha mtandao kuendelea.</p><button onclick="location.reload()">Try again · Jaribu tena</button></body></html>',{headers:{'Content-Type':'text/html'}})))});
