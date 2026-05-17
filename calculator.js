/* ===== STATE ===== */
const S={
  cur:'0',prev:null,op:null,expr:'',evaled:false,
  mem:0,
  soundOn:JSON.parse(localStorage.getItem('nova-snd')?? 'true'),
  theme:localStorage.getItem('nova-theme')||'dark',
  histOpen:false,voiceOn:false,mode:'std',
  history:JSON.parse(localStorage.getItem('nova-hist')||'[]'),
  eggBuf:'',opBuf:[]
};

/* ===== DOM ===== */
const $m   = document.getElementById('main-d');
const $e   = document.getElementById('expr-d');
const $ac  = document.getElementById('acbtn');
const $cpy = document.getElementById('cpybtn');
const $cpyl= document.getElementById('cpylbl');
const $mi  = document.getElementById('mem-ind');
const $ss  = document.getElementById('stog-snd');
const $st  = document.getElementById('stog-thm');
const $sh  = document.getElementById('stog-hist');

/* ===== INIT ===== */
window.addEventListener('load',()=>{
  if(S.theme==='light'){document.documentElement.setAttribute('data-theme','light');$st.classList.add('on');setThIcon('light');}
  if(!S.soundOn) $ss.classList.remove('on');
  renderHist();
  initCanvas();
  document.addEventListener('keydown',onKey);
  addRipples();
  setTimeout(()=>{document.getElementById('loading').style.display='none';},1100);
});

/* ===== DISPLAY ===== */
function refresh(){
  const v=S.cur;
  $m.textContent=fmt(v);
  $e.textContent=S.expr;
  $m.classList.remove('sm','xs','err');
  const len=v.replace(/[^\d.]/g,'').length;
  if(['Error','Infinity','NaN'].some(x=>v.includes(x))) $m.classList.add('err');
  else if(len>=12) $m.classList.add('xs');
  else if(len>=8)  $m.classList.add('sm');
  $ac.textContent=(S.cur!=='0'||S.evaled)?'C':'AC';
  $cpy.classList.toggle('hide',S.cur==='0'||S.cur==='Error');
  $mi.classList.toggle('vis',S.mem!==0);
}

function fmt(v){
  if(['Error','Infinity','-Infinity','NaN'].includes(v)) return v;
  const n=parseFloat(v); if(isNaN(n)) return v;
  const dot=v.endsWith('.');
  let s=parseFloat(n.toPrecision(12)).toString();
  if(dot&&!s.includes('.')) s+='.';
  return s;
}

/* ===== PRESS ===== */
function press(k){
  playClick();
  if(k==='AC'){allClear();return;}
  if(k==='C'){clearEntry();return;}
  if(k==='='){evaluate();return;}
  if(['+','-','*','/'].includes(k)){handleOp(k);return;}
  if(k==='%'){handlePct();return;}
  if(k==='sign'){handleSign();return;}
  if(k==='back'){handleBack();return;}
  handleDigit(k);
}

function handleDigit(d){
  if(S.evaled){S.cur='';S.expr='';S.evaled=false;}
  if(d==='.'){if(S.cur.includes('.')) return;S.cur=(S.cur===''||S.cur==='0')?'0.':S.cur+'.';}
  else S.cur=S.cur==='0'?d:S.cur+d;
  refresh();
}

function handleOp(op){
  detectEggOp(op);
  const c=parseFloat(S.cur);
  if(S.prev!==null&&S.op&&!S.evaled){const r=compute(S.prev,c,S.op);S.cur=String(r);S.prev=r;}
  else S.prev=c;
  S.op=op;S.evaled=false;
  const sym={'+':'+','-':'−','*':'×','/':'÷'}[op];
  S.expr=fmt(String(S.prev))+' '+sym;S.cur='0';refresh();
}

function handlePct(){const c=parseFloat(S.cur);S.cur=S.prev!==null&&S.op?String((S.prev*c)/100):String(c/100);refresh();}
function handleSign(){if(S.cur!=='0'){S.cur=String(parseFloat(S.cur)*-1);refresh();}}
function handleBack(){if(S.evaled) return;S.cur=S.cur.length<=1?'0':S.cur.slice(0,-1);if(S.cur==='-') S.cur='0';refresh();}
function allClear(){S.cur='0';S.prev=null;S.op=null;S.expr='';S.evaled=false;refresh();}
function clearEntry(){S.cur='0';S.evaled=false;refresh();}

