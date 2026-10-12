// Versi tanpa server sendiri: relay lewat broker MQTT publik (WSS). Semua isi terenkripsi AES-GCM di perangkat.
const $=id=>document.getElementById(id),RATE=16000,q=new URLSearchParams(location.search);
const BROKERS=q.get('broker')?[q.get('broker')]:['wss://broker.hivemq.com:8884/mqtt','wss://broker.emqx.io:8084/mqtt'];
const ME=crypto.getRandomValues(new Uint8Array(4)),MEH=[...ME].join('.');
let OUT,wl=null,cli,topic,key,ac,mic,tx=false,talkerId=null,talker='',lastRx=0,next=0,myName='',room='',peers=new Map(),bi=0;
if('serviceWorker'in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});
$('room').value=q.get('room')||localStorage.room||'';$('name').value=localStorage.nm||'';
const busy=()=>talkerId&&Date.now()-lastRx<1500;
function beep(f1,f2){if(!ac)return;const o=ac.createOscillator(),g=ac.createGain(),t=ac.currentTime;o.frequency.setValueAtTime(f1,t);o.frequency.setValueAtTime(f2,t+.07);
 g.gain.setValueAtTime(.15,t);g.gain.exponentialRampToValueAtTime(.001,t+.15);o.connect(g).connect(OUT);o.start(t);o.stop(t+.16)}
function ui(){const b=$('ptt');b.className=tx?'tx':busy()?'busy':'';$('st').textContent=tx?'🔴 Sedang bicara...':busy()?('🔊 '+(talker||'Seseorang')+' bicara'):'Siaga';
 const now=Date.now();for(const[k,v]of peers)if(now-v>25000)peers.delete(k);$('info').textContent='Channel: '+room+' · '+(peers.size+1)+' online · 🔒 E2E'}
async function pub(type,payload=new Uint8Array()){if(!cli||!cli.connected)return;const p=new Uint8Array(5+payload.length);p[0]=type;p.set(ME,1);p.set(payload,5);cli.publish(topic,await seal(key,p),{qos:0})}
const enc=s=>new TextEncoder().encode(s);
$('go').onclick=async()=>{room=$('room').value.trim();const pass=$('pass').value;myName=$('name').value.trim()||'Anon';
 if(!room||pass.length<6)return alert('Isi nama channel dan kata sandi (min. 6 karakter)');localStorage.room=room;localStorage.nm=myName;
 $('go').textContent='Menyiapkan kunci...';ac=new (window.AudioContext||window.webkitAudioContext)();
 try{mic=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}})}catch(e){alert('Izin mikrofon ditolak');$('go').textContent='Masuk Channel';return}
 bgAudio();const d=await deriveRoom(room,pass);key=d.key;topic='htr1/'+d.id;connect();setupMic()};
function connect(){$('go').textContent='Menyambung...';cli=mqtt.connect(BROKERS[bi%BROKERS.length],{connectTimeout:8000,reconnectPeriod:3000,clean:true});
 let ok=false;cli.on('connect',()=>{ok=true;cli.subscribe(topic,{qos:0});$('join').style.display='none';$('radio').style.display='block';pub(5,enc(myName));ui()});
 cli.on('offline',()=>{$('st').textContent='Terputus, menyambung ulang...';tx=false});
 cli.on('error',()=>{});cli.on('close',()=>{if(!ok){cli.end(true);bi++;setTimeout(connect,500)}});cli.on('message',(t,m)=>onMsg(m))}
setInterval(()=>{if(key)pub(5,enc(myName));ui()},10000);setInterval(()=>{if(talkerId&&!busy()){talkerId=null;beep(1200,800);ui()}},500);
async function onMsg(buf){let p;try{p=await open(key,buf)}catch{return}const id=[...p.slice(1,5)].join('.');if(id===MEH)return;
 peers.set(id,Date.now());const body=p.slice(5);
 if(p[0]===5)return ui();
 if(p[0]===3){if(tx&&id<MEH){stopTx(false)}talkerId=id;talker=new TextDecoder().decode(body);lastRx=Date.now();next=0;beep(800,1200);return ui()}
 if(p[0]===4){if(talkerId===id){talkerId=null;beep(1200,800);ui()}return}
 if(p[0]!==1)return;if(!talkerId){talkerId=id;talker='';ui()}if(talkerId!==id)return;lastRx=Date.now();
 const s=new Int16Array(body.buffer.slice(body.byteOffset,body.byteOffset+(body.length&~1)));
 const b=ac.createBuffer(1,s.length,RATE),c=b.getChannelData(0);for(let i=0;i<s.length;i++)c[i]=s[i]/32768;
 const src=ac.createBufferSource();src.buffer=b;src.connect(OUT);const now=ac.currentTime;if(next<now)next=now+.15;src.start(next);next+=b.duration}
