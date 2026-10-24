export function validateSubscription(input:unknown):{endpoint:string;keys:{p256dh:string;auth:string}}{
 if(!input||typeof input!=='object')throw Error('Invalid subscription');
 const s=input as {endpoint:string;keys:{p256dh:string;auth:string}};
 const u=new URL(s.endpoint),allowed=['fcm.googleapis.com','updates.push.services.mozilla.com','web.push.apple.com'];
 if(u.protocol!=='https:'||u.port||u.username||u.password||!allowed.some(h=>u.hostname===h||(h==='web.push.apple.com'&&new RegExp('^[a-z0-9-]+\\.'+h.replace(/\./g,'\\.')+'$').test(u.hostname)))||u.pathname==='/'||s.endpoint.length>4096||!s.keys||!/^[-_A-Za-z0-9]{80,100}$/.test(s.keys.p256dh)||!/^[-_A-Za-z0-9]{20,30}$/.test(s.keys.auth))throw Error('Invalid browser push subscription');
 return {endpoint:u.href,keys:{p256dh:s.keys.p256dh,auth:s.keys.auth}};
}