function evaluate(){
  if(!S.op||S.prev===null) return;
  const a=S.prev,b=parseFloat(S.cur),op=S.op;
  const sym={'+':'+','-':'−','*':'×','/':'÷',pow:'^'}[op];
  const es=fmt(String(a))+' '+sym+' '+fmt(String(b));
  const r=compute(a,b,op);
  pushHist(es,r);checkConf(r);
  S.expr=es+' =';S.cur=String(r);S.prev=null;S.op=null;S.evaled=true;refresh();
}

function compute(a,b,op){
  a=parseFloat(a);b=parseFloat(b);let r;
  switch(op){case '+':r=a+b;break;case '-':r=a-b;break;case '*':r=a*b;break;
    case '/':if(b===0) return'Error';r=a/b;break;
    case 'pow':r=Math.pow(a,b);break;default:return b;}
  return Math.round(r*1e10)/1e10;
}

/* ===== SCIENTIFIC ===== */
function sci(fn){
  playClick();const c=parseFloat(S.cur);let r;
  switch(fn){
    case 'sin':r=Math.sin(c*Math.PI/180);break;case 'cos':r=Math.cos(c*Math.PI/180);break;
    case 'tan':r=Math.tan(c*Math.PI/180);break;case 'log':r=Math.log10(c);break;
    case 'ln':r=Math.log(c);break;case 'sqrt':r=Math.sqrt(c);break;
    case 'sq':r=c*c;break;case 'pi':r=Math.PI;break;case 'e':r=Math.E;break;
    case 'inv':r=1/c;break;case 'abs':r=Math.abs(c);break;
    case 'pow':S.prev=c;S.op='pow';S.expr=fmt(S.cur)+' ^';S.cur='0';refresh();return;
  }
  S.expr=fn+'('+fmt(S.cur)+')';S.cur=String(Math.round(r*1e10)/1e10);S.evaled=true;refresh();
}

/* ===== MEMORY ===== */
function mem(cmd){
  playClick();const c=parseFloat(S.cur);
  switch(cmd){case 'MC':S.mem=0;break;case 'MR':S.cur=String(S.mem);S.evaled=true;break;
    case 'M+':S.mem+=c;break;case 'M-':S.mem-=c;break;}
  refresh();
}

/* ===== COPY ===== */
function copyResult(){
  navigator.clipboard?.writeText(S.cur).catch(()=>{});
  $cpyl.textContent='Copied!';$cpy.classList.add('ok');
  setTimeout(()=>{$cpyl.textContent='Copy Result';$cpy.classList.remove('ok');},1600);
}

/* ===== HISTORY ===== */
function pushHist(e,r){
  S.history.unshift({expr:e,result:String(r),time:new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})});
  if(S.history.length>60) S.history.pop();
  localStorage.setItem('nova-hist',JSON.stringify(S.history));renderHist();
}
function renderHist(){
  const el=document.getElementById('hlist');
  if(!S.history.length){el.innerHTML='<div class="hempty">No calculations yet</div>';return;}
  el.innerHTML=S.history.map((h,i)=>`<div class="hi" onclick="recallHist(${i})"><div class="hi-expr">${h.expr}</div><div class="hi-res">= ${h.result}</div><div class="hi-t">${h.time}</div></div>`).join('');
}
function recallHist(i){const h=S.history[i];S.cur=h.result;S.expr=h.expr+' =';S.evaled=true;refresh();}
function clearHist(){S.history=[];localStorage.removeItem('nova-hist');renderHist();}
function toggleHistory(){
  S.histOpen=!S.histOpen;
  document.getElementById('hpanel').classList.toggle('open',S.histOpen);
  $sh.classList.toggle('on',S.histOpen);
}

/* ===== THEME ===== */
function toggleTheme(){
  const isL=document.documentElement.getAttribute('data-theme')==='light';
  if(isL){document.documentElement.removeAttribute('data-theme');$st.classList.remove('on');S.theme='dark';setThIcon('dark');}
  else{document.documentElement.setAttribute('data-theme','light');$st.classList.add('on');S.theme='light';setThIcon('light');}
  localStorage.setItem('nova-theme',S.theme);
}
function setThIcon(t){
  const el=document.getElementById('theme-svg');
  if(t==='light') el.innerHTML=`<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>`;
  else el.innerHTML=`<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>`;
}

