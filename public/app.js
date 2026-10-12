const $=id=>document.getElementById(id),RATE=16000;let ws,key,ac,mic,proc,tx=false,want=false,busy=false,next=0,myName='',talker='';
const q=new URLSearchParams(location.search);const RELAY=q.get('relay')||((location.protocol==='https:'?'wss://':'ws://')+location.host);
if('serviceWorker'in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});
$('room').value=q.get('room')||localStorage.room||'';$('name').value=localStorage.nm||'';
function st(t){$('st').textContent=t}
function beep(f1,f2){if(!ac)return;const o=ac.createOscillator(),g=ac.createGain(),t=ac.currentTime;o.frequency.setValueAtTime(f1,t);o.frequency.setValueAtTime(f2,t+.07);
 g.gain.setValueAtTime(.15,t);g.gain.exponentialRampToValueAtTime(.001,t+.15);o.connect(g).connect(ac.destination);o.start(t);o.stop(t+.16)}
function ui(){const b=$('ptt');b.className=tx?'tx':busy?'busy':'';st(tx?'🔴 Sedang bicara...':busy?('🔊 '+(talker||'Seseorang')+' bicara'):'Siaga')}
async function sendEnc(type,payload){if(!ws||ws.readyState!==1)return;const p=new Uint8Array(1+payload.length);p[0]=type;p.set(payload,1);ws.send(await seal(key,p))}
$('go').onclick=async()=>{const room=$('room').value.trim(),pass=$('pass').value;myName=$('name').value.trim()||'Anon';
 if(!room||pass.length<6)return alert('Isi nama channel dan kata sandi (min. 6 karakter)');localStorage.room=room;localStorage.nm=myName;
 $('go').textContent='Menyiapkan kunci...';ac=new (window.AudioContext||window.webkitAudioContext)();
 try{mic=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}})}catch(e){alert('Izin mikrofon ditolak');$('go').textContent='Masuk Channel';return}
 const d=await deriveRoom(room,pass);key=d.key;connect(d.id,room);setupMic()};
function connect(id,room){ws=new WebSocket(RELAY);ws.binaryType='arraybuffer';
 ws.onopen=()=>ws.send(JSON.stringify({t:'join',room:id}));
 ws.onclose=()=>{st('Terputus, menyambung ulang...');tx=false;setTimeout(()=>key&&connect(id,room),2000)};
 ws.onmessage=async e=>{if(typeof e.data!=='string')return onAudio(e.data);const m=JSON.parse(e.data);
  if(m.t==='joined'){$('join').style.display='none';$('radio').style.display='block';busy=m.busy;$('info').textContent='Channel: '+room+' · '+m.n+' online · 🔒 E2E';ui()}
  else if(m.t==='peers')$('info').textContent='Channel: '+room+' · '+m.n+' online · 🔒 E2E';
  else if(m.t==='granted'){if(!want){ws.send('{"t":"release"}');return}tx=true;beep(800,1200);sendEnc(2,new TextEncoder().encode(myName));ui()}
  else if(m.t==='busy'){beep(300,300);st('⛔ Channel sedang dipakai')}
  else if(m.t==='floor'){if(busy&&!m.busy)beep(1200,800);busy=m.busy;if(!busy)talker='';else{beep(800,1200);next=0}ui()}}}
async function onAudio(buf){let p;try{p=await open(key,buf)}catch{return}
 if(p[0]===2){talker=new TextDecoder().decode(p.slice(1));ui();return}
 if(p[0]!==1)return;const s=new Int16Array(p.buffer.slice(1,p.length-((p.length-1)%2)));
 const b=ac.createBuffer(1,s.length,RATE),c=b.getChannelData(0);for(let i=0;i<s.length;i++)c[i]=s[i]/32768;
 const src=ac.createBufferSource();src.buffer=b;src.connect(ac.destination);const now=ac.currentTime;if(next<now)next=now+.12;src.start(next);next+=b.duration}
function setupMic(){const s=ac.createMediaStreamSource(mic);proc=ac.createScriptProcessor(2048,1,1);const ratio=ac.sampleRate/RATE;
 proc.onaudioprocess=e=>{if(!tx)return;const inp=e.inputBuffer.getChannelData(0),n=Math.floor(inp.length/ratio),out=new Int16Array(n);
  for(let i=0;i<n;i++){let a=0,k=0;for(let j=Math.floor(i*ratio);j<Math.floor((i+1)*ratio);j++){a+=inp[j];k++}const v=Math.max(-1,Math.min(1,a/(k||1)));out[i]=v*32767}
  sendEnc(1,new Uint8Array(out.buffer))};const z=ac.createGain();z.gain.value=0;s.connect(proc);proc.connect(z).connect(ac.destination)}
function down(e){e&&e.preventDefault();if(ac.state==='suspended')ac.resume();want=true;ws.send('{"t":"talk"}')}
function up(e){e&&e.preventDefault();want=false;if(tx){tx=false;beep(1200,800);ws.send('{"t":"release"}');ui()}}
const b=$('ptt');b.addEventListener('pointerdown',down);['pointerup','pointercancel','pointerleave'].forEach(t=>b.addEventListener(t,up));
addEventListener('keydown',e=>{if(e.code==='Space'&&!e.repeat&&key){down(e)}});addEventListener('keyup',e=>{if(e.code==='Space'&&key)up(e)});
$('out').onclick=()=>location.reload();
