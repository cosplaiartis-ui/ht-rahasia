const $=id=>document.getElementById(id),RATE=16000,CHUNK=4000/*250ms*/;
const ME=crypto.getRandomValues(new Uint8Array(4)),MEH=[...ME].join('.');
let OUT,wl=null,net,key,ac,mic,tx=false,talkerId=null,talker='',lastRx=0,next=0,myName='',room='',secret='',leader=false,peers=new Map(),pcm=[],pcmLen=0,seq=0;
if('serviceWorker'in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});
const H=new URLSearchParams(location.hash.slice(1));$('name').value=localStorage.nm||'';
if(H.get('r')&&H.get('k')){$('invite').classList.remove('hide');$('create').classList.add('hide')}
const enc=s=>new TextEncoder().encode(s),busy=()=>talkerId&&Date.now()-lastRx<1500;
const rnd=n=>{const a='abcdefghijkmnpqrstuvwxyz23456789',b=crypto.getRandomValues(new Uint8Array(n));return[...b].map(x=>a[x%a.length]).join('')};
function link(){return location.origin+location.pathname+'#r='+encodeURIComponent(room)+'&k='+encodeURIComponent(secret)}
function beep(f1,f2){if(!ac)return;const o=ac.createOscillator(),g=ac.createGain(),t=ac.currentTime;o.frequency.setValueAtTime(f1,t);o.frequency.setValueAtTime(f2,t+.07);
 g.gain.setValueAtTime(.15,t);g.gain.exponentialRampToValueAtTime(.001,t+.15);o.connect(g).connect(OUT);o.start(t);o.stop(t+.16)}
function ui(){const b=$('ptt');b.className=tx?'tx':busy()?'busy':'';$('st').textContent=tx?'🔴 Sedang bicara...':busy()?('🔊 '+(talker||'Seseorang')+' bicara'):'Siaga';
 const now=Date.now();for(const[k,v]of peers)if(now-v.t>15000)peers.delete(k);
 const names=[(leader?'👑 ':'')+myName+' (kamu)',...[...peers.values()].map(p=>(p.l?'👑 ':'')+p.n)];$('mem').textContent='Room '+room+' · Anggota ('+names.length+'): '+names.join(', ')}
function status(u,n){$('conn').textContent=u?`🟢 Terhubung (${u}/${n} relay) · 🔒 E2E`:'🔴 Terputus, menyambung ulang...';$('ptt').disabled=!u}
async function pub(type,payload=new Uint8Array()){if(!net)return;const p=new Uint8Array(5+payload.length);p[0]=type;p.set(ME,1);p.set(payload,5);net.send(await seal(key,p))}
const hb=()=>pub(5,enc(JSON.stringify({n:myName,l:leader})));
async function start(r,s,isLeader){myName=$('name').value.trim();if(!myName){alert('Isi nama panggilan dulu');return}localStorage.nm=myName;
 room=r;secret=s;leader=isLeader;ac=new (window.AudioContext||window.webkitAudioContext)();bgAudio();
 try{mic=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}})}catch(e){alert('Izin mikrofon ditolak – kamu tetap bisa mendengar.')}
 $('home').classList.add('hide');$('radio').classList.remove('hide');if(leader)$('share').classList.remove('hide');
 const d=await deriveRoom(room,secret);key=d.key;history.replaceState(null,'',link());
 net=Net(d.id,onMsg,(u,n)=>{status(u,n);if(u)hb()});if(mic)setupMic();ui()}
$('mk').onclick=()=>start(rnd(6),rnd(22),true);
$('joinLink').onclick=()=>start(H.get('r'),H.get('k'),false);
$('joinMan').onclick=()=>{const r=$('room').value.trim(),p=$('pass').value;if(!r||p.length<6)return alert('Isi nama channel dan kata sandi (min. 6 karakter)');start(r,p,false)};
const shareTxt=()=>'Gabung channel HT Rahasia saya (terenkripsi): '+link();
$('copy').onclick=async()=>{try{await navigator.clipboard.writeText(link());$('copy').textContent='✅ Link tersalin'}catch{prompt('Salin link ini:',link())}};
$('wa').onclick=()=>window.open('https://wa.me/?text='+encodeURIComponent(shareTxt()),'_blank');
$('sh2').onclick=()=>navigator.share?navigator.share({title:'HT Rahasia',text:shareTxt()}).catch(()=>{}):$('share').classList.toggle('hide');
setInterval(()=>{if(key)hb();ui()},5000);setInterval(()=>{if(talkerId&&!busy()){talkerId=null;beep(1200,800);ui()}},500);
async function onMsg(buf){let p;try{p=await open(key,buf)}catch{return}const id=[...p.slice(1,5)].join('.');if(id===MEH)return;const body=p.slice(5);
 if(p[0]===5){const isNew=!peers.has(id);try{const j=JSON.parse(new TextDecoder().decode(body));peers.set(id,{n:j.n,l:j.l,t:Date.now()})}catch{}if(isNew)hb();return ui()}
 if(!peers.has(id))peers.set(id,{n:'?',t:Date.now()});else peers.get(id).t=Date.now();
 if(p[0]===3){if(tx&&id<MEH)stopTx(false);talkerId=id;talker=new TextDecoder().decode(body);lastRx=Date.now();next=0;beep(800,1200);return ui()}
 if(p[0]===4){if(talkerId===id){talkerId=null;beep(1200,800);ui()}return}
 if(p[0]!==1)return;if(!talkerId){talkerId=id;talker=peers.get(id).n;ui()}if(talkerId!==id)return;lastRx=Date.now();
 const s=new Int16Array(body.buffer.slice(body.byteOffset+2,body.byteOffset+2+((body.length-2)&~1)));
 const b=ac.createBuffer(1,s.length,RATE),c=b.getChannelData(0);for(let i=0;i<s.length;i++)c[i]=s[i]/32768;
 const src=ac.createBufferSource();src.buffer=b;src.connect(OUT);const now=ac.currentTime;if(next<now)next=now+.3;src.start(next);next+=b.duration}