/* ===== SOUND ===== */
let actx=null;
function getCtx(){return actx||(actx=new(window.AudioContext||window.webkitAudioContext)());}
function playClick(){
  if(!S.soundOn) return;
  try{const c=getCtx(),o=c.createOscillator(),g=c.createGain();
    o.connect(g);g.connect(c.destination);o.frequency.value=880;o.type='sine';
    g.gain.setValueAtTime(.05,c.currentTime);g.gain.exponentialRampToValueAtTime(.001,c.currentTime+.07);
    o.start();o.stop(c.currentTime+.07);}catch(e){}
}
function toggleSound(){S.soundOn=!S.soundOn;$ss.classList.toggle('on',S.soundOn);localStorage.setItem('nova-snd',JSON.stringify(S.soundOn));}

/* ===== MODE ===== */
function setMode(m){
  S.mode=m;
  document.getElementById('scip').classList.toggle('on',m==='sci');
  document.getElementById('tab-s').classList.toggle('on',m==='std');
  document.getElementById('tab-c').classList.toggle('on',m==='sci');
}

/* ===== KEYBOARD ===== */
function onKey(e){
  if(e.ctrlKey||e.metaKey) return;const k=e.key;
  if(/\d/.test(k)){press(k);return;}
  if(k==='.'){press('.');return;}
  if(k==='+'||k==='-'||k==='*'){press(k);return;}
  if(k==='/'){e.preventDefault();press('/');return;}
  if(k==='%'){press('%');return;}
  if(k==='Enter'||k==='='){press('=');return;}
  if(k==='Backspace'){press('back');return;}
  if(k==='Escape'){allClear();return;}
  S.eggBuf+=k.toUpperCase();
  if(S.eggBuf.includes('NOVA')){S.eggBuf='';showEgg();}
  if(S.eggBuf.length>12) S.eggBuf=S.eggBuf.slice(-12);
}

/* ===== RIPPLE ===== */
function addRipples(){
  document.querySelectorAll('.btn,.sbtn').forEach(el=>{
    el.addEventListener('click',function(ev){
      const r=document.createElement('span');r.classList.add('ripple-el');
      const rect=el.getBoundingClientRect(),sz=Math.max(rect.width,rect.height);
      r.style.cssText=`width:${sz}px;height:${sz}px;left:${ev.clientX-rect.left-sz/2}px;top:${ev.clientY-rect.top-sz/2}px;`;
      el.appendChild(r);r.addEventListener('animationend',()=>r.remove());
    });
  });
}

/* ===== CONFETTI ===== */
const SPECIALS=[42,1337,777,100,1000];
function checkConf(v){if(SPECIALS.includes(parseFloat(v))) confetti();}
function confetti(){
  const cols=['#5b5ef4','#7c3aed','#9d6cf9','#34d399','#f472b6','#fb923c','#facc15'];
  for(let i=0;i<68;i++) setTimeout(()=>{
    const p=document.createElement('div');p.classList.add('cp');
    const sz=6+Math.random()*7;
    p.style.cssText=`left:${Math.random()*100}vw;top:-14px;width:${sz}px;height:${sz}px;background:${cols[Math.floor(Math.random()*cols.length)]};border-radius:${Math.random()>.5?'50%':'2px'};animation-duration:${1.4+Math.random()*2}s;animation-delay:${Math.random()*.4}s;`;
    document.body.appendChild(p);p.addEventListener('animationend',()=>p.remove());
  },i*18);
}

/* ===== EASTER EGG ===== */
function detectEggOp(op){
  S.opBuf.push(op);if(S.opBuf.length>4) S.opBuf.shift();
  if(JSON.stringify(S.opBuf)===JSON.stringify(['*','/','+','-'])){showEgg();S.opBuf=[];}
}
function showEgg(){document.getElementById('egg').classList.add('show');confetti();}
function closeEgg(){document.getElementById('egg').classList.remove('show');}
document.getElementById('egg').addEventListener('click',closeEgg);

