// E2E: PBKDF2(passphrase, salt=room) -> 512 bit; 256 pertama = kunci AES-GCM, 256 berikutnya di-SHA256 jadi roomId.
const E=new TextEncoder();
async function deriveRoom(room,pass){const base=await crypto.subtle.importKey('raw',E.encode(pass),'PBKDF2',false,['deriveBits']);
 const bits=new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',salt:E.encode('ptt-ht-v1:'+room.trim().toLowerCase()),iterations:200000,hash:'SHA-256'},base,512));
 const key=await crypto.subtle.importKey('raw',bits.slice(0,32),'AES-GCM',false,['encrypt','decrypt']);
 const id=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bits.slice(32)))].map(b=>b.toString(16).padStart(2,'0')).join('');
 return {key,id}}
async function seal(key,pt){const iv=crypto.getRandomValues(new Uint8Array(12));const ct=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},key,pt));
 const o=new Uint8Array(12+ct.length);o.set(iv);o.set(ct,12);return o}
async function open(key,buf){const b=new Uint8Array(buf);return new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv:b.slice(0,12)},key,b.slice(12)))}
if(typeof module!=='undefined')module.exports={deriveRoom,seal,open};