function setupMic(){const s=ac.createMediaStreamSource(mic),proc=ac.createScriptProcessor(2048,1,1),ratio=ac.sampleRate/RATE;
 proc.onaudioprocess=e=>{if(!tx)return;const inp=e.inputBuffer.getChannelData(0),n=Math.floor(inp.length/ratio),out=new Int16Array(n);
  for(let i=0;i<n;i++){let a=0,k=0;for(let j=Math.floor(i*ratio);j<Math.floor((i+1)*ratio);j++){a+=inp[j];k++}out[i]=Math.max(-1,Math.min(1,a/(k||1)))*32767}
  pub(1,new Uint8Array(out.buffer))};const z=ac.createGain();z.gain.value=0;s.connect(proc);proc.connect(z).connect(OUT)}
function down(e){e&&e.preventDefault();if(ac.state==='suspended')ac.resume();if(tx)return;if(busy()){beep(300,300);$('st').textContent='⛔ Channel sedang dipakai';return}
 tx=true;beep(800,1200);pub(3,enc(myName));ui()}
function stopTx(snd=true){if(!tx)return;tx=false;beep(1200,800);if(snd)pub(4);ui()}
function up(e){e&&e.preventDefault();stopTx()}
const b=$('ptt');b.addEventListener('pointerdown',down);['pointerup','pointercancel','pointerleave'].forEach(t=>b.addEventListener(t,up));
addEventListener('keydown',e=>{if(e.code==='Space'&&!e.repeat&&key)down(e)});addEventListener('keyup',e=>{if(e.code==='Space'&&key)up(e)});
$('out').onclick=()=>location.reload();

// --- Mode latar belakang: semua suara lewat <audio> (MediaStream) + nada senyap terus-menerus agar sesi audio tetap aktif saat layar terkunci
function bgAudio(){const dst=ac.createMediaStreamDestination();OUT=dst;
 const sil=ac.createConstantSource?ac.createConstantSource():ac.createOscillator(),g=ac.createGain();g.gain.value=0.0001;sil.connect(g).connect(dst);sil.start();
 const el=document.createElement('audio');el.setAttribute('playsinline','');el.autoplay=true;el.srcObject=dst.stream;document.body.appendChild(el);el.play().catch(()=>{});window._bgEl=el;
 if('mediaSession'in navigator){navigator.mediaSession.metadata=new MediaMetadata({title:'HT Rahasia',artist:'Channel: '+room,artwork:[{src:'icon.svg',sizes:'any',type:'image/svg+xml'}]});
  navigator.mediaSession.playbackState='playing';['play','pause','stop'].forEach(a=>{try{navigator.mediaSession.setActionHandler(a,()=>{el.play();ac.resume()})}catch{}})}}
document.addEventListener('visibilitychange',()=>{if(!ac)return;ac.resume();window._bgEl&&window._bgEl.play().catch(()=>{});
 if(cli&&!cli.connected)cli.reconnect();if(document.visibilityState==='visible'&&$('wl').dataset.on==='1')wake(true)});
async function wake(on){try{if(on){wl=await navigator.wakeLock.request('screen');$('wl').dataset.on='1';$('wl').textContent='☀️ Layar tetap menyala: AKTIF'}
 else{wl&&wl.release();wl=null;$('wl').dataset.on='';$('wl').textContent='☀️ Layar tetap menyala: MATI'}}catch(e){alert('Wake Lock tidak didukung browser ini')}}
$('wl').onclick=()=>wake($('wl').dataset.on!=='1');
