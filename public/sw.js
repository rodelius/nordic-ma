self.addEventListener('push', event => {
 let data;try{data=event.data.json();}catch{return;}
 event.waitUntil(self.registration.showNotification(data.title||'Nordic FICC', {body:data.body,icon:'/icon-192.png',tag:data.tag||data.url,data:{url:data.url||'/'}}));
});
self.addEventListener('notificationclick', event => {
 event.notification.close();
 const url=new URL(event.notification.data?.url||'/',self.location.origin);
 if(url.origin!==self.location.origin)return;
 event.waitUntil(clients.openWindow(url.href));
});
