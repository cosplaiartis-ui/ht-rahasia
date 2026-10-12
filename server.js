// Relay PTT: hanya meneruskan ciphertext. Tidak pernah melihat passphrase/nama room.
const http=require('http'),fs=require('fs'),path=require('path'),{WebSocketServer}=require('ws');
const PORT=process.env.PORT||8787,PUB=path.join(__dirname,'public');
const MIME={'.html':'text/html','.js':'text/javascript','.json':'application/json','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';
 const f=path.join(PUB,path.normalize(p));if(!f.startsWith(PUB))return r.writeHead(403).end();
 fs.readFile(f,(e,d)=>{if(e)return r.writeHead(404).end('404');r.writeHead(200,{'content-type':MIME[path.extname(f)]||'application/octet-stream'});r.end(d)})});
const wss=new WebSocketServer({server:srv,maxPayload:65536});const rooms=new Map();let nid=0;
const send=(ws,o)=>ws.readyState===1&&ws.send(JSON.stringify(o));
function bc(room,o,except){for(const c of room.clients)if(c!==except)send(c,o)}
function release(ws){const room=ws.room;if(room&&room.floor===ws){room.floor=null;bc(room,{t:'floor',busy:false})}}
wss.on('connection',ws=>{ws.id=++nid;ws.isAlive=true;ws.on('pong',()=>ws.isAlive=true);
 ws.on('message',(data,isBin)=>{const room=ws.room;
  if(isBin){if(room&&room.floor===ws)for(const c of room.clients)if(c!==ws&&c.readyState===1)c.send(data,{binary:true});return}
  let m;try{m=JSON.parse(data)}catch{return}
  if(m.t==='join'&&!room&&/^[0-9a-f]{64}$/.test(m.room)){let r=rooms.get(m.room);if(!r)rooms.set(m.room,r={clients:new Set(),floor:null});
   r.clients.add(ws);ws.room=r;send(ws,{t:'joined',id:ws.id,n:r.clients.size,busy:!!r.floor});bc(r,{t:'peers',n:r.clients.size})}
  else if(m.t==='talk'&&room){if(!room.floor){room.floor=ws;send(ws,{t:'granted'});bc(room,{t:'floor',busy:true},ws)}else if(room.floor!==ws)send(ws,{t:'busy'})}
  else if(m.t==='release')release(ws)});
 ws.on('close',()=>{const r=ws.room;if(!r)return;release(ws);r.clients.delete(ws);if(!r.clients.size)for(const[k,v]of rooms)if(v===r)rooms.delete(k);bc(r,{t:'peers',n:r.clients.size})})});
setInterval(()=>wss.clients.forEach(ws=>{if(!ws.isAlive)return ws.terminate();ws.isAlive=false;ws.ping()}),20000);
srv.listen(PORT,()=>console.log('PTT relay on :'+PORT));
