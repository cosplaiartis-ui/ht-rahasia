const WebSocket=require('ws');const {deriveRoom,seal,open}=require('./public/crypto.js');globalThis.crypto??=require('crypto').webcrypto;
const U='ws://localhost:8787';(async()=>{const {key,id}=await deriveRoom('Tim A','rahasia123');const wrong=await deriveRoom('Tim A','salah999');
const mk=()=>new Promise(r=>{const w=new WebSocket(U);w.binaryType='arraybuffer';w.msgs=[];w.on('message',(d,b)=>w.msgs.push(b?d:JSON.parse(d)));w.on('open',()=>r(w))});
const a=await mk(),b=await mk(),c=await mk();a.send(JSON.stringify({t:'join',room:id}));b.send(JSON.stringify({t:'join',room:id}));c.send(JSON.stringify({t:'join',room:wrong.id}));
await new Promise(r=>setTimeout(r,200));a.send('{"t":"talk"}');await new Promise(r=>setTimeout(r,100));b.send('{"t":"talk"}');
const pt=new Uint8Array([1,...Buffer.from('AUDIO-PCM-SAMPLE')]);a.send(await seal(key,pt));await new Promise(r=>setTimeout(r,200));
const bin=b.msgs.find(m=>m instanceof ArrayBuffer);const ok=Buffer.from(await open(key,bin)).equals(Buffer.from(pt));
let wrongFail=false;try{await open(wrong.key,bin)}catch{wrongFail=true}
console.log({granted:a.msgs.some(m=>m.t==='granted'),bBusy:b.msgs.some(m=>m.t==='busy'),relayedIsCiphertext:!Buffer.from(bin).includes(Buffer.from('AUDIO')),decryptOK:ok,wrongKeyFails:wrongFail,otherRoomGotNothing:!c.msgs.some(m=>m instanceof ArrayBuffer)});process.exit(0)})();