function flush(){if(!pcmLen)return;const out=new Uint8Array(2+pcmLen*2),v=new DataView(out.buffer);v.setUint16(0,seq++&65535);let o=2;
 for(const a of pcm)for(let i=0;i<a.length;i++,o+=2)v.setInt16(o,a[i],true);pcm=[];pcmLen=0;pub(1,out)}
function setupMic(){const s=ac.createMediaStreamSource(mic),proc=ac.createScriptProcessor(2048,1,1),ratio=ac.sampleRate/RATE;
 proc.onaudioprocess=e=>{if(!tx)return;const inp=e.inputBuffer.getChannelData(0),n=Math.floor(inp.length/ratio),out=new Int16Array(n);
  for(let i=0;i<n;i++){let a=0,k=0;for(let j=Math.floor(i*ratio);j<Math.floor((i+1)*ratio);j++){a+=inp[j];k++}out[i]=Math.max(-1,Math.min(1,a/(k||1)))*32767}
  pcm.push(out);pcmLen+=n;if(pcmLen>=CHUNK)flush()};const z=ac.createGain();z.gain.value=0;s.connect(proc);proc.connect(z).connect(ac.destination)}
function down(e){e&&e.preventDefault();if(!key||!mic)return;if(ac.state==='suspended')ac.resume();if(tx)return;if(busy()){beep(300,300);$('st').textContent='⛔ Channel sedang dipakai';return}
 tx=true;beep(800,1200);pub(3,enc(myName));ui()}
function stopTx(snd=true){if(!tx)return;tx=false;flush();beep(1200,800);if(snd)setTimeout(()=>pub(4),300);ui()}
function up(e){e&&e.preventDefault();stopTx()}
const b=$('ptt');b.addEventListener('pointerdown',down);['pointerup','pointercancel','pointerleave'].forEach(t=>b.addEventListener(t,up));b.oncontextmenu=e=>e.preventDefault();
addEventListener('keydown',e=>{if(e.code==='Space'&&!e.repeat&&key)down(e)});addEventListener('keyup',e=>{if(e.code==='Space'&&key)up(e)});
$('out').onclick=()=>{location.hash='';location.reload()};
function bgAudio(){const dst=ac.createMediaStreamDestination();OUT=dst;const o=ac.createOscillator(),g=ac.createGain();g.gain.value=0.0001;o.connect(g).connect(dst);o.start();
 const el=document.createElement('audio');el.setAttribute('playsinline','');el.autoplay=true;el.srcObject=dst.stream;document.body.appendChild(el);el.play().catch(()=>{});window._bgEl=el;
 if('mediaSession'in navigator){navigator.mediaSession.metadata=new MediaMetadata({title:'HT Rahasia',artist:'Room aktif',artwork:[{src:'icon.svg',sizes:'any',type:'image/svg+xml'}]});
  navigator.mediaSession.playbackState='playing';['play','pause','stop'].forEach(a=>{try{navigator.mediaSession.setActionHandler(a,()=>{el.play();ac.resume()})}catch{}})}}
document.addEventListener('visibilitychange',()=>{if(!ac)return;ac.resume();window._bgEl&&window._bgEl.play().catch(()=>{});net&&net.check();
 if(document.visibilityState==='visible'){hb();if($('wl').dataset.on==='1')wake(true)}});
async function wake(on){try{if(on){wl=await navigator.wakeLock.request('screen');$('wl').dataset.on='1';$('wl').textContent='☀️ Layar tetap menyala: AKTIF'}
 else{wl&&wl.release();wl=null;$('wl').dataset.on='';$('wl').textContent='☀️ Layar tetap menyala: MATI'}}catch(e){alert('Wake Lock tidak didukung browser ini')}}
$('wl').onclick=()=>wake($('wl').dataset.on!=='1');