/* ===== VOICE ===== */
let rec=null;
function toggleVoice(){
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  const btn=document.getElementById('vbtn');
  if(!SR){alert('Voice input not supported in this browser.');return;}
  if(S.voiceOn){rec?.stop();return;}
  rec=new SR();rec.continuous=false;rec.interimResults=false;rec.lang='en-US';
  rec.onresult=ev=>parseVoice(ev.results[0][0].transcript.toLowerCase());
  rec.onend=()=>{S.voiceOn=false;btn.classList.remove('live');};
  rec.start();S.voiceOn=true;btn.classList.add('live');
}
function parseVoice(t){
  t=t.replace(/plus/g,'+').replace(/minus|subtract/g,'-').replace(/times|multiplied by/g,'*')
     .replace(/divided by|over/g,'/').replace(/equals|equal/g,'=').replace(/point/g,'.').replace(/percent/g,'%');
  (t.match(/[\d.]+|[+\-*/%=]/g)||[]).forEach(tok=>{
    if(/[\d.]/.test(tok)) tok.split('').forEach(c=>press(c));
    else if(['+','-','*','/'].includes(tok)) press(tok);
    else if(tok==='=') press('=');
    else if(tok==='%') press('%');
  });
}

/* ===== CANVAS BACKGROUND ===== */
function initCanvas(){
  const cv=document.getElementById('bgc'),cx=cv.getContext('2d');
  let W,H,pts=[],ang=0;
  const resize=()=>{W=cv.width=window.innerWidth;H=cv.height=window.innerHeight;};

  class P{constructor(){this.reset();}
    reset(){this.x=Math.random()*W;this.y=Math.random()*H;this.vx=(Math.random()-.5)*.32;this.vy=(Math.random()-.5)*.32;
      this.r=Math.random()*1.6+.4;this.a=Math.random()*.38+.08;this.life=0;this.ml=180+Math.random()*260;}
    tick(){this.x+=this.vx;this.y+=this.vy;this.life++;if(this.x<0||this.x>W||this.y<0||this.y>H||this.life>this.ml) this.reset();}
    draw(){const al=this.a*Math.sin((this.life/this.ml)*Math.PI);const lt=document.documentElement.getAttribute('data-theme')==='light';
      cx.fillStyle=lt?`rgba(91,94,244,${al*.42})`:`rgba(91,94,244,${al})`;cx.beginPath();cx.arc(this.x,this.y,this.r,0,Math.PI*2);cx.fill();}
  }

  function initP(){pts=Array.from({length:52},()=>new P());}
  function drawLines(){const lt=document.documentElement.getAttribute('data-theme')==='light';
    for(let i=0;i<pts.length;i++) for(let j=i+1;j<pts.length;j++){
      const p=pts[i],q=pts[j],dx=p.x-q.x,dy=p.y-q.y,d=Math.sqrt(dx*dx+dy*dy);
      if(d<105){cx.strokeStyle=`rgba(91,94,244,${(1-d/105)*.09*(lt?.5:1)})`;cx.lineWidth=.5;cx.beginPath();cx.moveTo(p.x,p.y);cx.lineTo(q.x,q.y);cx.stroke();}
    }
  }
  function drawOrbs(){ang+=.0022;const lt=document.documentElement.getAttribute('data-theme')==='light';
    [{cx:W*.15+Math.sin(ang)*W*.08,cy:H*.25+Math.cos(ang*.7)*H*.08,r:W*.22,c:lt?'rgba(91,94,244,.038)':'rgba(91,94,244,.052)'},
     {cx:W*.85+Math.cos(ang*1.2)*W*.08,cy:H*.7+Math.sin(ang*.5)*H*.08,r:W*.18,c:lt?'rgba(124,58,237,.028)':'rgba(124,58,237,.042)'}
    ].forEach(o=>{const g=cx.createRadialGradient(o.cx,o.cy,0,o.cx,o.cy,o.r);g.addColorStop(0,o.c);g.addColorStop(1,'transparent');cx.fillStyle=g;cx.beginPath();cx.arc(o.cx,o.cy,o.r,0,Math.PI*2);cx.fill();});
  }
  function loop(){cx.clearRect(0,0,W,H);drawOrbs();pts.forEach(p=>{p.tick();p.draw();});drawLines();requestAnimationFrame(loop);}
  resize();initP();loop();window.addEventListener('resize',resize);
}

/* Init display */
refresh();