const S={
  get(k){
    try {
      if(!localStorage) return null;
      const val=localStorage.getItem('sb4_'+k);
      return val?JSON.parse(val):null;
    }catch(e){
      console.warn(`[storage] Get "${k}" failed:`,e.message);
      return null;
    }
  },
  set(k,v){
    try {
      if(!localStorage) return false;
      localStorage.setItem('sb4_'+k,JSON.stringify(v));
      return true;
    }catch(e){
      console.warn(`[storage] Set "${k}" failed:`,e.message);
      if(e.name==='QuotaExceededError') toast('Storage full — delete old data');
      return false;
    }
  },
  available(){
    try {
      if(!localStorage) return false;
      localStorage.setItem('sb4_test','1');
      localStorage.removeItem('sb4_test');
      return true;
    }catch{
      return false;
    }
  }
};

const DEFAULT_SCHED_EVENTS=[
  [{t:'Uni 9-5',c:'uni'}],
  [{t:'Uni 11:30',c:'uni'}],
  [{t:'Uni 9-12',c:'uni'},{t:'Work 6pm',c:'work'}],
  [{t:'Work 6pm',c:'work'}],
  [{t:'Work 6pm',c:'work'}],
  [{t:'Stream!',c:'stream'}],
  [{t:'Free',c:''}]
];
function evClass(c){return{uni:'eu',work:'ew',stream:'es'}[c]||'';}

const QCAT_COLORS={health:'var(--cat-health)',productivity:'var(--cat-productivity)',creativity:'var(--cat-creativity)',finance:'var(--cat-finance)'};

const CORE_SECTIONS=[
  {id:'finance',label:'Finance',icon:'💰',core:true,visible:true},
  {id:'uni',label:'Uni',icon:'🎓',core:true,visible:true},
  {id:'youtube',label:'YouTube',icon:'📺',core:true,visible:true},
  {id:'dev',label:'Chuck Bot',icon:'🤖',core:true,visible:true},
  {id:'schedule',label:'Schedule',icon:'📅',core:true,visible:true},
  {id:'habits',label:'Habits',icon:'✅',core:true,visible:true},
  {id:'sleep',label:'Sleep',icon:'🌙',core:true,visible:true},
  {id:'goals',label:'Goals',icon:'🎯',core:true,visible:true},
  {id:'todos',label:'All Todos',icon:'📋',core:true,visible:true},
  {id:'journal',label:'Journal',icon:'📓',core:true,visible:true}
];

let st={
  onboarded:false,gameIntroSeen:false,userName:'',accentColor:'#e8eaf0',accentGlow:'rgba(232,234,240,0.10)',
  focusAreas:[],sections:[...CORE_SECTIONS],
  groqKey:'',defaultWage:10,
  balances:{bank:0,savings:0,trading:0},
  holidays:[{name:'Holiday 1',date:'',target:500,saved:0},{name:'Holiday 2',date:'',target:1000,saved:0}],
  trips:[],
  shifts:[],examDate:'TBC',uniNotes:'',
  yt:{subs:0,views:0,hours:0,channelName:'My Channel',weekChecks:[],videoCount:0,apiVideos:[],impressions28d:0,ctr28d:0,watchMins28d:0,analyticsConnected:false},
  dev:{members:0,status:'In development',name:'Side Project'},
  devTodos:[],
  habits:[{label:'Workout',done:false},{label:'Drink water',done:false},{label:'Good sleep',done:false}],
  fitnessGoals:[],fitnessNotes:'',
  goals:[],
  secTodos:{finance:[],uni:[],youtube:[],schedule:[],fitness:[],travel:[]},
  setupTodos:[],genTodos:[],todayFocus:'',journals:{},
  customSecs:{},chatHistory:[],
  lastHabitReset:'',scheduleEvents:[],
  sleep:{logs:[],targetBed:'23:00',targetHours:8},
  notifSettings:{bedReminder:true,bedReminderTime:'22:30',morningBrief:true,morningBriefTime:'08:00',habitReminder:true,habitReminderTime:'20:00',aiNudge:false,aiNudgeTime:'12:00',questReset:true},
  notifLastSent:{bedReminder:'',morningBrief:'',habitReminder:'',aiNudge:''},
  apiKeys: { groq: '', t212: '', ytApi: '', ytClientId: '', ytClientSecret: '', ytRefreshToken: '', ytChannelId: '' },
  habitHistory: {},
  subscriptions: [],
  pomodoro: { focus: 25, break: 5 },
  fxEnabled: true,
  lastAppDate: ''
};

let confirmCb=null,renamingId=null,obSelections=[],obColor='#e8eaf0',obColorGlow='rgba(232,234,240,0.10)',bootOrbAnim=null,bootParticlesAnim=null,bootChatHistory=[],bootResizeHandler=null,bootMouseHandler=null;

function load(){
  if(!S.available()){
    console.error('[storage] localStorage unavailable');
    toast('Warning: Storage unavailable — changes may not persist');
  }
  const keys=['onboarded','gameIntroSeen','userName','accentColor','accentGlow','focusAreas','sections','groqKey','defaultWage','balances','holidays','trips','shifts','examDate','uniNotes','yt','dev','devTodos','habits','fitnessGoals','fitnessNotes','goals','secTodos','setupTodos','genTodos','todayFocus','journals','customSecs','chatHistory','lastHabitReset','scheduleEvents','sleep','notifSettings','notifLastSent','apiKeys','habitHistory','subscriptions','pomodoro','fxEnabled','lastAppDate'];
  keys.forEach(k=>{const v=S.get(k);if(v!=null)st[k]=v});
  if(!st.apiKeys)st.apiKeys={groq:st.groqKey||'',t212:'',ytApi:'',ytClientId:'',ytClientSecret:'',ytRefreshToken:'',ytChannelId:''};
  if(!st.habitHistory)st.habitHistory={};
  if(!st.subscriptions)st.subscriptions=[];
  if(!st.pomodoro)st.pomodoro={focus:25,break:5};
  if(!st.secTodos)st.secTodos={};
  ['finance','uni','youtube','schedule','fitness','travel'].forEach(k=>{if(!st.secTodos[k])st.secTodos[k]=[];});
  if(!st.goals)st.goals=[];
  if(!st.chatHistory)st.chatHistory=[];
  if(!st.holidays||st.holidays.length<2)st.holidays=[{name:'Holiday 1',date:'',target:500,saved:0},{name:'Holiday 2',date:'',target:1000,saved:0}];
  if(!st.yt)st.yt={};
  // One-time migration of legacy cyan/blue accents to the new soft-white default
  if(!S.get('accentMigratedV2')){
    if(st.accentColor==='#3d8ef0'||st.accentColor==='#22d3ee'||st.accentColor==='#8b5cf6'){st.accentColor='#e8eaf0';st.accentGlow='rgba(232,234,240,0.10)';}
    S.set('accentMigratedV2',true);
  }
  if(!st.yt.apiVideos)st.yt.apiVideos=[];
  if(!st.yt.weekChecks)st.yt.weekChecks=[];
  if(st.yt.videoCount==null)st.yt.videoCount=0;
  if(st.yt.impressions28d==null)st.yt.impressions28d=0;
  if(st.yt.ctr28d==null)st.yt.ctr28d=0;
  if(st.yt.watchMins28d==null)st.yt.watchMins28d=0;
  if(st.yt.analyticsConnected==null)st.yt.analyticsConnected=false;
  if(!st.sleep)st.sleep={logs:[],targetBed:'23:00',targetHours:8};
  if(!st.sleep.logs)st.sleep.logs=[];
  if(!st.sleep.targetBed)st.sleep.targetBed='23:00';
  if(st.sleep.targetHours==null)st.sleep.targetHours=8;
  if(!st.notifSettings)st.notifSettings={bedReminder:true,bedReminderTime:'22:30',morningBrief:true,morningBriefTime:'08:00',habitReminder:true,habitReminderTime:'20:00',aiNudge:false,aiNudgeTime:'12:00',questReset:true};
  if(st.notifSettings.questReset==null)st.notifSettings.questReset=true;
  if(!st.notifLastSent)st.notifLastSent={bedReminder:'',morningBrief:'',habitReminder:'',aiNudge:''};
  if(st.lastAppDate==null)st.lastAppDate='';
}
function save(){
  const keys=['onboarded','gameIntroSeen','userName','accentColor','accentGlow','focusAreas','sections','groqKey','defaultWage','balances','holidays','trips','shifts','examDate','uniNotes','yt','dev','devTodos','habits','fitnessGoals','fitnessNotes','goals','secTodos','setupTodos','genTodos','todayFocus','journals','customSecs','chatHistory','lastHabitReset','scheduleEvents','sleep','notifSettings','notifLastSent','apiKeys','habitHistory','subscriptions','pomodoro','fxEnabled','lastAppDate'];
  keys.forEach(k=>S.set(k,st[k]));
}

// ── ENV HELPERS ──
function getGroqKey(){return st.apiKeys?.groq||st.groqKey||'';}
function emptyState(icon,msg,sub=''){return`<div class="empty"><span class="empty-icon">${icon}</span>${msg}${sub?`<span class="empty-sub">${sub}</span>`:''}</div>`;}
function setMobNav(id){document.querySelectorAll('.mnb-item').forEach(el=>el.classList.remove('active'));const el=document.getElementById('mnb-'+id);if(el)el.classList.add('active');}

// ── INPUT VALIDATION & SANITIZATION ──
function sanitizeText(str,maxLen=500){
  if(!str)return '';
  let s=String(str).slice(0,maxLen).trim();
  s=s.replace(/[<>\"']/g,c=>({'<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]||c));
  return s;
}
function validateNumber(val,min=0,max=999999){
  const n=parseFloat(val)||0;
  return Math.max(min,Math.min(max,n));
}
function validateEmail(email){
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).toLowerCase());
}
function validateTime(time){
  return /^\d{2}:\d{2}$/.test(time);
}
function validateDate(date){
  return !isNaN(new Date(date).getTime());
}

const fmt=n=>'£'+Number(n).toFixed(2);
const fmtK=n=>n>=1000?(n/1000).toFixed(1)+'k':String(n);
function satDays(){const d=new Date().getDay();return d===6?7:(6-d)||7;}
function openModal(id){document.getElementById(id).classList.add('open');}
function closeModal(id){document.getElementById(id).classList.remove('open');}
document.getElementById('mc-ok').onclick=()=>{if(confirmCb)confirmCb();closeModal('modal-confirm');confirmCb=null;};
function showConfirm(t,b,cb){document.getElementById('mc-t').textContent=t;document.getElementById('mc-b').textContent=b;confirmCb=cb;openModal('modal-confirm');}
function closeGameIntro(){st.gameIntroSeen=true;save();closeModal('modal-game-intro');}

let _toastTimer;let _toastQueue=[];let _toastShowing=false;
function toast(msg){
  _toastQueue.push(msg);
  if(!_toastShowing)_showNextToast();
}
function _showNextToast(){
  if(!_toastQueue.length){_toastShowing=false;return;}
  _toastShowing=true;
  const msg=_toastQueue.shift();
  let el=document.getElementById('toast');
  if(!el){el=document.createElement('div');el.id='toast';document.body.appendChild(el);}
  el.textContent=msg;el.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer=setTimeout(()=>{el.classList.remove('show');setTimeout(_showNextToast,150);},1800);
}
function applyColor(hex){
  const glowMap={'#e8eaf0':'rgba(232,234,240,0.10)','#ffffff':'rgba(255,255,255,0.10)','#22d3ee':'rgba(34,211,238,0.12)','#8b5cf6':'rgba(139,92,246,0.15)','#3d8ef0':'rgba(61,142,240,0.15)','#2ecc8a':'rgba(46,204,138,0.12)','#f05090':'rgba(240,80,144,0.12)','#f0a832':'rgba(240,168,50,0.12)','#a855f7':'rgba(168,85,247,0.12)','#f05050':'rgba(240,80,80,0.12)'};
  const a2map={'#e8eaf0':'#ffffff','#ffffff':'#ffffff','#22d3ee':'#67e8f9','#8b5cf6':'#a78bfa','#3d8ef0':'#5ba3ff','#2ecc8a':'#52d9a0','#f05090':'#f570a8','#f0a832':'#f5bc5a','#a855f7':'#be7cf9','#f05050':'#f57070'};
  st.accentColor=hex;st.accentGlow=glowMap[hex]||'rgba(232,234,240,0.10)';
  document.documentElement.style.setProperty('--accent',hex);
  document.documentElement.style.setProperty('--accent2',a2map[hex]||hex);
  document.documentElement.style.setProperty('--accent-glow',st.accentGlow);
  save();
}

// ═══ ONBOARDING ═══
let obStep=1;
const OB_STEPS=3;
function updateObProgress(){
  const prog=document.getElementById('ob-prog');
  prog.innerHTML=Array.from({length:OB_STEPS},(_,i)=>`<div class="ob-pip ${i+1<obStep?'done':i+1===obStep?'active':''}"></div>`).join('');
}
function toggleOb(el,val){
  el.classList.toggle('selected');
  const idx=obSelections.indexOf(val);
  if(idx>-1)obSelections.splice(idx,1);else obSelections.push(val);
}
function pickColor(el,color,glow){
  document.querySelectorAll('.ob-color').forEach(e=>e.classList.remove('selected'));
  el.classList.add('selected');
  const _a2map={'#e8eaf0':'#ffffff','#ffffff':'#ffffff','#22d3ee':'#67e8f9','#8b5cf6':'#a78bfa','#3d8ef0':'#5ba3ff','#2ecc8a':'#52d9a0','#f05090':'#f570a8','#f0a832':'#f5bc5a','#a855f7':'#be7cf9','#f05050':'#f57070'};
  obColor=color;obColorGlow=glow;
  document.documentElement.style.setProperty('--accent',color);
  document.documentElement.style.setProperty('--accent2',_a2map[color]||color);
}
function activateDanielMode(){
  st.userName='Daniel';
  st.accentColor='#e8eaf0';st.accentGlow='rgba(232,234,240,0.10)';
  st.focusAreas=['finance','youtube','uni','dev','habits'];
  st.sections=[
    {id:'finance',label:'Finance',icon:'💰',core:true,visible:true},
    {id:'uni',label:'Uni',icon:'🎓',core:true,visible:true},
    {id:'youtube',label:'YouTube',icon:'📺',core:true,visible:true},
    {id:'dev',label:'Chuck Bot',icon:'🤖',core:true,visible:true},
    {id:'schedule',label:'Schedule',icon:'📅',core:true,visible:true},
    {id:'habits',label:'Habits',icon:'✅',core:true,visible:true},
    {id:'sleep',label:'Sleep',icon:'🌙',core:true,visible:true},
    {id:'goals',label:'Goals',icon:'🎯',core:true,visible:true},
    {id:'todos',label:'All Todos',icon:'📋',core:true,visible:true},
    {id:'journal',label:'Journal',icon:'📓',core:true,visible:true}
  ];
  st.habits=[
    {label:'Workout',done:false},{label:'Drink 2L water',done:false},
    {label:'Code for 1 hour',done:false},{label:'Read / study',done:false}
  ];
  st.yt={subs:0,views:0,hours:0,channelName:'My Channel'};
  st.dev={members:0,status:'In development',name:'Chuck Bot'};
  st.goals=[
    {text:'Hit 1000 YouTube subscribers',category:'youtube',done:false},
    {text:'Pass all uni modules',category:'uni',done:false},
    {text:'Build SychBoard to full release',category:'dev',done:false}
  ];
  st.defaultWage=10;
  st.onboarded=true;
  save();
  applyColor(st.accentColor);
  const ob=document.getElementById('onboarding');
  ob.classList.add('out');
  setTimeout(()=>{
    ob.style.display='none';
    const bootEl=document.getElementById('boot');
    bootEl.style.display='flex';
    startBoot();
  },300);
}
function obNext(step){
  if(step===1){
    const name=sanitizeText(document.getElementById('ob-name').value,100).trim();
    if(!name||name.length<2){document.getElementById('ob-name').focus();toast('Name must be at least 2 characters');return;}
    if(name==='Daniel6767'){activateDanielMode();return;}
    st.userName=name;
  }
  if(step===2&&obSelections.length===0){obSelections=['habits'];}
  document.getElementById('ob-'+step).classList.remove('active');
  obStep=step+1;
  document.getElementById('ob-'+obStep).classList.add('active');
  updateObProgress();
}
function obBack(step){
  document.getElementById('ob-'+step).classList.remove('active');
  obStep=step-1;
  document.getElementById('ob-'+obStep).classList.add('active');
  updateObProgress();
}
function obFinish(){
  st.accentColor=obColor;st.accentGlow=obColorGlow;
  st.focusAreas=obSelections;
  // Build sections based on selections
  const sectionMap={
    finance:{id:'finance',label:'Finance',icon:'💰',core:true,visible:true},
    uni:{id:'uni',label:'Uni',icon:'🎓',core:true,visible:true},
    youtube:{id:'youtube',label:'YouTube',icon:'📺',core:true,visible:true},
    dev:{id:'dev',label:'Side Project',icon:'🤖',core:true,visible:true},
    schedule:{id:'schedule',label:'Schedule',icon:'📅',core:true,visible:true},
    habits:{id:'habits',label:'Habits',icon:'✅',core:true,visible:true},
    fitness:{id:'fitness',label:'Fitness',icon:'💪',core:true,visible:true},
    travel:{id:'travel',label:'Travel',icon:'✈️',core:true,visible:true},
    goals:{id:'goals',label:'Goals',icon:'🎯',core:true,visible:true},
    todos:{id:'todos',label:'All Todos',icon:'📋',core:true,visible:true},
    journal:{id:'journal',label:'Journal',icon:'📓',core:true,visible:true}
  };
  const always=['schedule','habits','goals','todos','journal'];
  const areaToSection={youtube:'youtube',uni:'uni',fitness:'fitness',finance:'finance',work:'schedule',dev:'dev',travel:'travel'};
  const toShow=new Set(always);
  obSelections.forEach(a=>{if(areaToSection[a])toShow.add(areaToSection[a]);});
  if(obSelections.includes('finance'))toShow.add('finance');
  st.sections=Array.from(toShow).map(id=>sectionMap[id]).filter(Boolean);
  st.onboarded=true;
  save();
  const ob=document.getElementById('onboarding');
  ob.classList.add('out');
  setTimeout(()=>{
    ob.style.display='none';
    const bootEl=document.getElementById('boot');
    bootEl.style.display='flex';
    startBoot();
  },500);
}

// ═══ BOOT (Three.js Jarvis orb) ═══
const ORB_THEMES={
  white:{sphere:0xe8eaf0,inner:0xffffff,particles:0xffffff,ripple:0xffffff,star:'232,234,240'},
  cyan:{sphere:0x22d3ee,inner:0x67e8f9,particles:0xa5f3fc,ripple:0x22d3ee,star:'165,243,252'},
  gold:{sphere:0xf59e0b,inner:0xfcd34d,particles:0xfde68a,ripple:0xf59e0b,star:'253,230,138'}
};
function startBoot(){
  const nameEl=document.getElementById('boot-name');
  if(nameEl)nameEl.textContent=st.userName;
  bootChatHistory=[];
  window._bootOrb=null;

  if(bootOrbAnim){cancelAnimationFrame(bootOrbAnim);bootOrbAnim=null;}
  if(bootParticlesAnim){cancelAnimationFrame(bootParticlesAnim);bootParticlesAnim=null;}
  if(bootResizeHandler){window.removeEventListener('resize',bootResizeHandler);bootResizeHandler=null;}
  if(bootMouseHandler){window.removeEventListener('mousemove',bootMouseHandler);bootMouseHandler=null;}
  disposeBootThree();

  // Visual centrepiece removed (stars + orb) — pending new design direction.
  // The boot screen is currently just the title/welcome/chat on the dark
  // gradient. window._bootOrb stays null; all consumers already guard on it.

  // Letter-by-letter title reveal (50% slower)
  const letters=document.querySelectorAll('.boot-title .bt');
  const titleEl=document.getElementById('boot-title');
  gsap.set(titleEl,{opacity:1});
  gsap.fromTo(letters,{opacity:0,y:20},{opacity:1,y:0,duration:0.9,stagger:0.13,ease:'power3.out',delay:2.6});

  // Welcome text
  const welcomeEl=document.getElementById('boot-welcome');
  gsap.to(welcomeEl,{opacity:1,y:0,duration:2.0,ease:'power2.out',delay:4.8});

  // AI greeting after orb is fully on
  setTimeout(()=>{
    const greeting=getBootMsg();
    bootChatHistory=[{role:'assistant',content:greeting}];
    showBootResponse(greeting,()=>{
      const inputWrap=document.getElementById('boot-input-wrap');
      gsap.to(inputWrap,{opacity:1,y:0,duration:1.3,ease:'power2.out'});
      setTimeout(()=>{
        const btn=document.getElementById('boot-launch');
        if(btn)btn.classList.add('visible');
      },1000);
    });
  },6600);
}

function disposeBootThree(){
  const bt=window._bootThree;
  if(!bt)return;
  try{
    bt.ripples.forEach(rp=>{rp.mesh.geometry.dispose();rp.mesh.material.dispose();});
    bt.pGeo.dispose();bt.pMat.dispose();(bt.mats||[]).forEach(m=>m.dispose());
    bt.renderer.dispose();
  }catch(e){}
  window._bootThree=null;
}

function showBootResponse(text,onDone){
  const el=document.getElementById('boot-response');
  if(!el)return;
  el.innerHTML='';
  if(window._bootOrb)window._bootOrb.mode='responding';
  const words=text.split(' ');
  const frag=document.createDocumentFragment();
  words.forEach((word,i)=>{
    const span=document.createElement('span');
    span.className='boot-word';
    span.textContent=word+(i<words.length-1?' ':'');
    frag.appendChild(span);
  });
  el.appendChild(frag);
  if(window._bootOrb?.emitRipple)window._bootOrb.emitRipple();
  const wordEls=el.querySelectorAll('.boot-word');
  gsap.to(wordEls,{opacity:1,duration:0.56,stagger:0.08,ease:'power1.out',
    onComplete:()=>{
      if(window._bootOrb)window._bootOrb.mode='idle';
      if(onDone)onDone();
    }
  });
}

function addBootMsg(role,text){
  if(role==='ai'){showBootResponse(text,null);return 'boot-response';}
  return null;
}

async function bootSend(){
  const inp=document.getElementById('boot-chat-in');if(!inp)return;
  const msg=inp.value.trim();if(!msg)return;inp.value='';
  bootChatHistory.push({role:'user',content:msg});

  // Show user message dimmed while waiting. Built via textContent (not
  // innerHTML with the raw string interpolated) — same escaping guarantee
  // showBootResponse() already uses for the AI's reply, since this is the
  // user's own typed text and the boot chat is the very first input surface
  // in the app.
  const respEl=document.getElementById('boot-response');
  if(respEl){
    respEl.innerHTML='';
    const span=document.createElement('span');
    span.className='boot-word';
    span.style.opacity='0.45';
    span.style.fontStyle='italic';
    span.textContent=msg;
    respEl.appendChild(span);
  }

  if(window._bootOrb){window._bootOrb.mode='thinking';window._bootOrb.pulseSpeed=0.05;}

  const key=getGroqKey();
  if(!key){
    if(window._bootOrb){window._bootOrb.mode='idle';window._bootOrb.pulseSpeed=0.011;}
    showBootResponse('No AI key configured — add one in Settings.',null);
    return;
  }

  const r=await callGroq(bootChatHistory);
  if(window._bootOrb){window._bootOrb.mode='idle';window._bootOrb.pulseSpeed=0.011;}

  const{clean:r1,sectionId}=parseNav(r||'Ready when you are.');
  const{clean,actions}=parseActions(r1);
  executeActions(actions);
  bootChatHistory.push({role:'assistant',content:clean});
  showBootResponse(clean,sectionId?()=>setTimeout(()=>enterAppAndGo(sectionId),600):null);
}

function enterAppAndGo(sectionId){enterApp();setTimeout(()=>goPage(sectionId),150);}

function typeWrite(el,text,i,cb){
  if(i===0)el.innerHTML='<span class="cursor"></span>';
  if(i<=text.length){el.innerHTML=text.slice(0,i)+'<span class="cursor"></span>';setTimeout(()=>typeWrite(el,text,i+1,cb),25);}
  else{el.innerHTML=text;if(cb)setTimeout(cb,200);}
}

function getBootMsg(){
  const hr=new Date().getHours();
  const g=hr<12?'Morning':hr<17?'Afternoon':'Evening';
  const days=satDays();
  const wealth=st.balances.bank+st.balances.savings+st.balances.trading;
  const done=st.habits.filter(h=>h.done).length;
  const parts=[];
  if(wealth>0)parts.push(`total wealth ${fmt(wealth)}`);
  if(st.habits.length>0)parts.push(`${done}/${st.habits.length} habits done`);
  if(st.focusAreas.includes('youtube'))parts.push(`stream in ${days} days`);
  const summary=parts.length?parts.join(', ')+'.':'Let\'s get to work.';
  return `${g}, ${st.userName}. ${summary} What are we working on today?`;
}

function maybeResetHabits(){
  const today=new Date().toDateString();
  if(st.lastHabitReset!==today){st.habits.forEach(h=>h.done=false);st.lastHabitReset=today;save();return true;}
  return false;
}
function checkHabitReset(){
  if(maybeResetHabits()){
    const ap=document.querySelector('.page.active')?.id?.replace('page-','');
    if(ap==='habits')rHabits();
    if(ap==='home')renderHomeGamification();
  }
}
function initSchedEvents(){
  if(!st.scheduleEvents||st.scheduleEvents.length!==7){
    st.scheduleEvents=DEFAULT_SCHED_EVENTS.map(d=>d.map(e=>({...e})));save();
  }
}

let _appEntered=false;
function enterApp(){
  if(_appEntered)return;
  _appEntered=true;
  if(window.electronAPI)document.body.classList.add('electron-inset');
  if(bootOrbAnim){cancelAnimationFrame(bootOrbAnim);bootOrbAnim=null;}
  if(bootParticlesAnim){cancelAnimationFrame(bootParticlesAnim);bootParticlesAnim=null;}
  if(bootResizeHandler){window.removeEventListener('resize',bootResizeHandler);bootResizeHandler=null;}
  if(bootMouseHandler){window.removeEventListener('mousemove',bootMouseHandler);bootMouseHandler=null;}
  window._bootOrb=null;
  disposeBootThree();
  const boot=document.getElementById('boot');
  const app=document.getElementById('app');
  boot.classList.add('out');
  app.classList.add('show');
  applyColor(st.accentColor);
  maybeResetHabits();
  initSchedEvents();
  renderSidebar();
  setTimeout(()=>{boot.style.display='none';},900);
  renderHome();
  const aiReply=document.getElementById('ai-sug');if(aiReply){aiReply.textContent='';aiReply.style.display='none';}
  setTimeout(initNotifications,2000);
  if(window.innerWidth<=720)initSwipe();
  if(!st.gameIntroSeen)setTimeout(()=>openModal('modal-game-intro'),1200);
}

// ═══ NAV ═══
function goHome(){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.getElementById('page-home').classList.add('active');
  setSidebarActive('home');
  setMobNav('home');
  setMainTitle('Home');
  const s=document.getElementById('main-scroll');if(s)s.scrollTop=0;
  renderHome();
  try{startLiveStatsUpdates();}catch(e){console.error('Live stats init error:',e);}
}
function goPage(id){
  if(id==='home'){goHome();return;}
  stopLiveStatsUpdates();
  document.getElementById('sidebar')?.classList.remove('mob-open');
  document.getElementById('sb-overlay')?.classList.remove('show');
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  const el=document.getElementById('page-'+id)||document.getElementById('page-custom');
  if(el){
    el.classList.add('active');
    requestAnimationFrame(()=>{
      el.querySelectorAll('.sc > .card').forEach(c=>{c.style.animation='none';c.offsetHeight;c.style.animation='';});
    });
  }
  setSidebarActive(id);
  setMobNav(id);
  const titles={finance:'Finance',uni:'University',youtube:'YouTube',dev:'Dev / Side Project',schedule:'Schedule',habits:'Habits',sleep:'Sleep Tracker',fitness:'Fitness',travel:'Travel',goals:'Goals',todos:'All Todos',journal:'Journal',game:'Game',shop:'Shop',ai:'AI Assistant',manage:'Manage Sections',settings:'Settings'};
  const sec=st.sections.find(s=>s.id===id);
  setMainTitle(titles[id]||(sec?.label)||id);
  const s=document.getElementById('main-scroll');if(s)s.scrollTop=0;
  const renders={finance:rFinance,uni:rUni,youtube:rYT,dev:rDev,schedule:rSchedule,habits:rHabits,sleep:rSleep,fitness:rFitness,travel:rTravel,goals:rGoals,todos:rMasterTodos,journal:rJournal,game:rGame,shop:rShop,ai:rAI,manage:rManage,settings:rSettings};
  if(renders[id])renders[id]();
  else rCustom(id);
}
function toggleSidebar(){
  const sb=document.getElementById('sidebar');
  const ov=document.getElementById('sb-overlay');
  sb.classList.toggle('mob-open');
  ov.classList.toggle('show');
}
let _swipeInit=false;
function initSwipe(){
  if(_swipeInit)return;_swipeInit=true;
  let x0=0,y0=0;
  const THRESH=60,EDGE=32,VMAX=60;
  document.addEventListener('touchstart',e=>{x0=e.touches[0].clientX;y0=e.touches[0].clientY;},{passive:true});
  document.addEventListener('touchend',e=>{
    const dx=e.changedTouches[0].clientX-x0;
    const dy=Math.abs(e.changedTouches[0].clientY-y0);
    if(dy>VMAX||Math.abs(dx)<THRESH)return;
    const sb=document.getElementById('sidebar');
    const open=sb.classList.contains('mob-open');
    if(dx>0&&x0<EDGE&&!open)toggleSidebar();
    else if(dx<0&&open)toggleSidebar();
  },{passive:true});
}
function setSidebarActive(id){
  document.querySelectorAll('.sb-item').forEach(el=>el.classList.remove('active'));
  const el=document.getElementById('sbi-'+id);
  if(el)el.classList.add('active');
}
function setMainTitle(t){const el=document.getElementById('main-title');if(el)el.textContent=t;}
function renderSidebar(){
  const nav=document.getElementById('sb-nav');if(!nav)return;
  const hr=new Date().getHours();
  const g=hr<12?'Good morning':hr<17?'Good afternoon':'Good evening';
  const grEl=document.getElementById('sb-greeting');if(grEl)grEl.textContent=g;
  const nmEl=document.getElementById('sb-name');if(nmEl)nmEl.textContent=st.userName;
  const activePage=document.querySelector('.page.active')?.id?.replace('page-','')||'home';
  const secs=st.sections.filter(s=>s.visible);
  nav.innerHTML=
    `<div class="sb-item${activePage==='home'?' active':''}" id="sbi-home" onclick="goHome()"><span class="sb-icon">🏠</span><span>Home</span></div>`+
    `<div class="sb-sec-label">Sections</div>`+
    secs.map(s=>`<div class="sb-item${activePage===s.id?' active':''}" id="sbi-${s.id}" onclick="goPage('${s.id}')"><span class="sb-icon">${s.icon||'📁'}</span><span>${s.label}</span></div>`).join('')+
    `<div class="sb-divider"></div>`+
    `<div class="sb-item${activePage==='game'?' active':''}" id="sbi-game" onclick="goPage('game')"><span class="sb-icon">🎮</span><span>Game</span></div>`+
    `<div class="sb-item${activePage==='shop'?' active':''}" id="sbi-shop" onclick="goPage('shop')"><span class="sb-icon">🛍️</span><span>Shop</span></div>`+
    `<div class="sb-item${activePage==='ai'?' active':''}" id="sbi-ai" onclick="goPage('ai')"><span class="sb-icon">💬</span><span>AI Assistant</span></div>`+
    `<div class="sb-item${activePage==='settings'?' active':''}" id="sbi-settings" onclick="goPage('settings')"><span class="sb-icon">⚙</span><span>Settings</span></div>`;
}

// ═══ HOME (Gamification) ═══

function drawSparkline(canvasId,points,color='#e8eaf0'){
  const c=document.getElementById(canvasId);if(!c)return;
  const dpr=window.devicePixelRatio||1;
  const w=c.offsetWidth||180,h=c.offsetHeight||36;
  c.width=w*dpr;c.height=h*dpr;
  const ctx=c.getContext('2d');ctx.scale(dpr,dpr);
  if(!points||points.length<2)return;
  const mn=Math.min(...points),mx=Math.max(...points),rng=mx-mn||1;
  const xs=i=>i/(points.length-1)*w,ys=v=>h-4-(v-mn)/rng*(h-8);
  ctx.beginPath();ctx.moveTo(xs(0),ys(points[0]));
  for(let i=1;i<points.length;i++)ctx.lineTo(xs(i),ys(points[i]));
  ctx.strokeStyle=color;ctx.lineWidth=1.5;ctx.lineJoin='round';ctx.stroke();
  const grad=ctx.createLinearGradient(0,0,0,h);
  grad.addColorStop(0,color+'22');
  grad.addColorStop(1,'rgba(0,0,0,0)');
  ctx.lineTo(xs(points.length-1),h);ctx.lineTo(xs(0),h);ctx.closePath();
  ctx.fillStyle=grad;ctx.fill();
}

let _xpToastTimer=null;
function showXpToast(text){
  let el=document.getElementById('xp-toast');
  if(!el){el=document.createElement('div');el.id='xp-toast';el.className='xp-toast';document.body.appendChild(el);}
  el.textContent=text;el.classList.add('show');
  clearTimeout(_xpToastTimer);_xpToastTimer=setTimeout(()=>el.classList.remove('show'),2200);
}

function showLevelToast(level,rank){
  let el=document.getElementById('level-toast');
  if(!el){el=document.createElement('div');el.id='level-toast';el.className='level-toast';el.innerHTML=`<div class="level-toast-icon">⚡</div><div class="level-toast-title" id="lt-title"></div><div class="level-toast-sub" id="lt-sub"></div>`;document.body.appendChild(el);}
  document.getElementById('lt-title').textContent=`Level ${level}!`;
  document.getElementById('lt-sub').textContent=`You've reached ${rank}`;
  el.classList.add('show');
  setTimeout(()=>el.classList.remove('show'),3000);
}

// Guards against a rapid re-click firing a second complete/uncomplete call for
// the same quest while the first is still in flight — the UI's completed_today
// state only updates after the round-trip resolves, so two quick clicks both
// read the stale "not done" state and both call complete(); the DB blocks the
// duplicate (UNIQUE constraint for daily, explicit check for weekly) but that
// surfaces as a raw error and a generic "Could not update quest" toast instead
// of being silently ignored like it should be.
const questInFlight=new Set();
async function gmCompleteQuest(questId,checked,ev){
  if(!window.sychboard)return;
  if(questInFlight.has(questId))return;
  questInFlight.add(questId);
  try{
    if(checked){
      const res=await window.sychboard.quests.complete(questId);
      if(res){
        const bonus=res.streak?.bonusPct>0?` (+${Math.round(res.streak.bonusPct*100)}% streak)`:'';
        confettiBurst(ev);playChime();
        flyXp(ev,res.xpAwarded);
        if(res.coinsAwarded)setTimeout(()=>flyChip(ev,`+${res.coinsAwarded} ◈`,'#gm-coins-widget','coin-fly'),180);
        showXpToast(`+${res.xpAwarded} XP${bonus}`);
        if(res.leveledUp){
          setTimeout(()=>showLevelToast(res.newLevel,res.newRank),600);
          if(res.coinsFromLevelUp)setTimeout(()=>{coinBurst('#gm-coins-widget');showXpToast(`◈ +${res.coinsFromLevelUp} SychCoins — Level ${res.newLevel}!`);},1200);
        }
        if(res.sweepBonus)setTimeout(()=>toast(`🧹 Category swept! +${res.sweepBonus} XP bonus`),800);
        if(res.badgesUnlocked?.length)setTimeout(()=>toast(`🏆 Badge unlocked: ${res.badgesUnlocked.map(b=>b.name).join(', ')}`),800);
        if(res.streak?.freezeUsed)setTimeout(()=>toast('❄️ Streak Freeze used — missed day covered'),800);
      }
    } else {
      await window.sychboard.quests.uncomplete(questId);
    }
    renderHomeGamification();
  }catch(e){console.error('[quests]',e.message);toast('Could not update quest');}
  finally{questInFlight.delete(questId);}
}

function toggleQuestCat(key){
  const c=S.get('qcatCollapsed')||{};
  c[key]=!c[key];
  S.set('qcatCollapsed',c);
  document.getElementById('qcb-'+key)?.classList.toggle('collapsed',c[key]);
  document.getElementById('qch-'+key)?.classList.toggle('collapsed',c[key]);
}

// Animate a chip from a click position to a target widget (XP → level widget, coins → coin widget)
function flyChip(ev,text,targetSel,cls){
  const target=document.querySelector(targetSel);
  if(!target||!ev||typeof gsap==='undefined')return;
  const chip=document.createElement('div');
  chip.className=cls;chip.textContent=text;
  chip.style.left=ev.clientX+'px';chip.style.top=ev.clientY+'px';
  document.body.appendChild(chip);
  const tr=target.getBoundingClientRect();
  const dx=tr.left+tr.width/2-ev.clientX,dy=tr.top+tr.height/2-ev.clientY;
  gsap.fromTo(chip,{x:0,y:0,scale:0.6,opacity:0},{scale:1,opacity:1,duration:0.2,ease:'power2.out',onComplete:()=>{
    gsap.to(chip,{x:dx,y:dy,scale:0.45,opacity:0,duration:0.75,ease:'power2.inOut',onComplete:()=>{
      chip.remove();
      gsap.fromTo(target,{scale:1.05},{scale:1,duration:0.35,ease:'power2.out'});
    }});
  }});
}
function flyXp(ev,amount){flyChip(ev,`+${amount} XP`,'.gm-level-widget','xp-fly');}

// Smooth number count-up (used for XP, coins, level)
function tweenNum(el,to,ms=600){
  if(!el)return;
  const target=Math.round(to||0);
  const from=parseInt(String(el.textContent).replace(/[^0-9\-]/g,''),10)||0;
  if(from===target){el.textContent=target;return;}
  const t0=performance.now();
  function step(t){
    const p=Math.min(1,(t-t0)/ms);
    const e=1-Math.pow(1-p,3);
    el.textContent=Math.round(from+(target-from)*e);
    if(p<1)requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

// Short celebratory chime (Web Audio, no asset file) — respects the Sound & confetti toggle
let _fxAudioCtx=null;
function playChime(){
  if(st.fxEnabled===false)return;
  try{
    if(!_fxAudioCtx)_fxAudioCtx=new (window.AudioContext||window.webkitAudioContext)();
    const ctx=_fxAudioCtx;
    if(ctx.state==='suspended')ctx.resume();
    const now=ctx.currentTime;
    [523.25,659.25,783.99].forEach((freq,i)=>{
      const osc=ctx.createOscillator(),gain=ctx.createGain();
      osc.type='sine';osc.frequency.value=freq;
      const t=now+i*0.08;
      gain.gain.setValueAtTime(0,t);
      gain.gain.linearRampToValueAtTime(0.1,t+0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001,t+0.35);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);osc.stop(t+0.4);
    });
  }catch(e){console.error('[fx] chime',e.message);}
}

// Confetti burst from a click position (or screen center if no event) — respects the Sound & confetti toggle
function confettiBurst(ev){
  if(st.fxEnabled===false||typeof gsap==='undefined')return;
  const colors=['#e8eaf0','#fbbf24','#2ecc8a','#f05090','#5ba3ff','#a78bfa'];
  const ox=ev?ev.clientX:window.innerWidth/2,oy=ev?ev.clientY:window.innerHeight/3;
  for(let i=0;i<16;i++){
    const p=document.createElement('div');
    p.className='confetti-piece';
    p.style.left=ox+'px';p.style.top=oy+'px';
    p.style.background=colors[i%colors.length];
    document.body.appendChild(p);
    const angle=Math.random()*Math.PI*2,dist=50+Math.random()*80;
    const dx=Math.cos(angle)*dist,dy=Math.sin(angle)*dist*0.6-30;
    gsap.fromTo(p,{x:0,y:0,opacity:1,rotation:Math.random()*360,scale:0.7+Math.random()*0.5},{x:dx,y:dy+130,opacity:0,rotation:`+=${(Math.random()>0.5?1:-1)*360}`,duration:0.85+Math.random()*0.4,ease:'power1.out',onComplete:()=>p.remove()});
  }
}

// Small coin particle burst at a target element (level-ups, purchases)
function coinBurst(targetSel){
  const target=document.querySelector(targetSel||'#gm-coins-widget');
  if(!target)return;
  const r=target.getBoundingClientRect();
  const cx=r.left+r.width/2,cy=r.top+r.height/2;
  for(let i=0;i<8;i++){
    const p=document.createElement('div');
    p.className='coin-particle';p.textContent='◈';
    p.style.left=cx+'px';p.style.top=cy+'px';
    document.body.appendChild(p);
    const a=(i/8)*Math.PI*2+Math.random()*0.5,d=32+Math.random()*30;
    gsap.fromTo(p,{x:0,y:0,scale:0.5,opacity:1},{x:Math.cos(a)*d,y:Math.sin(a)*d,scale:1,opacity:0,duration:0.65+Math.random()*0.25,ease:'power2.out',onComplete:()=>p.remove()});
  }
}

function renderHomeGamification(){
  if(!window.sychboard)return;
  Promise.all([
    window.sychboard.profile.get(),
    window.sychboard.streaks.get(),
    window.sychboard.quests.list(),
    window.sychboard.badges.list(),
    window.sychboard.activity.recent(),
    window.sychboard.coins?window.sychboard.coins.get():0
  ]).then(([profile,streaks,quests,badges,activity,coins])=>{
    if(!profile)return;

    // ── SychCoins ──
    tweenNum(document.getElementById('gm-coins-num'),coins||0);

    // ── Greeting ──
    const hr=new Date().getHours();
    const gEl=document.getElementById('gm-greeting-label');
    if(gEl)gEl.textContent=`${hr<12?'GOOD MORNING':hr<17?'GOOD AFTERNOON':'GOOD EVENING'}, ${(st.userName||'OPERATOR').toUpperCase()}`;

    // ── Level bar ──
    const pct=Math.min(100,(profile.currentLevelXp/profile.xpToNext)*100);
    tweenNum(document.getElementById('gm-level'),profile.level,400);
    tweenNum(document.getElementById('gm-xp-cur'),profile.currentLevelXp,500);
    const xpMax=document.getElementById('gm-xp-max');if(xpMax)xpMax.textContent=profile.xpToNext;
    const fill=document.getElementById('gm-xp-fill');if(fill)fill.style.width=pct+'%';
    const rank=document.getElementById('gm-rank');if(rank)rank.textContent=profile.rank;

    // ── Streak ──
    const gs=streaks?.globalStreak||0;
    const sNum=document.getElementById('gm-streak-num');if(sNum)sNum.textContent=gs;
    const sSub=document.getElementById('gm-streak-sub');if(sSub)sSub.textContent=streaks?.globalLongest>0&&gs>=streaks.globalLongest?'🔥 Personal best':'Keep it up';
    const sw=document.getElementById('gm-streak-widget');if(sw)sw.classList.toggle('active',gs>0);

    // ── Stat cards ──
    const setDelta=(id,pct)=>{
      const el=document.getElementById(id);if(!el)return;
      if(pct==null||!isFinite(pct)){el.textContent='';el.className='gm-sc-delta';return;}
      el.textContent=`${pct>=0?'+':''}${pct.toFixed(1)}%`;
      el.className='gm-sc-delta '+(pct>0.05?'pos':pct<-0.05?'neg':'flat');
    };
    const sparkDelta=pts=>pts&&pts.length>1&&pts[0]>0?((pts[pts.length-1]-pts[0])/pts[0])*100:null;
    const wealth=st.balances.bank+st.balances.savings+st.balances.trading;
    const finEl=document.getElementById('gm-fin-val');if(finEl)finEl.textContent=fmt(wealth);
    const finPts=[st.balances.savings||0,st.balances.bank||0,wealth*0.92,wealth*0.96,wealth].map(v=>v||0);
    drawSparkline('gm-spark-fin',finPts);
    setDelta('gm-fin-delta',wealth>0?((wealth-wealth*0.92)/(wealth*0.92))*100:null);
    const ytEl=document.getElementById('gm-yt-val');if(ytEl)ytEl.textContent=`${fmtK(st.yt.subs||0)} subs`;
    const ytPts=[...Array(7)].map((_,i)=>Math.max(0,(st.yt.subs||0)*(0.7+i*0.05)));
    if(st.yt.subs>0){drawSparkline('gm-spark-yt',ytPts);}
    setDelta('gm-yt-delta',st.yt.subs>0?sparkDelta(ytPts.slice(-2)):null);
    const habDone=st.habits.filter(h=>h.done).length;
    const fitEl=document.getElementById('gm-fit-val');if(fitEl)fitEl.textContent=`${habDone}/${st.habits.length} habits`;
    const fitPts=[...Array(7)].map((_,i)=>Math.round(habDone*(0.3+i*0.1)));drawSparkline('gm-spark-fit',fitPts,'#34d399');
    setDelta('gm-fit-delta',habDone>0&&st.habits.length?((habDone/st.habits.length)*100)-100:null);

    // ── Quests (cards grouped by category) ──
    const CAT_COLORS=QCAT_COLORS;
    const dailyQuests=(quests||[]).filter(q=>q.frequency==='daily');
    const epicQuests=(quests||[]).filter(q=>q.frequency==='epic'&&!q.completed_today);
    const doneCount=dailyQuests.filter(q=>q.completed_today).length;
    const progEl=document.getElementById('gm-quests-prog');if(progEl)progEl.textContent=`${doneCount}/${dailyQuests.length} complete`;

    const questCard=(q,i)=>{
      const qc=CAT_COLORS[q.category_key]||q.category_color||'#8f92a1';
      const freq=q.frequency==='weekly'?' · Weekly':q.frequency==='epic'?' · Milestone':'';
      return`<div class="gm-quest-item${q.completed_today?' done':''}" style="--qc:${qc};animation-delay:${Math.min((i||0)*30,300)}ms" onclick="gmCompleteQuest(${q.id},${!q.completed_today},event)">
        <div class="gm-qi-check${q.completed_today?' done':''}"></div>
        <div class="gm-qi-body">
          <div class="gm-qi-name">${sanitizeText(q.name,80)}</div>
          <div class="gm-qi-cat">${q.category_name}${freq}</div>
        </div>
        <div class="gm-qi-xp${q.completed_today?' done':''}">+${q.base_xp}XP</div>
      </div>`;
    };
    const qcatCollapsed=S.get('qcatCollapsed')||{};
    const catGroup=(key,name,qs)=>{
      const col=!!qcatCollapsed[key];
      const doneN=qs.filter(q=>q.completed_today).length;
      return`<div class="gm-qcat-hd${col?' collapsed':''}" id="qch-${key}" style="--qc:${CAT_COLORS[key]||'#8f92a1'}" onclick="toggleQuestCat('${key}')">
          <span class="gm-qcat-dot"></span><span class="gm-qcat-name">${name}</span>
          <span class="gm-qcat-count">${doneN}/${qs.length}</span><span class="gm-qcat-chev">▾</span>
        </div>
        <div class="gm-qcat-body${col?' collapsed':''}" id="qcb-${key}">${qs.map(questCard).join('')}</div>`;
    };
    const byCat={};
    (quests||[]).filter(q=>q.frequency!=='epic').forEach(q=>{
      (byCat[q.category_key]=byCat[q.category_key]||{name:q.category_name,qs:[]}).qs.push(q);
    });
    const catOrder=['health','productivity','creativity','finance'];
    Object.values(byCat).forEach(c=>c.qs.sort((a,b)=>(a.frequency==='daily'?0:1)-(b.frequency==='daily'?0:1)));
    const orderedKeys=[...catOrder.filter(k=>byCat[k]),...Object.keys(byCat).filter(k=>!catOrder.includes(k))];
    let questHtml=orderedKeys.map(k=>catGroup(k,byCat[k].name,byCat[k].qs)).join('');
    if(epicQuests.length)questHtml+=catGroup('milestones','Milestones',epicQuests);
    const questList=document.getElementById('gm-quests-list');
    if(questList)questList.innerHTML=questHtml||'<div style="font-size:12px;color:var(--text3);padding:4px 0">No quests yet</div>';

    // ── Next best action nudge ──
    // Picks one thing to do next: a streak-at-risk quest first (highest current
    // streak wins, since that's the most to lose), else the highest-XP quest.
    const catStreak={};
    (streaks?.categories||[]).forEach(c=>{catStreak[c.key]=c.current_streak||0;});
    const incompleteDaily=dailyQuests.filter(q=>!q.completed_today);
    let nudgeQuest=null,nudgeReason=null;
    if(incompleteDaily.length){
      const atRisk=incompleteDaily.filter(q=>(catStreak[q.category_key]||0)>0)
        .sort((a,b)=>(catStreak[b.category_key]||0)-(catStreak[a.category_key]||0));
      if(atRisk.length){nudgeQuest=atRisk[0];nudgeReason='streak';}
      else{nudgeQuest=[...incompleteDaily].sort((a,b)=>b.base_xp-a.base_xp)[0];nudgeReason='xp';}
    }
    const nudgeEl=document.getElementById('gm-nudge');
    if(nudgeEl){
      if(nudgeQuest){
        const qName=sanitizeText(nudgeQuest.name,60);
        const text=nudgeReason==='streak'
          ?`Keep your ${catStreak[nudgeQuest.category_key]}-day ${sanitizeText(nudgeQuest.category_name,30)} streak alive — "${qName}"`
          :`Biggest win available: "${qName}" (+${nudgeQuest.base_xp} XP)`;
        nudgeEl.className='gm-nudge';
        nudgeEl.innerHTML=`<span class="gm-nudge-icon">${nudgeReason==='streak'?'🔥':'⚡'}</span><div class="gm-nudge-body"><div class="gm-nudge-label">Next best action</div><div class="gm-nudge-text">${text}</div></div><button class="gm-nudge-btn" onclick="gmCompleteQuest(${nudgeQuest.id},true,event)">Do it</button>`;
        nudgeEl.style.display='';
      }else if(dailyQuests.length){
        nudgeEl.className='gm-nudge done';
        nudgeEl.innerHTML=`<span class="gm-nudge-icon">🎉</span><div class="gm-nudge-body"><div class="gm-nudge-label">Next best action</div><div class="gm-nudge-text">All daily quests complete — nice work today</div></div>`;
        nudgeEl.style.display='';
      }else{
        nudgeEl.style.display='none';
      }
    }

    // ── Upcoming ──
    const evs=st.scheduleEvents&&st.scheduleEvents.length===7?st.scheduleEvents:DEFAULT_SCHED_EVENTS;
    const di=new Date().getDay();const ai=di===0?6:di-1;
    const todayEvs=evs[ai]||[];
    const upEl=document.getElementById('gm-upcoming');
    if(upEl){
      if(!todayEvs.length){upEl.innerHTML='<div style="font-size:12px;color:var(--text3);padding:4px 0">No events today</div>';}
      else{
        const times={uni:'09:00',work:'18:00',stream:'20:00'};
        upEl.innerHTML=todayEvs.map((e,i)=>`<div class="gm-ev"><span class="gm-ev-time">${times[e.c]||'—'}</span><span class="gm-ev-dot"></span><span class="gm-ev-name">${e.t}</span><button class="gm-ev-del" title="Remove" onclick="removeUpcomingEvent(${ai},${i})">×</button></div>`).join('');
      }
    }

    // ── Achievements ──
    const badgeEl=document.getElementById('gm-badges');
    if(badgeEl&&badges){
      const show=badges.slice(0,8);
      badgeEl.innerHTML=show.map(b=>`<div class="gm-badge${b.unlocked?' unlocked':' locked'}" title="${b.name}: ${b.description||''}">${b.icon||'🏅'}</div>`).join('');
    }

    // ── Recent Activity ──
    const actEl=document.getElementById('gm-activity');
    if(actEl){
      if(!activity||!activity.length){actEl.innerHTML='<div style="font-size:12px;color:var(--text3);padding:4px 0">No activity yet — complete your first quest!</div>';}
      else{
        actEl.innerHTML=activity.map(a=>{
          const ago=_timeAgo(parseUtcTimestamp(a.completed_at));
          return`<div class="gm-act-item"><div class="gm-act-icon">●</div><div class="gm-act-body"><div class="gm-act-name">Completed "${sanitizeText(a.quest_name,50)}"</div><div class="gm-act-meta">${ago}</div></div><div class="gm-act-xp">+${a.xp_awarded}XP</div></div>`;
        }).join('');
      }
    }

    // ── Section grid ──
    const recentSleep=(st.sleep?.logs||[]).slice(-1)[0];
    const sleepSum=recentSleep?`${sleepDuration(recentSleep.bed,recentSleep.wake).toFixed(1)}h`:'—';
    const sums={finance:`${fmt(wealth)} total`,uni:`Exam: ${st.examDate}`,youtube:`${fmtK(st.yt.subs||0)} subs · ${fmtK(st.yt.views||0)} views`,dev:`${st.dev?.members||0} members · ${st.dev?.status||'—'}`,schedule:`${todayEvs.length} events today`,habits:`${habDone}/${st.habits.length} done`,sleep:`${sleepSum} last night`,fitness:`${st.fitnessGoals.filter(g=>!g.done).length} goals`,travel:`${st.trips.length} trips`,goals:`${st.goals.filter(g=>!g.done).length} active`,todos:`${[...st.genTodos,...Object.values(st.secTodos||{}).flat()].filter(t=>!t.done).length} pending`,journal:`${Object.keys(st.journals).length} entries`};
    const vis=st.sections.filter(s=>s.visible);
    const gridEl=document.getElementById('home-grid');
    if(gridEl)gridEl.innerHTML=vis.map((s,i,arr)=>{const w=arr.length%2!==0&&i===arr.length-1;return`<div class="home-card${w?' wide':''}" onclick="goPage('${s.id}')"><span class="hc-icon">${s.icon||'📁'}</span><div class="hc-label">${s.label}</div><div class="hc-value">${sums[s.id]||'Tap to open'}</div><div class="hc-arrow">›</div></div>`;}).join('');

  }).catch(e=>console.error('[renderHomeGamification]',e));
}

function _timeAgo(date){
  const s=Math.round((Date.now()-date.getTime())/1000);
  if(s<60)return'Just now';if(s<3600)return`${Math.floor(s/60)} min ago`;
  if(s<86400)return`${Math.floor(s/3600)} hr ago`;return`${Math.floor(s/86400)}d ago`;
}
// db.js timestamps come from SQLite's datetime('now') as "YYYY-MM-DD HH:MM:SS" UTC with
// no timezone marker. new Date() on that exact string is parsed as LOCAL time (not UTC)
// by V8's non-ISO date-time fallback, so every such timestamp silently comes out wrong
// by the local UTC offset. Appending 'Z' (after swapping the space for 'T') makes it a
// real ISO-8601 UTC string so it parses correctly everywhere.
function parseUtcTimestamp(s){return new Date(s.replace(' ','T')+'Z');}
// Local calendar-day string (YYYY-MM-DD) for a Date, using its LOCAL fields —
// never toISOString().slice(0,10), which formats in UTC and silently shifts
// the day for any non-UTC timezone (the same app-date/real-date mixing bug
// class fixed throughout src/db.js and in computeLocalAppDate() below, but
// still present at every "today"/date-key call site in the legacy
// localStorage-backed habit history and sleep log until this fix — e.g. a
// habit ticked at 11pm EST (already past UTC midnight) was misfiled into
// tomorrow's heatmap bucket while maybeResetHabits(), which already used the
// correct local toDateString(), hadn't rolled the day over yet).
function localDateStr(d){return`${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2,'0')}-${d.getDate().toString().padStart(2,'0')}`;}
// Clamps a billing day-of-month (1-31) to the real last day of the given month, so day-29/30/31
// subscriptions don't overflow into (or skip) the following month when that month is shorter.
function clampDayOfMonth(y,m,day){return Math.min(day,new Date(y,m+1,0).getDate());}
// Monday of the local Mon-Sun calendar week containing d, mirroring db.js's isoWeekRange().
function mondayOfWeek(d){const dow=d.getDay();const monday=new Date(d);monday.setDate(monday.getDate()+(dow===0?-6:1-dow));return localDateStr(monday);}

function renderHome(){
  renderSidebar();
  renderHomeGamification();
}

function updateLiveStats(){
  // Legacy shims — IDs are hidden in the DOM but updateLiveStats may still run
  const done=st.habits.filter(h=>h.done).length;
  const wealth=st.balances.bank+st.balances.savings+st.balances.trading;
  const recentSleep=(st.sleep?.logs||[]).slice(-1)[0];
  const sleepHours=recentSleep?sleepDuration(recentSleep.bed,recentSleep.wake).toFixed(1):'—';
  const subs=st.yt.subs||0;
  const setTxt=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v;};
  setTxt('ls-subs',subs>0?fmtK(subs):'—');setTxt('ls-subs-sub',subs>0?`${fmtK(st.yt.views||0)} views`:'');
  setTxt('ls-wealth',fmt(wealth));setTxt('ls-wealth-sub',`${fmt(st.balances.bank||0)} bank`);
  setTxt('ls-habits',`${done}/${st.habits.length}`);setTxt('ls-habits-sub',done===st.habits.length?'All done! 🎉':st.habits.length-done+' remaining');
  setTxt('ls-sleep',sleepHours+'h');setTxt('ls-sleep-sub',recentSleep?`${recentSleep.bed}→${recentSleep.wake}`:'');
}

// ═══ LIVE STATS INTERVAL ═══
let liveStatsInterval=null;
function startLiveStatsUpdates(){
  if(liveStatsInterval)clearInterval(liveStatsInterval);
  liveStatsInterval=setInterval(()=>{try{updateLiveStats();}catch(e){}},30000);
}
function stopLiveStatsUpdates(){
  if(liveStatsInterval){clearInterval(liveStatsInterval);liveStatsInterval=null;}
}

// ═══ GAME TAB ═══
async function rGame(){
  const el=document.getElementById('game-content');if(!el)return;
  if(!window.sychboard){el.innerHTML='<div class="card"><div class="empty">Gamification data unavailable</div></div>';return;}
  const[profile,streaks,badges,coins,history]=await Promise.all([
    window.sychboard.profile.get(),
    window.sychboard.streaks.get(),
    window.sychboard.badges.list(),
    window.sychboard.coins?window.sychboard.coins.get():0,
    window.sychboard.xp?window.sychboard.xp.history(7):[]
  ]);
  if(!profile)return;
  const pct=Math.min(1,profile.currentLevelXp/profile.xpToNext);
  const CIRC=2*Math.PI*52;

  // Hero
  const hero=`<div class="card game-hero">
    <div class="game-ring-wrap">
      <svg class="game-ring" viewBox="0 0 120 120">
        <circle class="game-ring-bg" cx="60" cy="60" r="52"/>
        <circle class="game-ring-fill" id="game-ring-fill" cx="60" cy="60" r="52" stroke-dasharray="${CIRC.toFixed(1)}" stroke-dashoffset="${CIRC.toFixed(1)}"/>
      </svg>
      <div class="game-ring-center"><div class="game-level-num" id="game-level">0</div><div class="game-level-label">LEVEL</div></div>
    </div>
    <div class="game-hero-info">
      <div class="game-rank">${profile.rank}</div>
      <div class="game-xp-line"><span id="game-xp-cur">0</span> / ${profile.xpToNext} XP to level ${profile.level+1}</div>
      <div class="game-hero-stats">
        <div class="metric"><div class="ml">Total XP</div><div class="mv" id="game-total-xp">0</div></div>
        <div class="metric"><div class="ml">SychCoins</div><div class="mv" style="color:var(--amber)" id="game-coins">0</div></div>
        <div class="metric"><div class="ml">Day Streak</div><div class="mv" id="game-gstreak">0</div></div>
      </div>
    </div>
  </div>`;

  // Per-category streaks
  const streakCards=(streaks?.categories||[]).map(c=>`
    <div class="game-streak-card" style="--qc:${QCAT_COLORS[c.key]||'#8f92a1'}">
      <div class="gsc-name"><span class="gm-qcat-dot"></span>${c.name}</div>
      <div class="gsc-cur">${c.current_streak}<span class="gsc-unit">d</span></div>
      <div class="gsc-meta">Longest ${c.longest_streak}d · ${c.freeze_tokens>0?`❄️×${c.freeze_tokens}`:'no freezes'}</div>
    </div>`).join('');

  // XP history bars (single series, white; selective label on the max day, value on hover)
  const maxXp=Math.max(1,...history.map(h=>h.xp));
  const bars=history.map(h=>{
    const hPct=Math.round((h.xp/maxXp)*100);
    const isMax=h.xp===maxXp&&h.xp>0;
    return`<div class="gm-xph-col" title="${h.date}: ${h.xp} XP">
      <span class="gm-xph-val${isMax?' show':''}">${h.xp}</span>
      <div class="gm-xph-bar" style="--h:${Math.max(h.xp>0?4:2,hPct)}%"><div class="gm-xph-fill${h.xp===0?' zero':''}"></div></div>
      <span class="gm-xph-day">${h.label}</span>
    </div>`;
  }).join('');

  // Achievements — full grid, locked padlocked
  const unlockedN=badges.filter(b=>b.unlocked).length;
  const badgeGrid=badges.map(b=>`
    <div class="game-badge${b.unlocked?' unlocked':' locked'}" title="${b.name}: ${b.description||''}${b.unlocked&&b.unlocked_at?` — unlocked ${parseUtcTimestamp(b.unlocked_at).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}`:''}">
      <div class="game-badge-icon">${b.icon||'🏅'}</div>
      ${b.unlocked?'':'<div class="game-badge-lock">🔒</div>'}
      <div class="game-badge-name">${b.name}</div>
    </div>`).join('');

  el.innerHTML=hero
    +`<div class="card"><div class="card-title">Category Streaks</div><div class="game-streaks">${streakCards}</div></div>`
    +`<div class="card"><div class="card-title">XP — Last 7 Days</div><div class="gm-xph">${bars}</div></div>`
    +`<div class="card"><div class="card-header"><div class="card-title" style="margin-bottom:0">Achievements</div><span class="chip chip-b">${unlockedN}/${badges.length}</span></div><div class="game-badges">${badgeGrid}</div></div>`;

  // Animate in: ring draw, count-ups, bar growth
  requestAnimationFrame(()=>{
    const ring=document.getElementById('game-ring-fill');
    if(ring)ring.style.strokeDashoffset=(CIRC*(1-pct)).toFixed(1);
    tweenNum(document.getElementById('game-level'),profile.level,500);
    tweenNum(document.getElementById('game-xp-cur'),profile.currentLevelXp,700);
    tweenNum(document.getElementById('game-total-xp'),profile.totalXp,700);
    tweenNum(document.getElementById('game-coins'),coins||0,700);
    tweenNum(document.getElementById('game-gstreak'),streaks?.globalStreak||0,500);
    document.querySelectorAll('.gm-xph-fill').forEach((f,i)=>setTimeout(()=>f.classList.add('grow'),60*i));
  });
}

// ═══ SHOP ═══
const SHOP_ITEMS=[
  // Accent colours
  {key:'accent_white',type:'accent',cat:'Accent Colours',name:'Soft White',cost:0,value:'#e8eaf0'},
  {key:'accent_cyan',type:'accent',cat:'Accent Colours',name:'Cyan',cost:50,value:'#22d3ee'},
  {key:'accent_purple',type:'accent',cat:'Accent Colours',name:'Purple',cost:75,value:'#8b5cf6'},
  {key:'accent_red',type:'accent',cat:'Accent Colours',name:'Red',cost:75,value:'#ef4444'},
  {key:'accent_emerald',type:'accent',cat:'Accent Colours',name:'Emerald',cost:75,value:'#34d399'},
  {key:'accent_gold',type:'accent',cat:'Accent Colours',name:'Gold',cost:100,value:'#f59e0b'},
  // Fonts
  {key:'font_grotesk',type:'font',cat:'Fonts',name:'Space Grotesk',cost:0,value:"'Space Grotesk',-apple-system,sans-serif"},
  {key:'font_inter',type:'font',cat:'Fonts',name:'Inter',cost:50,value:"'Inter',-apple-system,sans-serif"},
  {key:'font_mono',type:'font',cat:'Fonts',name:'JetBrains Mono',cost:75,value:"'JetBrains Mono',monospace"},
  // Backgrounds
  {key:'bg_deepspace',type:'bg',cat:'Backgrounds',name:'Deep Space',cost:0,value:'deepspace'},
  {key:'bg_nebula',type:'bg',cat:'Backgrounds',name:'Nebula',cost:100,value:'nebula'},
  {key:'bg_carbon',type:'bg',cat:'Backgrounds',name:'Carbon Grid',cost:150,value:'carbon'},
  {key:'bg_aurora',type:'bg',cat:'Backgrounds',name:'Aurora',cost:150,value:'aurora'},
  // Card styles
  {key:'card_standard',type:'card',cat:'Card Styles',name:'Standard',cost:0,value:'standard'},
  {key:'card_glow',type:'card',cat:'Card Styles',name:'Glow Edge',cost:100,value:'glow'},
  {key:'card_glass',type:'card',cat:'Card Styles',name:'Glass',cost:150,value:'glass'},
  // Boot orb
  {key:'orb_white',type:'orb',cat:'Boot Orb',name:'Ion White',cost:0,value:'white'},
  {key:'orb_cyan',type:'orb',cat:'Boot Orb',name:'Cyan Core',cost:100,value:'cyan'},
  {key:'orb_gold',type:'orb',cat:'Boot Orb',name:'Gold Halo',cost:150,value:'gold'},
  // Consumables
  {key:'freeze_token',type:'consumable',cat:'Consumables',name:'Streak Freeze',cost:150,value:'freeze',desc:'+1 freeze token for every category (max 3). Protects a missed day.'}
];
const EQUIP_DEFAULTS={accent:null,font:'font_grotesk',bg:'bg_deepspace',card:'card_standard',orb:'orb_white'};
let shopEquips={...EQUIP_DEFAULTS};
let shopOwned=[];

async function loadEquips(){
  if(!window.sychboard?.settings)return;
  try{
    const types=['accent','font','bg','card','orb'];
    const vals=await Promise.all([...types.map(t=>window.sychboard.settings.get('equip_'+t)),window.sychboard.settings.get('shop_owned')]);
    types.forEach((t,i)=>{if(vals[i])shopEquips[t]=vals[i];});
    try{shopOwned=JSON.parse(vals[types.length]||'[]');}catch(e){shopOwned=[];}
    applyEquips();
  }catch(e){console.warn('[shop] loadEquips failed:',e.message);}
}

function applyEquips(){
  const find=k=>SHOP_ITEMS.find(i=>i.key===k);
  const acc=find(shopEquips.accent);
  if(acc)applyColor(acc.value);
  const f=find(shopEquips.font)||find('font_grotesk');
  document.documentElement.style.setProperty('--font',f.value);
  document.body.dataset.bg=(find(shopEquips.bg)||{value:'deepspace'}).value;
  document.body.dataset.card=(find(shopEquips.card)||{value:'standard'}).value;
  window._orbTheme=(find(shopEquips.orb)||{value:'white'}).value;
}

function shopItemOwned(item){return item.cost===0||shopOwned.includes(item.key);}

async function rShop(){
  const el=document.getElementById('shop-content');if(!el)return;
  if(!window.sychboard){el.innerHTML='<div class="card"><div class="empty">Shop unavailable</div></div>';return;}
  const coins=window.sychboard.coins?await window.sychboard.coins.get():0;
  const preview=item=>{
    if(item.type==='accent')return`<div class="shop-prev"><div class="shop-prev-dot" style="background:${item.value}"></div></div>`;
    if(item.type==='font')return`<div class="shop-prev"><span class="shop-prev-font" style="font-family:${item.value}">Ag</span></div>`;
    if(item.type==='bg')return`<div class="shop-prev shop-prev-bg" data-bgprev="${item.value}"></div>`;
    if(item.type==='card')return`<div class="shop-prev"><div class="shop-prev-card" data-cardprev="${item.value}"></div></div>`;
    if(item.type==='orb')return`<div class="shop-prev"><div class="shop-prev-orb" data-orbprev="${item.value}"></div></div>`;
    return`<div class="shop-prev"><span style="font-size:22px">❄️</span></div>`;
  };
  const btn=item=>{
    if(item.type==='consumable')
      return`<button class="btn ${coins>=item.cost?'btn-p':''} btn-sm" onclick="buyShopItem('${item.key}')">Buy · ◈${item.cost}</button>`;
    if(!shopItemOwned(item))
      return`<button class="btn ${coins>=item.cost?'btn-p':''} btn-sm" onclick="buyShopItem('${item.key}')">Buy · ◈${item.cost}</button>`;
    if(shopEquips[item.type]===item.key||(item.type==='accent'&&!shopEquips.accent&&item.key==='accent_white'))
      return`<button class="btn btn-sm shop-equipped" disabled>Equipped ✓</button>`;
    return`<button class="btn btn-sm" onclick="equipShopItem('${item.key}')">Equip</button>`;
  };
  const cats=[...new Set(SHOP_ITEMS.map(i=>i.cat))];
  el.innerHTML=`
    <div class="card shop-header-card">
      <div>
        <div class="card-title" style="margin-bottom:4px">Customisation Shop</div>
        <div style="font-size:12px;color:var(--text2)">Earn SychCoins by completing quests and levelling up.</div>
      </div>
      <div class="shop-balance" id="shop-coins"><span class="gm-coin-icon">◈</span><span id="shop-coins-num">${coins}</span></div>
    </div>`
    +cats.map(cat=>`<div class="card">
      <div class="card-title">${cat}</div>
      <div class="shop-grid">${SHOP_ITEMS.filter(i=>i.cat===cat).map(item=>`
        <div class="shop-item${shopItemOwned(item)&&item.type!=='consumable'?' owned':''}">
          ${preview(item)}
          <div class="shop-item-name">${item.name}</div>
          ${item.desc?`<div class="shop-item-desc">${item.desc}</div>`:''}
          ${btn(item)}
        </div>`).join('')}</div>
    </div>`).join('');
}

async function buyShopItem(key){
  const item=SHOP_ITEMS.find(i=>i.key===key);if(!item||!window.sychboard)return;
  if(item.type==='consumable'){
    const res=await window.sychboard.shop.purchaseFreeze();
    if(!res?.ok){
      if(res?.error==='insufficient'){shakeShopBalance();toast('Not enough SychCoins');}
      else toast('Purchase failed');
      return;
    }
    toast('❄️ Streak Freeze added to all categories');
    coinBurst('#shop-coins');
    rShop();
    return;
  }
  const res=await window.sychboard.shop.purchase(key,item.cost);
  if(!res?.ok){
    if(res?.error==='insufficient'){shakeShopBalance();toast('Not enough SychCoins');}
    else if(res?.error==='already_owned')toast('Already owned');
    else toast('Purchase failed');
    return;
  }
  shopOwned=res.owned||shopOwned;
  coinBurst('#shop-coins');
  toast(`Purchased ${item.name}!`);
  await equipShopItem(key);
}

async function equipShopItem(key){
  const item=SHOP_ITEMS.find(i=>i.key===key);if(!item||!window.sychboard)return;
  shopEquips[item.type]=key;
  try{await window.sychboard.settings.set('equip_'+item.type,key);}catch(e){}
  applyEquips();
  rShop();
}

function shakeShopBalance(){
  const el=document.getElementById('shop-coins')||document.getElementById('gm-coins-widget');
  if(!el||typeof gsap==='undefined')return;
  gsap.fromTo(el,{x:-5},{x:0,duration:0.4,ease:'elastic.out(1,0.3)'});
}

// ═══ SCHEDULE EDITING (Upcoming widget) ═══
function addEventFromModal(){
  const day=parseInt(document.getElementById('ev-day').value,10);
  const name=sanitizeText(document.getElementById('ev-name').value,60).trim();
  const type=document.getElementById('ev-type').value;
  if(!name){toast('Enter an event name');return;}
  initSchedEvents();
  st.scheduleEvents[day].push({t:name,c:type});
  save();
  closeModal('modal-event');
  document.getElementById('ev-name').value='';
  renderHomeGamification();
  toast('Event added');
}
function removeUpcomingEvent(dayIdx,evIdx){
  if(!st.scheduleEvents?.[dayIdx])return;
  st.scheduleEvents[dayIdx].splice(evIdx,1);
  save();
  renderHomeGamification();
}
const DAY_NAMES=['mon','tue','wed','thu','fri','sat','sun'];
function dayIndexOf(d){
  const s=String(d).trim().toLowerCase();
  if(/^[0-6]$/.test(s))return parseInt(s,10);
  const i=DAY_NAMES.findIndex(n=>s.startsWith(n));
  return i;
}

// ═══ AI ═══
// ── MCP live tools (sychboard-mcp via main process) ──
let _mcpTools=null;
async function getMcpTools(){
  if(_mcpTools!==null)return _mcpTools;
  try{
    const r=await window.sychboard?.mcp?.listTools();
    if(r&&r.ok){_mcpTools=r.tools||[];return _mcpTools;}
    if(r)console.warn('[mcp] unavailable:',r.error);
  }catch(e){console.warn('[mcp] unavailable:',e.message);}
  return [];
}
function escAttr(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
// Cosmetic only — chat-bubble copy for known tools. Falls back to the raw
// tool name for anything not listed, so new tools never break silently.
const TOOL_FRIENDLY_NAMES={
  get_system_status:'Checking system status',
  get_chuck_bird_status:'Checking Chuck Bird bot status',
  list_recent_project_files:'Checking recent project files',
  restart_chuck_bird:'Restarting Chuck Bird bot',
  git_diff:'Reading git diff',
  git_commit:'Committing changes',
  git_push:'Pushing to remote',
};
function friendlyToolName(name){return TOOL_FRIENDLY_NAMES[name]||name;}
// Ephemeral approval bubble in the chat — resolves true/false, not saved to history.
// `description` (from the tool's MCP metadata) is shown as-is so write/risky
// actions like restart_chuck_bird show their real command, not a vague label.
function askToolApproval(name,args,description){
  return new Promise(res=>{
    const msgs=document.getElementById('chat-msgs');
    if(!msgs){res(false);return;}
    const argStr=Object.keys(args||{}).length?JSON.stringify(args):'';
    const el=document.createElement('div');
    el.className='ai-msg ai';
    el.innerHTML=`<div class="ai-bubble">🔧 <b>${escAttr(friendlyToolName(name))}</b>${argStr?` <span style="opacity:.6;font-size:11px">${escAttr(argStr)}</span>`:''}${description?`<div style="opacity:.65;font-size:11px;margin-top:4px">${escAttr(description)}</div>`:''}<div style="margin-top:8px;display:flex;gap:8px"><button class="btn btn-p btn-sm" data-act="allow">Allow</button><button class="btn btn-sm" data-act="deny">Deny</button></div></div>`;
    const done=(ok)=>{
      el.querySelector('.ai-bubble').innerHTML=`🔧 <b>${escAttr(friendlyToolName(name))}</b> — ${ok?'allowed, running…':'denied'}`;
      res(ok);
    };
    el.querySelector('[data-act="allow"]').addEventListener('click',()=>done(true));
    el.querySelector('[data-act="deny"]').addEventListener('click',()=>done(false));
    msgs.appendChild(el);msgs.scrollTop=msgs.scrollHeight;
  });
}
function toolNote(name,status){
  const msgs=document.getElementById('chat-msgs');if(!msgs)return;
  const icons={ok:'✓',error:'✗',denied:'⛔'};
  const el=document.createElement('div');
  el.className='ai-msg ai';
  el.innerHTML=`<div class="ai-bubble" style="opacity:.65;font-size:12px">🔧 ${escAttr(friendlyToolName(name))} ${icons[status]||''}</div>`;
  msgs.appendChild(el);msgs.scrollTop=msgs.scrollHeight;
}
async function runMcpToolCall(tc){
  const name=tc.function?.name;
  let args={};
  try{args=JSON.parse(tc.function?.arguments||'{}');}catch(e){}
  const meta=(_mcpTools||[]).find(t=>t.name===name);
  if(!meta)return`Error: unknown tool "${name}". Only use the tools you were given.`;
  let approved=true;
  if(meta.mode!=='auto')approved=await askToolApproval(name,args,meta.description);
  if(!approved)return'The user denied this tool call. Do not retry it; answer without it.';
  try{
    const r=await window.sychboard.mcp.callTool(name,args,true);
    toolNote(name,r&&!r.isError?'ok':'error');
    return(r&&r.text)||'Error: tool returned no result.';
  }catch(e){toolNote(name,'error');return'Error: '+(e.message||e);}
}
async function callGroq(messages){
  const key=getGroqKey();
  if(!key)return null;
  const navSections='finance, uni, youtube, dev, schedule, habits, sleep, fitness, travel, goals, todos, journal, ai, settings'+(st.sections.filter(s=>!['finance','uni','youtube','dev','schedule','habits','sleep','fitness','travel','goals','todos','journal','ai','settings'].includes(s.id)).map(s=>`, ${s.id}`).join(''));
  // Build rich context snapshot
  const wealth=st.balances.bank+st.balances.savings+st.balances.trading;
  const habitsDoneToday=st.habits.filter(h=>h.done);
  const habitsPending=st.habits.filter(h=>!h.done);
  const pendingTodos=[...st.genTodos,...Object.values(st.secTodos).flat()].filter(t=>!t.done).length;
  const activeGoals=st.goals.filter(g=>!g.done);
  const todayJournal=st.journals[new Date().toDateString()]||'';
  const recentJournals=Object.entries(st.journals).slice(-3).map(([d,t])=>`${d}: "${t.slice(0,80)}..."`).join('; ');
  const evs=st.scheduleEvents&&st.scheduleEvents.length===7?st.scheduleEvents:DEFAULT_SCHED_EVENTS;
  const now=new Date();const di=now.getDay();const ai=di===0?6:di-1;
  const timeStr=now.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});
  const todayEvs=(evs[ai]||[]).map(e=>e.t).join(', ')||'nothing scheduled';
  const dayLabels=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const weekSched=evs.map((d,i)=>`${dayLabels[i]}${i===ai?' (TODAY)':''}: ${(d||[]).map(e=>e.t).join(', ')||'free'}`).join('\n');
  // Gamification snapshot (level, streak, pending quests) from the SQLite side
  let gamCtx='';
  try{
    if(window.sychboard){
      const[gp,gs,gq]=await Promise.all([window.sychboard.profile.get(),window.sychboard.streaks.get(),window.sychboard.quests.list()]);
      if(gp){
        const pending=(gq||[]).filter(q=>q.frequency==='daily'&&!q.completed_today).map(q=>`${q.name} (+${q.base_xp}XP)`).slice(0,12);
        gamCtx=`
=== GAME PROGRESS ===
Level ${gp.level} (${gp.rank}) | ${gp.currentLevelXp}/${gp.xpToNext} XP to next level | Total XP: ${gp.totalXp} | Global day streak: ${gs?.globalStreak||0} (longest ${gs?.globalLongest||0})
Pending daily quests today: ${pending.join(', ')||'all done!'}
`;
      }
    }
  }catch(e){}
  const sys=`You are SychBoard AI — a personal life assistant for ${st.userName}. Below is their real personal data (finances, habits, goals, schedule, etc.) — reference it proactively in conversation, e.g. noticing patterns unprompted. Be concise, warm, and specific. Under 120 words unless asked for detail. Stay in character as their assistant at all times — if asked how you're doing/feeling, answer warmly and personally (e.g. reference their day or data), never with a generic disclaimer about being an AI/language model/not having feelings; that reads as cold and robotic, the opposite of this assistant's purpose. NOTE: if you're also given LIVE TOOLS further below, those follow separate, stricter rules — "use data proactively" here refers only to the data in this block, never to calling a tool.

=== FINANCES ===
Bank: £${st.balances.bank} | Savings: £${st.balances.savings} | Trading/Other: £${st.balances.trading} | Total wealth: £${wealth.toFixed(2)}
${t212Context()}
Upcoming shifts: ${st.shifts.slice(0,3).map(s=>`${s.date} ${s.hours}h @£${s.wage}`).join(', ')||'none logged'}
Subscriptions: ${(st.subscriptions||[]).map(s=>{const d0=new Date(now.getFullYear(),now.getMonth(),now.getDate());let due=new Date(now.getFullYear(),now.getMonth(),clampDayOfMonth(now.getFullYear(),now.getMonth(),s.date));if(due<d0){const y=now.getFullYear(),m=now.getMonth()+1;due=new Date(y,m,clampDayOfMonth(y,m,s.date));}const d=Math.round((due-d0)/864e5);return`${s.name} (£${s.amount}/mo, due day ${s.date}${d<=3?` — DUE IN ${d}d`:''})`;}).join(', ')||'none'}
Holidays: ${st.holidays.map(h=>`${h.name} (saved £${h.saved}/${h.target})`).join(', ')}

=== YOUTUBE ===
Channel: ${st.yt.channelName||'Channel'} | Subs: ${st.yt.subs} | Total views: ${fmtK(st.yt.views)} | Watch hours: ${st.yt.hours} (need 4000h for monetisation, ${Math.max(0,4000-st.yt.hours)}h to go)
${ytApiContext()}

=== UNI ===
Exam date: ${st.examDate} | Notes: ${(st.uniNotes||'').slice(0,120)||'none'}
Uni todos pending: ${(st.secTodos.uni||[]).filter(t=>!t.done).length}

=== HABITS (today) ===
Done (${habitsDoneToday.length}): ${habitsDoneToday.map(h=>h.label).join(', ')||'none yet'}
Pending (${habitsPending.length}): ${habitsPending.map(h=>h.label).join(', ')||'all done!'}

=== SLEEP ===
${sleepContext()||'No sleep data logged yet.'}
Targets: in bed by ${st.sleep?.targetBed||'23:00'}, goal ${st.sleep?.targetHours||8}h

=== GOALS ===
Active (${activeGoals.length}): ${activeGoals.slice(0,6).map(g=>`[${g.category}] ${g.text}`).join(' | ')||'none'}
Completed: ${st.goals.filter(g=>g.done).length}

=== SCHEDULE ===
Today (${now.toLocaleDateString('en-GB',{weekday:'long'})}, Current Time: ${timeStr}): ${todayEvs}
Full week:
${weekSched}
Days until Saturday stream: ${satDays()}
*Note: It is currently ${timeStr}. If an event has already passed, refer to it in the past tense (e.g. "How did your 11:30 session go?"). If it is coming up, remind them to prepare.*
${gamCtx}

=== TODOS ===
Total pending: ${pendingTodos} | Today's focus: ${st.todayFocus||'not set'}

=== FITNESS ===
Notes: ${(st.fitnessNotes||'').slice(0,150)||'none'}
Active goals: ${st.fitnessGoals.filter(g=>!g.done).map(g=>g.text).join(', ')||'none'}

=== JOURNAL ===
Today: ${todayJournal.slice(0,500)||'nothing written today'}
Recent: ${recentJournals||'no entries'}

=== PROACTIVE ROLE ===
Notice patterns and flag them: e.g. sleep getting later, habits missed multiple days, exam approaching, goals off track, wealth change. When you spot something worth mentioning, bring it up naturally alongside the answer.

DATA ACTIONS — embed these tags when the user gives information or asks to update data. Tags are stripped before display and never shown:
  [SET_BALANCE:bank:1500] | [SET_BALANCE:savings:1500] | [SET_BALANCE:trading:1500]
  [ADD_BALANCE:bank:200] (negative to subtract)
  [UPDATE_YT:subs:1200] | [UPDATE_YT:views:50000] | [UPDATE_YT:hours:3500]
  [SET_EXAM_DATE:15 June 2025]
  [ADD_TODO:task text] | [ADD_HABIT:habit name] | [COMPLETE_HABIT:habit name]
  [ADD_GOAL:goal text|category] (category: youtube/uni/dev/finance/fitness/general)
  [ADD_SHIFT:date:hours:wage] | [ADD_TRIP:destination:date:budget]
  [SET_FOCUS:text]
  [LOG_SLEEP:bedtime:waketime] e.g. [LOG_SLEEP:23:30:07:15] — log a sleep entry for tonight/last night
  [COMPLETE_GOAL:goal text] — mark a goal done (partial match)
  [DELETE_TODO:text] — delete a general todo (partial match)
  [ADD_SUBSCRIPTION:name:amount:day] e.g. [ADD_SUBSCRIPTION:Netflix:10.99:15]
  [REMOVE_HABIT:name] — delete a habit by name (partial match)
  [SET_YT_CHANNEL:name] — update the YouTube channel name
  [ADD_EVENT:day:name:type] — add a schedule event. day=Mon..Sun, type=uni|work|stream|other. e.g. user says "I have a dentist appointment Thursday at 3" → [ADD_EVENT:Thu:Dentist 3pm:other]
  [REMOVE_EVENT:day:name] — remove a schedule event by partial name match on that day. Use when plans are cancelled or changed (for changes: REMOVE then ADD).

NAVIGATION — use [NAVIGATE:sectionId] ONLY when the user explicitly asks to go to, open, or show a section (e.g. "show me finance", "take me to habits"). Do NOT emit [NAVIGATE] for data updates alone — just confirm the change and stay put. IDs: ${navSections}.`;
  try{
    const mcpTools=await getMcpTools();
    const tools=mcpTools.length?mcpTools.map(t=>({type:'function',function:{name:t.name,description:t.description,parameters:t.inputSchema}})):undefined;
    const fullSys=tools?sys+`\n\nLIVE TOOLS — you also have real callable tools (provided separately, not the tags above). They fetch live data: Chuck Bird bot health, this PC's CPU/RAM/disk, recently modified project files. STRICT RULES: call a tool ONLY if the user's LATEST message explicitly names that specific live data — e.g. "what's my CPU doing", "check disk space", "is Chuck up", "check the bot". Casual conversational phrases directed at YOU — "how are you doing", "how's it going", "what's up", "you good?" — are greetings, not status requests, and must NEVER trigger a tool call even though they sound status-adjacent. For everything else — greetings, small talk, data updates, questions about finances/habits/goals/schedule or anything already in your context — reply normally with NO tool call. Never re-call a tool to refresh an answer you already gave earlier in the conversation unless the user explicitly asks you to check again. When you do call one, answer from its JSON result in plain English; never invent tool output or tool names.`:sys;
    const convo=[{role:'system',content:fullSys},...messages];
    for(let round=0;round<4;round++){
      const body={model:'llama-3.3-70b-versatile',messages:convo,max_tokens:500,temperature:0.7};
      if(tools){body.tools=tools;body.tool_choice='auto';}
      const res=await fetch('https://api.groq.com/openai/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+key},body:JSON.stringify(body)});
      const d=await res.json();
      const m=d.choices?.[0]?.message;
      if(!m)return null;
      if(m.tool_calls?.length){
        convo.push(m);
        for(const tc of m.tool_calls){
          convo.push({role:'tool',tool_call_id:tc.id,content:await runMcpToolCall(tc)});
        }
        continue;
      }
      const reply=m.content||null;
      if(reply)console.log('[groq raw]',reply);
      return reply;
    }
    return null;
  }catch(e){console.error('[groq]',e);return null;}
}
function parseNav(text){
  if(!text)return{clean:text,sectionId:null};
  const m=text.match(/\[?\{?NAVIGATE:([a-z0-9_-]+)\}?\]?/i);
  const clean=text.replace(/\[?\{?NAVIGATE:[^\]\}]*\}?\]?/gi,'').replace(/\s{2,}/g,' ').trim();
  return{clean,sectionId:m?m[1].toLowerCase():null};
}
function parseMD(str){
  if(!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/^### (.*$)/gim, '<h3 style="margin-top:10px;margin-bottom:4px;color:var(--text);font-size:14px">$1</h3>')
    .replace(/^## (.*$)/gim, '<h2 style="margin-top:12px;margin-bottom:6px;color:var(--text);font-size:16px">$1</h2>')
    .replace(/^# (.*$)/gim, '<h1 style="margin-top:14px;margin-bottom:8px;color:var(--text);font-size:19px">$1</h1>')
    .replace(/\*\*(.*)\*\*/gim, '<b style="color:var(--text)">$1</b>')
    .replace(/\*(.*)\*/gim, '<i>$1</i>')
    .replace(/^- (.*$)/gim, '<li style="margin-left:20px;margin-bottom:4px;list-style-type:disc">$1</li>')
    .replace(/\n/gim, '<br>');
}
function toNum(s){return parseFloat(String(s).replace(/[^0-9.\-]/g,''));}
function parseActions(text){
  if(!text)return{clean:text,actions:[]};
  const actions=[];
  const clean=text
    .replace(/\[SET_BALANCE:(bank|savings|trading):([^\]]+)\]/gi,(_,f,v)=>{actions.push({type:'set_balance',field:f.toLowerCase(),amount:toNum(v)});return'';})
    .replace(/\[ADD_BALANCE:(bank|savings|trading):([^\]]+)\]/gi,(_,f,v)=>{actions.push({type:'add_balance',field:f.toLowerCase(),amount:toNum(v)});return'';})
    .replace(/\[UPDATE_YT:(subs|views|hours):([^\]]+)\]/gi,(_,f,v)=>{actions.push({type:'update_yt',field:f.toLowerCase(),amount:toNum(v)});return'';})
    .replace(/\[SET_EXAM_DATE:([^\]]+)\]/gi,(_,v)=>{actions.push({type:'set_exam_date',val:v.trim()});return'';})
    .replace(/\[ADD_TODO:([^\]]+)\]/gi,(_,v)=>{actions.push({type:'add_todo',val:v.trim()});return'';})
    .replace(/\[ADD_HABIT:([^\]]+)\]/gi,(_,v)=>{actions.push({type:'add_habit',val:v.trim()});return'';})
    .replace(/\[ADD_GOAL:([^\]]+)\]/gi,(_,v)=>{const[t,c]=(v+'|general').split('|');actions.push({type:'add_goal',val:t.trim(),cat:(c||'general').trim()});return'';})
    .replace(/\[COMPLETE_HABIT:([^\]]+)\]/gi,(_,v)=>{actions.push({type:'complete_habit',val:v.trim().toLowerCase()});return'';})
    .replace(/\[ADD_SHIFT:([^:]+):([^:]+):([^\]]+)\]/gi,(_,d,h,w)=>{actions.push({type:'add_shift',date:d.trim(),hours:parseFloat(h)||0,wage:parseFloat(w)||0});return'';})
    .replace(/\[ADD_TRIP:([^:]+):([^:]+):([^\]]+)\]/gi,(_,dest,date,budget)=>{actions.push({type:'add_trip',dest:dest.trim(),date:date.trim(),budget:parseFloat(budget)||0});return'';})
    .replace(/\[SET_FOCUS:([^\]]+)\]/gi,(_,v)=>{actions.push({type:'set_focus',val:v.trim()});return'';})
    .replace(/\[LOG_SLEEP:([^:]+):([^:]+):([^:]+):([^\]]+)\]/gi,(_,bh,bm,wh,wm)=>{actions.push({type:'log_sleep',bed:`${bh.trim().padStart(2,'0')}:${bm.trim().padStart(2,'0')}`,wake:`${wh.trim().padStart(2,'0')}:${wm.trim().padStart(2,'0')}`});return'';})
    .replace(/\[COMPLETE_GOAL:([^\]]+)\]/gi,(_,v)=>{actions.push({type:'complete_goal',val:v.trim().toLowerCase()});return'';})
    .replace(/\[DELETE_TODO:([^\]]+)\]/gi,(_,v)=>{actions.push({type:'delete_todo',val:v.trim().toLowerCase()});return'';})
    .replace(/\[ADD_SUBSCRIPTION:([^:]+):([^:]+):([^\]]+)\]/gi,(_,name,amount,day)=>{actions.push({type:'add_subscription',name:name.trim(),amount:parseFloat(amount)||0,day:parseInt(day)||1});return'';})
    .replace(/\[REMOVE_HABIT:([^\]]+)\]/gi,(_,v)=>{actions.push({type:'remove_habit',val:v.trim().toLowerCase()});return'';})
    .replace(/\[SET_YT_CHANNEL:([^\]]+)\]/gi,(_,v)=>{actions.push({type:'set_yt_channel',val:v.trim()});return'';})
    .replace(/\[ADD_EVENT:([^:]+):([^:]+):?([^\]]*)\]/gi,(_,d,n,t)=>{actions.push({type:'add_event',day:d.trim(),name:n.trim(),etype:(t||'').trim().toLowerCase()});return'';})
    .replace(/\[REMOVE_EVENT:([^:]+):([^\]]+)\]/gi,(_,d,n)=>{actions.push({type:'remove_event',day:d.trim(),name:n.trim().toLowerCase()});return'';})
    .replace(/\s{2,}/g,' ').trim();
  if(actions.length)console.log('[actions] parsed:',actions);
  return{clean,actions};
}
function executeActions(actions){
  if(!actions.length)return;
  let changed=false;
  actions.forEach(a=>{
    if(a.type==='set_balance'&&!isNaN(a.amount)){st.balances[a.field]=a.amount;changed=true;console.log('[actions] set_balance',a.field,'=',a.amount);}
    else if(a.type==='add_balance'&&!isNaN(a.amount)){st.balances[a.field]=(st.balances[a.field]||0)+a.amount;changed=true;console.log('[actions] add_balance',a.field,'+',a.amount);}
    else if(a.type==='update_yt'&&!isNaN(a.amount)){st.yt[a.field]=a.amount;changed=true;console.log('[actions] update_yt',a.field,'=',a.amount);}
    else if(a.type==='set_exam_date'){st.examDate=sanitizeText(a.val,50);changed=true;console.log('[actions] set_exam_date',a.val);}
    else if(a.type==='add_todo'){st.genTodos.push({text:sanitizeText(a.val,200),done:false});changed=true;}
    else if(a.type==='add_habit'){st.habits.push({label:sanitizeText(a.val,100),done:false});changed=true;}
    else if(a.type==='add_goal'){st.goals.push({text:sanitizeText(a.val,150),category:sanitizeText(a.cat,20),done:false});changed=true;}
    else if(a.type==='complete_habit'){
      const wasAllDone=st.habits.length>0&&st.habits.every(x=>x.done);
      const h=st.habits.find(x=>x.label.toLowerCase().includes(a.val));
      if(h){h.done=true;changed=true;if(!wasAllDone&&st.habits.every(x=>x.done))fireConfetti();}
    }
    else if(a.type==='add_shift'&&a.hours>0){st.shifts.unshift({date:sanitizeText(a.date,50),hours:a.hours,wage:a.wage||st.defaultWage});changed=true;}
    else if(a.type==='add_trip'){st.trips.push({dest:sanitizeText(a.dest,100),date:sanitizeText(a.date,20),budget:a.budget,done:false});changed=true;}
    else if(a.type==='set_focus'){st.todayFocus=a.val;changed=true;}
    else if(a.type==='log_sleep'){const today=localDateStr(new Date());const existing=st.sleep?.logs?.findIndex(l=>l.date===today)??-1;const entry={date:today,bed:a.bed,wake:a.wake,note:'via AI'};if(existing>=0)st.sleep.logs[existing]=entry;else st.sleep.logs.push(entry);changed=true;}
    else if(a.type==='complete_goal'){const g=st.goals.find(x=>!x.done&&x.text.toLowerCase().includes(a.val));if(g){g.done=true;changed=true;}}
    else if(a.type==='delete_todo'){const before=st.genTodos.length;st.genTodos=st.genTodos.filter(t=>!t.text.toLowerCase().includes(a.val));if(st.genTodos.length!==before)changed=true;}
    else if(a.type==='add_subscription'&&a.amount>0){if(!st.subscriptions)st.subscriptions=[];st.subscriptions.push({name:sanitizeText(a.name,50),amount:a.amount,date:a.day});changed=true;}
    else if(a.type==='remove_habit'){const before=st.habits.length;st.habits=st.habits.filter(h=>!h.label.toLowerCase().includes(a.val));if(st.habits.length!==before)changed=true;}
    else if(a.type==='set_yt_channel'){st.yt.channelName=a.val;changed=true;}
    else if(a.type==='add_event'){
      const di=dayIndexOf(a.day);
      if(di>=0){
        initSchedEvents();
        const c=['uni','work','stream'].includes(a.etype)?a.etype:'';
        st.scheduleEvents[di].push({t:sanitizeText(a.name,80),c});
        changed=true;console.log('[actions] add_event',a.day,a.name);
      }
    }
    else if(a.type==='remove_event'){
      const di=dayIndexOf(a.day);
      if(di>=0&&st.scheduleEvents?.[di]){
        const before=st.scheduleEvents[di].length;
        st.scheduleEvents[di]=st.scheduleEvents[di].filter(e=>!e.t.toLowerCase().includes(a.name));
        if(st.scheduleEvents[di].length!==before){changed=true;console.log('[actions] remove_event',a.day,a.name);}
      }
    }
  });
  if(changed){
    save();
    const ap=document.querySelector('.page.active')?.id?.replace('page-','');
    if(ap==='habits')rHabits();
    if(ap==='goals')rGoals();
    if(ap==='finance')rFinance();
    if(ap==='youtube')rYT();
    if(ap==='todos')rMasterTodos();
    if(ap==='schedule')rSchedule();
    if(ap==='home')renderHomeGamification();
    try{updateLiveStats();}catch(e){}
  }
}
async function loadAISug(){
  const el=document.getElementById('ai-sug');if(!el)return;
  if(!(getGroqKey())){el.textContent='AI features require a Groq API key (add it in Settings).';return;}
  el.textContent='Thinking...';
  const r=await callGroq([{role:'user',content:'Give me one specific actionable suggestion for today based on my data. 2 sentences max.'}]);
  if(!r){if(el)el.textContent='Could not load suggestion.';return;}
  const cleaned = parseActions(parseNav(r).clean).clean;
  if(el)el.textContent=cleaned;
}
async function homeAI(){
  const inp=document.getElementById('ai-in');const msg=inp.value.trim();if(!msg)return;inp.value='';
  const el=document.getElementById('ai-sug');if(!el)return;
  if(!(getGroqKey())){el.textContent='AI features require a Groq API key (add it in Settings).';return;}
  el.textContent='Thinking...';
  const r=await callGroq([{role:'user',content:msg}]);
  if(!r){if(el)el.textContent='Could not get a response.';return;}
  const {clean: r1, sectionId} = parseNav(r);
  const {clean, actions} = parseActions(r1);
  executeActions(actions);
  if(el){el.textContent=clean;el.style.display=clean?'':'none';}
  if(sectionId&&actions.length===0)setTimeout(()=>goPage(sectionId),400);
}
function fmtTs(ts){
  if(!ts)return'';
  const d=new Date(ts),now=new Date();
  const time=d.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});
  if(d.toDateString()===now.toDateString())return time;
  const yest=new Date(now);yest.setDate(now.getDate()-1);
  if(d.toDateString()===yest.toDateString())return'Yesterday '+time;
  return d.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'})+' '+time;
}
function msgBubble(m){
  const role=m.role==='user'?'user':'ai';
  const txt=(m.content||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const ts=fmtTs(m.ts);
  return`<div class="ai-msg ${role}"><div class="ai-bubble">${txt}</div>${ts?`<div class="ai-ts">${ts}</div>`:''}</div>`;
}
function rAI(){
  const msgs=document.getElementById('chat-msgs');if(!msgs)return;
  if(!st.chatHistory.length){
    msgs.innerHTML=`<div class="ai-msg ai"><div class="ai-bubble">Hey ${st.userName}! I know your finances, YouTube goals, uni situation, and more. Ask me anything or tell me to update your data.</div></div>`;
  }else{
    msgs.innerHTML=st.chatHistory.map(msgBubble).join('');
  }
  msgs.scrollTop=msgs.scrollHeight;
  // Contextual prompt chips
  const chips=document.getElementById('ai-chip-list');
  if(chips){
    const prompts=[
      'How is the Chuck Bird bot doing?',
      st.balances.bank>0?`My bank balance is now ${fmt(st.balances.bank+100)}`:'Set my bank balance to £1,500',
      st.yt.subs>0?`I just hit ${st.yt.subs+50} subscribers`:'I hit 500 subscribers today',
      `Add a todo to ${['review my notes','check my goals','update my budget'][new Date().getDay()%3]}`,
      st.focusAreas.includes('youtube')?'How close am I to YouTube monetisation?':'What should I focus on today?',
      `What should I focus on today?`,
      st.examDate&&st.examDate!=='TBC'?`How long until my exam on ${st.examDate}?`:'Set my exam date to 15 June',
    ].slice(0,5);
    chips.innerHTML=prompts.map(s=>`<div class="prompt-item" data-prompt="${s.replace(/"/g,'&quot;')}" onclick="const i=document.getElementById('chat-in');i.value=this.dataset.prompt;i.focus()">${s}</div>`).join('');
  }
}
async function sendChat(){
  const inp=document.getElementById('chat-in');const msg=inp.value.trim();if(!msg)return;inp.value='';
  if(!(getGroqKey())){addMsg('assistant','Please add your Groq API key in the Settings page to enable AI features.');return;}
  addMsg('user',msg);
  const msgs=document.getElementById('chat-msgs');
  const t=document.createElement('div');t.className='ai-msg ai';t.id='chat-typing';
  t.innerHTML='<div class="ai-bubble typing"><span></span><span></span><span></span></div>';
  msgs.appendChild(t);msgs.scrollTop=99999;
  const hist=st.chatHistory.slice(-40).map(m=>({role:m.role==='user'?'user':'assistant',content:m.content}));
  const r=await callGroq(hist);
  document.getElementById('chat-typing')?.remove();
  const{clean:r1,sectionId}=parseNav(r||'Sorry, could not get a response.');
  const{clean:reply,actions}=parseActions(r1);
  executeActions(actions);
  addMsg('assistant',reply);
  if(sectionId)setTimeout(()=>goPage(sectionId),400);
}
function addMsg(role,content){
  st.chatHistory.push({role,content,ts:Date.now()});save();
  const msgs=document.getElementById('chat-msgs');if(!msgs)return;
  const el=document.createElement('div');
  el.innerHTML=msgBubble({role,content,ts:Date.now()});
  msgs.appendChild(el.firstChild);msgs.scrollTop=msgs.scrollHeight;
}
function clearChat(){
  st.chatHistory=[];save();rAI();
}

async function setLaunchOnStartup(enabled){
  if(!window.electronAPI?.setLoginItemSettings)return;
  const r=await window.electronAPI.setLoginItemSettings(enabled);
  if(r?.ok)toast(enabled?'Launch on startup enabled':'Launch on startup disabled');
  else{
    toast('Could not update startup setting');
    const t=document.getElementById('startup-toggle');if(t)t.checked=!enabled;
  }
}

// ═══ SETTINGS ═══
function rSettings(){
  const ni=document.getElementById('name-in');if(ni)ni.value=st.userName||'';
  const wi=document.getElementById('wage-in');if(wi)wi.value=st.defaultWage||10;
  const fxt=document.getElementById('fx-toggle');if(fxt)fxt.checked=st.fxEnabled!==false;
  const st_=document.getElementById('startup-toggle');
  if(st_&&window.electronAPI?.getLoginItemSettings){
    window.electronAPI.getLoginItemSettings().then(r=>{st_.checked=!!r?.openAtLogin;}).catch(()=>{});
  }
  const sw=document.getElementById('accent-swatches');
  if(sw){
    const cols=['#e8eaf0','#8b5cf6','#22d3ee','#2ecc8a','#f0a832','#f05090'];
    sw.innerHTML=cols.map(c=>`<div class="settings-swatch" style="width:34px;height:34px;border-radius:50%;background:${c};cursor:pointer;border:2.5px solid ${c===st.accentColor?'#fff':'transparent'};box-shadow:${c===st.accentColor?'0 0 0 3px rgba(255,255,255,0.18)':'none'};transition:all 0.18s;flex-shrink:0" onclick="applyColor('${c}');document.querySelectorAll('.settings-swatch').forEach(s=>{s.style.borderColor='transparent';s.style.boxShadow='none'});this.style.borderColor='#fff';this.style.boxShadow='0 0 0 3px rgba(255,255,255,0.18)'" title="${c}"></div>`).join('');
  }
  let devPanel = '';
  if(st.userName === 'Daniel' || st.userName === 'Daniel6767') {
    devPanel = `<div class="si"><div class="sl" style="color:var(--accent)">Developer API Keys (Daniel Only)</div><div class="ss">Securely saved on your machine. Never uploaded to GitHub.</div>
      <input type="password" id="dev-t212" placeholder="Trading 212 API Key" value="${st.apiKeys.t212||''}" style="margin-top:6px">
      <input type="text" id="dev-yt-chan" placeholder="YouTube Channel ID" value="${st.apiKeys.ytChannelId||''}" style="margin-top:6px">
      <input type="password" id="dev-yt-api" placeholder="YouTube API Key" value="${st.apiKeys.ytApi||''}" style="margin-top:6px">
      <input type="password" id="dev-yt-id" placeholder="YouTube Client ID" value="${st.apiKeys.ytClientId||''}" style="margin-top:6px">
      <input type="password" id="dev-yt-sec" placeholder="YouTube Client Secret" value="${st.apiKeys.ytClientSecret||''}" style="margin-top:6px">
      <button class="btn btn-p btn-sm" style="margin-top:8px" onclick="saveDevKeys()">Save Developer Keys</button></div>`;
  }
  const ns=document.getElementById('notif-settings');
  if(ns){
    const row=(id,label,toggleKey,timeKey)=>`<div class="notif-row"><div class="notif-label">${label}</div><input type="time" id="${id}-time" class="notif-time" value="${st.notifSettings[timeKey]}"><label class="toggle"><input type="checkbox" id="${id}-toggle" ${st.notifSettings[toggleKey]?'checked':''}><span class="toggle-slider"></span></label></div>`;
    const rowNoTime=(id,label,toggleKey)=>`<div class="notif-row"><div class="notif-label">${label}</div><label class="toggle"><input type="checkbox" id="${id}-toggle" ${st.notifSettings[toggleKey]?'checked':''}><span class="toggle-slider"></span></label></div>`;
    ns.innerHTML=
      row('notif-bed','🌙 Bedtime reminder','bedReminder','bedReminderTime')+
      row('notif-morning','☀️ Morning brief','morningBrief','morningBriefTime')+
      row('notif-habit','✅ Habit check-in','habitReminder','habitReminderTime')+
      row('notif-nudge','💡 AI nudge (needs AI key)','aiNudge','aiNudgeTime')+
      rowNoTime('notif-quest-reset','🔄 Daily quest reset','questReset')+
      `<div style="display:flex;gap:8px;margin-top:10px"><button class="btn btn-p btn-sm" onclick="saveNotifSettings()">Save notification settings</button><button class="btn btn-sm" onclick="testNotif()">Send test</button></div>`;
    document.getElementById('set-inj').innerHTML = `<div class="si"><div class="sl">Groq API key</div><div class="ss">Powers all AI features. Get a free key at console.groq.com</div><input type="password" id="groq-key-in" placeholder="gsk_..." value="${st.apiKeys.groq||''}" style="margin-top:8px"><button class="btn btn-p btn-sm" style="margin-top:8px" onclick="saveGroqKey()">Save</button></div>${devPanel}`;
  }
  const pf=document.getElementById('pom-f-in');if(pf)pf.value=st.pomodoro.focus||25;
  const pb=document.getElementById('pom-b-in');if(pb)pb.value=st.pomodoro.break||5;
}
function saveGroqKey(){
  const v=sanitizeText(document.getElementById('groq-key-in').value,200).trim();
  if(!v||v.length<10){toast('Enter a valid API key');return;}
  st.apiKeys.groq=v;save();
  toast('Groq API key saved');
}
function savePomSettings(){
  st.pomodoro.focus = validateNumber(parseInt(document.getElementById('pom-f-in').value)||25, 1, 180);
  st.pomodoro.break = validateNumber(parseInt(document.getElementById('pom-b-in').value)||5, 1, 60);
  save();
  if(!pomR){ 
    pomL = pomM==='focus'?st.pomodoro.focus*60:st.pomodoro.break*60;
    updatePom();
  }
  toast('Timer settings saved');
}
function saveDevKeys() {
  st.apiKeys.t212 = sanitizeText(document.getElementById('dev-t212').value,200).trim();
  st.apiKeys.ytChannelId = sanitizeText(document.getElementById('dev-yt-chan').value,100).trim();
  st.apiKeys.ytApi = sanitizeText(document.getElementById('dev-yt-api').value,200).trim();
  st.apiKeys.ytClientId = sanitizeText(document.getElementById('dev-yt-id').value,200).trim();
  st.apiKeys.ytClientSecret = sanitizeText(document.getElementById('dev-yt-sec').value,200).trim();
  save(); toast('Developer keys saved!');
  if(st.apiKeys.ytChannelId) fetchYTData();
}
async function exportData(){
  const localStorageData={};
  for(let i=0;i<localStorage.length;i++){
    const k=localStorage.key(i);if(k.startsWith('sb4_'))localStorageData[k]=localStorage.getItem(k);
  }
  let game=null;
  if(window.sychboard?.data?.exportGame){
    try{
      const r=await window.sychboard.data.exportGame();
      if(r?.ok)game=r.data;
      else toast('Warning: game progress (XP/streaks/badges) could not be included');
    }catch(e){toast('Warning: game progress (XP/streaks/badges) could not be included');}
  }
  const payload={sychboard_backup:true,version:1,exported_at:new Date().toISOString(),localStorage:localStorageData,game};
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download=`sychboard-backup-${new Date().toISOString().slice(0,10)}.json`;
  a.click();URL.revokeObjectURL(url);toast('Backup exported!');
}
function triggerImportData(){
  document.getElementById('import-file-input')?.click();
}
async function handleImportFile(input){
  const file=input.files?.[0];input.value='';
  if(!file)return;
  let payload;
  try{
    const text=await file.text();
    payload=JSON.parse(text);
  }catch(e){toast('Import failed: not a valid backup file');return;}
  if(!payload||typeof payload!=='object'||!payload.sychboard_backup||typeof payload.localStorage!=='object'){
    toast('Import failed: not a SychBoard backup file');return;
  }
  showConfirm('Restore this backup?','This overwrites all current data (finance, habits, journal, XP/streaks/badges, everything) with the backup\'s contents. Cannot be undone.',async()=>{
    try{
      for(const k of Object.keys(localStorage)){if(k.startsWith('sb4_'))localStorage.removeItem(k);}
      for(const [k,v] of Object.entries(payload.localStorage)){if(k.startsWith('sb4_'))localStorage.setItem(k,v);}
      if(payload.game&&window.sychboard?.data?.importGame){
        const r=await window.sychboard.data.importGame(payload.game);
        if(!r?.ok){toast('Restored local data, but game progress import failed: '+(r?.error||'unknown error'));setTimeout(()=>location.reload(),2000);return;}
      }
      toast('Backup restored — reloading…');
      setTimeout(()=>location.reload(),1200);
    }catch(e){toast('Import failed: '+e.message);}
  });
}

// ═══ FINANCE ═══
let t212Cache=null;
async function fetchT212Portfolio(){
  const body=document.getElementById('t212-body');
  if(!window.electronAPI?.fetchT212){
    if(body)body.innerHTML='<div class="empty" style="font-size:12px;color:var(--text3)">Live portfolio requires the desktop app</div>';
    return;
  }
  if(t212Cache&&!t212Cache.error&&Date.now()-t212Cache.fetchedAt<5*60*1000){renderT212Holdings();return;}
  const btn=document.getElementById('t212-btn');
  if(btn){btn.textContent='…';btn.disabled=true;}
  if(body)body.innerHTML='<div class="empty" style="font-size:12px;color:var(--text3)">Fetching portfolio…</div>';
  let pr,cr;
  try{[pr,cr]=await Promise.all([window.electronAPI.fetchT212('/equity/portfolio', st.apiKeys.t212),window.electronAPI.fetchT212('/equity/account/cash', st.apiKeys.t212)]);}
  catch(e){pr={error:e.message};cr={};}
  if(pr.error||cr.error){
    t212Cache={error:pr.error||cr.error,fetchedAt:Date.now()};
  }else if(pr.status===401||cr.status===401){
    t212Cache={error:'Invalid API key — check your Trading 212 key in Settings',fetchedAt:Date.now()};
  }else if(pr.status===429||cr.status===429){
    t212Cache={error:'Rate limited — wait a moment and try again',fetchedAt:Date.now()};
  }else{
    t212Cache={positions:Array.isArray(pr.data)?pr.data:[],cash:cr.data||{},fetchedAt:Date.now()};
  }
  if(btn){btn.textContent='↻ Refresh';btn.disabled=false;}
  renderT212Holdings();
}
function t212Sym(ticker){return String(ticker).split('_')[0].replace(/^\d+/,'');}
function renderT212Holdings(){
  const body=document.getElementById('t212-body');
  const ts=document.getElementById('t212-ts');
  if(!body)return;
  if(!t212Cache){body.innerHTML='<div class="empty" style="font-size:12px;color:var(--text3)">Press Refresh to load your portfolio</div>';return;}
  if(ts&&t212Cache.fetchedAt){const d=new Date(t212Cache.fetchedAt);ts.textContent=d.getHours().toString().padStart(2,'0')+':'+d.getMinutes().toString().padStart(2,'0');}
  if(t212Cache.error){body.innerHTML=`<div style="color:var(--red);font-size:12px;padding:4px 0">${t212Cache.error}</div>`;return;}
  const{positions,cash}=t212Cache;
  const ppl=cash.ppl||0,total=cash.total||0,free=cash.free||0,invested=cash.invested||0;
  const pplPct=invested>0?ppl/invested*100:0;
  const pplCol=ppl>=0?'var(--green)':'var(--red)';
  const sorted=[...positions].sort((a,b)=>((b.currentPrice||0)*(b.quantity||0))-((a.currentPrice||0)*(a.quantity||0)));
  body.innerHTML=`
    <div class="mr2" style="margin-bottom:14px">
      <div class="metric"><div class="ml">Total value</div><div class="mv">${fmt(total)}</div></div>
      <div class="metric"><div class="ml">Total return</div><div class="mv" style="color:${pplCol};font-size:15px">${ppl>=0?'+':''}${fmt(ppl)}<br><span style="font-size:11px;font-weight:500">${pplPct>=0?'+':''}${pplPct.toFixed(1)}%</span></div></div>
      <div class="metric"><div class="ml">Invested</div><div class="mv" style="font-size:15px">${fmt(invested)}</div></div>
      <div class="metric"><div class="ml">Free cash</div><div class="mv blue" style="font-size:15px">${fmt(free)}</div></div>
    </div>
    ${sorted.length===0?'<div class="empty">No open positions</div>':`
    <div class="t212-hl">Holdings (${sorted.length})</div>
    ${sorted.map(p=>{
      const sym=t212Sym(p.ticker);
      const val=(p.currentPrice||0)*(p.quantity||0);
      const pct=p.averagePrice>0?(p.currentPrice-p.averagePrice)/p.averagePrice*100:0;
      const col=(p.ppl||0)>=0?'var(--green)':'var(--red)';
      const qty=p.quantity%1===0?p.quantity:p.quantity.toFixed(4);
      return`<div class="t212-pos">
        <div class="t212-sym">${sym}</div>
        <div class="t212-qty">${qty} shares<br>${fmt(p.averagePrice||0)} avg → ${fmt(p.currentPrice||0)}</div>
        <div class="t212-right">
          <div class="t212-val">${fmt(val)}</div>
          <div class="t212-pnl" style="color:${col}">${(p.ppl||0)>=0?'+':''}${fmt(p.ppl||0)} (${pct>=0?'+':''}${pct.toFixed(1)}%)</div>
        </div>
      </div>`;
    }).join('')}`}`;
}
function t212Context(){
  if(!t212Cache||t212Cache.error||!t212Cache.positions)return'';
  const{positions,cash}=t212Cache;
  const pct=cash.invested>0?(cash.ppl/cash.invested*100).toFixed(1):'0';
  const s=cash.ppl>=0?'+':'';
  let ctx=`Trading 212 portfolio: total ${fmt(cash.total||0)}, invested ${fmt(cash.invested||0)}, P&L ${s}${fmt(cash.ppl||0)} (${s}${pct}%), free cash ${fmt(cash.free||0)}.`;
  if(positions.length){
    ctx+=' Holdings: '+positions.slice(0,12).map(p=>{
      const pct2=p.averagePrice>0?((p.currentPrice-p.averagePrice)/p.averagePrice*100).toFixed(1):'0';
      return`${t212Sym(p.ticker)} ${p.quantity}@${fmt(p.currentPrice||0)}(${pct2>=0?'+':''}${pct2}%)`;
    }).join(', ')+(positions.length>12?' …':'');
  }
  return' '+ctx;
}
function ytApiContext(){
  const hasVids=st.yt.apiVideos?.length>0;
  const hasAnalytics=st.yt.impressions28d>0;
  if(!hasVids&&!hasAnalytics)return'';
  let ctx='';
  if(hasVids){
    const top=st.yt.apiVideos.slice(0,3).map(v=>`"${v.title}" (${fmtK(v.views)}v, ${fmtK(v.likes)}L, ${fmtK(v.comments)}C)`).join('; ');
    ctx+=` Recent videos: ${top}. Total: ${st.yt.videoCount||'?'} videos.`;
  }
  if(hasAnalytics){
    ctx+=` Last 28 days: ${fmtK(st.yt.impressions28d)} impressions, ${(st.yt.ctr28d*100).toFixed(1)}% CTR, ${fmtK(Math.round(st.yt.watchMins28d/60))} watch hours.`;
  }
  return ctx;
}
function rFinance(){
  const t=st.balances.bank+st.balances.savings+st.balances.trading;
  document.getElementById('fm1').innerHTML=`<div class="metric"><div class="ml">Total</div><div class="mv">${fmt(t)}</div></div><div class="metric"><div class="ml">Bank</div><div class="mv blue">${fmt(st.balances.bank)}</div></div>`;
  document.getElementById('fm2').innerHTML=`<div class="metric"><div class="ml">Savings</div><div class="mv green">${fmt(st.balances.savings)}</div></div><div class="metric"><div class="ml">Other</div><div class="mv green">${fmt(st.balances.trading)}</div></div>`;
  [0,1].forEach(i=>{
    const h=st.holidays[i];if(!h)return;
    const pct=h.target>0?Math.min(100,Math.round(h.saved/h.target*100)):0;
    const ti=document.getElementById(i===0?'h1-title':'h2-title');
    const di=document.getElementById(i===0?'h1-detail':'h2-detail');
    if(ti)ti.textContent=h.name+(h.date?' — '+h.date:'');
    if(di)di.innerHTML=`<div class="row"><span class="rl">Target</span><span class="rv">${fmt(h.target)}</span></div><div class="row"><span class="rl">Saved</span><span class="rv" style="color:var(--green)">${fmt(h.saved)}</span></div><div class="row"><span class="rl">Still needed</span><span class="rv">${fmt(Math.max(0,h.target-h.saved))}</span></div><div class="pb"><div class="pf g" style="width:${pct}%"></div></div><div style="font-size:10px;color:var(--text2);text-align:right;margin-bottom:10px">${pct}% saved</div><div class="ir2" style="gap:8px;margin-bottom:8px"><div><div class="fl">Name</div><input type="text" id="hn-${i}" value="${h.name}" placeholder="Holiday name"></div><div><div class="fl">Date</div><input type="text" id="hd-${i}" value="${h.date}" placeholder="August"></div></div><div class="ir2" style="gap:8px"><div><div class="fl">Target (£)</div><input type="number" id="ht-${i}" value="${h.target}" placeholder="£"></div><div><div class="fl">Saved (£)</div><input type="number" id="hs-${i}" value="${h.saved}" placeholder="£"></div></div><button class="btn btn-p btn-sm btn-full" style="margin-top:8px" onclick="updHol(${i})">Update</button>`;
  });
  rShifts();rSecTodos('finance');
  renderT212Holdings();
  if(!t212Cache||t212Cache.error||Date.now()-t212Cache.fetchedAt>5*60*1000)fetchT212Portfolio();
}
function updHol(i){
  const rawName=document.getElementById('hn-'+i).value;
  st.holidays[i]={name:rawName?sanitizeText(rawName,40).trim():st.holidays[i].name,date:sanitizeText(document.getElementById('hd-'+i).value,30).trim(),target:validateNumber(document.getElementById('ht-'+i).value,0,9999999),saved:validateNumber(document.getElementById('hs-'+i).value,0,9999999)};
  save();rFinance();
}
function updateBal(){
  const k=document.getElementById('bal-sel').value;
  const v=validateNumber(document.getElementById('bal-amt').value,0,9999999);
  if(v===0&&!document.getElementById('bal-amt').value.trim()){toast('Enter a valid balance');return;}
  st.balances[k]=v;
  document.getElementById('bal-amt').value='';
  save();rFinance();toast('Balance updated');
}
function rShifts(){
  const el=document.getElementById('shift-list');if(!el)return;
  if(!st.shifts.length){el.innerHTML=emptyState('💼','No shifts logged yet','Add your first shift above');document.getElementById('shift-totals').innerHTML='';return;}
  el.innerHTML=st.shifts.map((s,i)=>`<div class="shi"><span style="font-weight:600">${s.date}</span><span style="color:var(--text2)">${s.hours}h @ ${fmt(s.wage)}/hr</span><span style="color:var(--green);font-weight:700">${fmt(s.hours*s.wage)}</span><button class="btn btn-sm" style="color:var(--red);border-color:var(--red);background:var(--red-light)" onclick="rmShift(${i})">✕</button></div>`).join('');
  const all=st.shifts.reduce((a,s)=>a+s.hours*s.wage,0);
  const now=new Date();const ms=new Date(now.getFullYear(),now.getMonth(),1);const me=new Date(now.getFullYear(),now.getMonth()+1,1);
  const mon=st.shifts.filter(s=>{const sd=new Date(s.date+' '+now.getFullYear());return sd>=ms&&sd<me;}).reduce((a,s)=>a+s.hours*s.wage,0);
  document.getElementById('shift-totals').innerHTML=`<div class="metric"><div class="ml">All time</div><div class="mv">${fmt(all)}</div></div><div class="metric"><div class="ml">This month</div><div class="mv green">${fmt(mon)}</div></div>`;
}
function addShift(){
  const d=sanitizeText(document.getElementById('sh-d').value,50).trim();
  const h=validateNumber(document.getElementById('sh-h').value,0,24);
  const w=validateNumber(document.getElementById('sh-w').value,0,100)||st.defaultWage;
  if(!d||!h){toast('Date and hours required');return;}
  st.shifts.unshift({date:d,hours:h,wage:w});
  document.getElementById('sh-d').value='';
  document.getElementById('sh-h').value='';
  save();rShifts();toast('Shift added');
}
function rmShift(i){st.shifts.splice(i,1);save();rShifts();}

function rSubs(){
  const el=document.getElementById('subs-list');if(!el)return;
  el.innerHTML=st.subscriptions.length?st.subscriptions.map((s,i)=>`<div class="row"><span class="rl" style="font-weight:600">${s.name} <span style="font-size:10px;color:var(--text3);font-weight:500;margin-left:4px">Day ${s.date}</span></span><div style="display:flex;align-items:center;gap:12px"><span class="rv">${fmt(s.amount)}</span><button class="del-btn" style="margin:0" onclick="st.subscriptions.splice(${i},1);save();rSubs()">✕</button></div></div>`).join(''):emptyState('💳','No bills tracked yet');
}
function addSub(){
  const n=sanitizeText(document.getElementById('sub-name').value,50).trim();
  const a=validateNumber(document.getElementById('sub-amt').value,0.01,99999);
  const d=validateNumber(document.getElementById('sub-day').value,1,31);
  if(!n||!a||!d){toast('Name, amount, and day required');return;}
  st.subscriptions.push({name:n,amount:a,date:d});
  document.getElementById('sub-name').value='';
  document.getElementById('sub-amt').value='';
  document.getElementById('sub-day').value='';
  save();rSubs();toast('Subscription added');
}

// ═══ UNI ═══
function rUni(){
  const ed=document.getElementById('exam-date-disp');if(ed)ed.textContent=st.examDate;
  const disp=document.getElementById('uni-notes-display');
  const edit=document.getElementById('uni-notes-edit');
  const un=document.getElementById('uni-notes');
  if(un)un.value=st.uniNotes||'';
  if(disp){disp.innerHTML=st.uniNotes?parseMD(st.uniNotes):emptyState('📝','Click to add notes...');disp.style.display='block';}
  if(edit)edit.style.display='none';
  rSecTodos('uni');
}
function updateExamDate(){st.examDate=sanitizeText(document.getElementById('exam-in').value,50)||'TBC';save();rUni();toast('Exam date saved');}
function saveUniNotes(){st.uniNotes=document.getElementById('uni-notes').value;save();rUni();toast('Notes saved');}

// ═══ YOUTUBE ═══
function rYT(){
  const ct=document.getElementById('yt-chan-title');if(ct)ct.textContent=st.yt.channelName||'Channel stats';
  document.getElementById('yt-m1').innerHTML=`<div class="metric"><div class="ml">Subscribers</div><div class="mv">${fmtK(st.yt.subs)}</div></div><div class="metric"><div class="ml">Total views</div><div class="mv blue">${fmtK(st.yt.views)}</div></div>`;
  document.getElementById('yt-m2').innerHTML=`<div class="metric"><div class="ml">Watch hours</div><div class="mv">${fmtK(st.yt.hours)}</div></div><div class="metric"><div class="ml">Videos</div><div class="mv green">${st.yt.videoCount||satDays()+'d'}</div></div>`;
  const sp=Math.min(100,Math.round(st.yt.subs/1000*100));
  const hp=Math.min(100,Math.round(st.yt.hours/4000*100));
  document.getElementById('yt-goals').innerHTML=`<div style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px"><span style="color:var(--text2)">Subscribers</span><span style="font-weight:700">${st.yt.subs}/1,000</span></div><div class="pb"><div class="pf" style="width:${sp}%"></div></div></div><div><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px"><span style="color:var(--text2)">Watch hours</span><span style="font-weight:700">${st.yt.hours}/4,000</span></div><div class="pb"><div class="pf" style="width:${hp}%"></div></div></div>`;
  const ab=document.getElementById('yt-analytics-body');
  if(ab){
    const isConnected=!!st.apiKeys.ytRefreshToken;
    if(st.yt.impressions28d>0){
      ab.innerHTML=`<div class="mr2" style="margin-bottom:8px"><div class="metric"><div class="ml">Impressions (28d)</div><div class="mv">${fmtK(st.yt.impressions28d)}</div></div><div class="metric"><div class="ml">CTR</div><div class="mv green">${(st.yt.ctr28d*100).toFixed(1)}%</div></div></div><div class="mr2"><div class="metric"><div class="ml">Watch time (28d)</div><div class="mv blue">${fmtK(Math.round(st.yt.watchMins28d/60))}h</div></div><div class="metric"><div class="ml">Source</div><div class="mv sm" style="font-size:11px">YouTube Analytics</div></div></div>`;
    }else if(isConnected){
      ab.innerHTML=`<div style="text-align:center;padding:8px 0"><div style="font-size:12px;color:var(--text2);margin-bottom:8px">Analytics connected — fetching data…</div><button class="btn btn-sm" style="opacity:0.6;font-size:11px" onclick="fetchYTAnalytics()">↻ Retry</button></div>`;
    }else{
      ab.innerHTML=`<div style="text-align:center;padding:8px 0"><div style="font-size:12px;color:var(--text2);margin-bottom:10px">Connect to see watch hours, impressions & CTR</div><button class="btn btn-p btn-sm" id="yt-oauth-btn" onclick="startYTOAuth()">Connect Analytics</button></div>`;
    }
  }
  const YT_CHECKS=['Record Saturday stream','Clip moments for Shorts','Edit long form highlight','Upload long form','Post Shorts (aim 3)','Check analytics'];
  const ytWeekStart=mondayOfWeek(new Date());
  if(!st.yt.weekChecks||st.yt.weekChecks.length!==YT_CHECKS.length||st.yt.weekChecksWeekStart!==ytWeekStart){st.yt.weekChecks=YT_CHECKS.map(()=>false);st.yt.weekChecksWeekStart=ytWeekStart;save();}
  document.getElementById('yt-checklist').innerHTML=YT_CHECKS.map((item,i)=>`<div class="todo-item ${st.yt.weekChecks[i]?'checked':''}"><input type="checkbox" ${st.yt.weekChecks[i]?'checked':''} onchange="st.yt.weekChecks[${i}]=this.checked;save();this.closest('.todo-item').classList.toggle('checked',this.checked)"><span>${item}</span></div>`).join('');
  rSecTodos('youtube');
  if(st.yt.apiVideos?.length)renderYTVideos({videos:st.yt.apiVideos});
  if(!ytApiCache||ytApiCache.error||Date.now()-ytApiCache.fetchedAt>5*60*1000)fetchYTData();
  else if(!!st.apiKeys.ytRefreshToken&&!st.yt.impressions28d)fetchYTAnalytics();
  else renderYTVideos(ytApiCache);
}
function updateYT(){
  const si=document.getElementById('yt-si').value,vi=document.getElementById('yt-vi').value,hi=document.getElementById('yt-hi').value;
  if(si.trim()!==''){const s=parseInt(si);if(!isNaN(s)&&s>=0)st.yt.subs=s;}
  if(vi.trim()!==''){const v=parseInt(vi);if(!isNaN(v)&&v>=0)st.yt.views=v;}
  if(hi.trim()!==''){const h=parseInt(hi);if(!isNaN(h)&&h>=0)st.yt.hours=h;}
  save();rYT();toast('Stats updated');
}
let ytApiCache=null;
async function fetchYTData(){
  const channelId=st.apiKeys.ytChannelId;
  const ytFetch=(path)=>window.electronAPI?.fetchYouTube(path, st.apiKeys.ytApi);
  const vidEl=document.getElementById('yt-videos');
  if(!ytFetch){if(vidEl)vidEl.innerHTML='<div class="empty" style="font-size:12px;color:var(--text3)">Live stats require the desktop app</div>';return;}
  if(!channelId){if(vidEl)vidEl.innerHTML='<div class="empty" style="font-size:12px;color:var(--text3)">Set your YouTube Channel ID in Settings</div>';return;}
  if(ytApiCache&&!ytApiCache.error&&Date.now()-ytApiCache.fetchedAt<5*60*1000){renderYTVideos(ytApiCache);return;}
  const btn=document.getElementById('yt-fetch-btn');
  if(btn){btn.textContent='…';btn.disabled=true;}
  if(vidEl)vidEl.innerHTML='<div class="empty" style="font-size:12px;color:var(--text3)">Fetching…</div>';
  try{
    const chanRes=await ytFetch(`/channels?part=statistics,contentDetails&id=${channelId}`);
    if(chanRes.error||chanRes.status===400){ytApiCache={error:chanRes.error||'Bad request — check YOUTUBE_CHANNEL_ID',fetchedAt:Date.now()};renderYTVideos(ytApiCache);if(btn){btn.textContent='↻ Live';btn.disabled=false;}return;}
    if(chanRes.status===403){ytApiCache={error:'API key invalid or quota exceeded — check YOUTUBE_API_KEY',fetchedAt:Date.now()};renderYTVideos(ytApiCache);if(btn){btn.textContent='↻ Live';btn.disabled=false;}return;}
    const chan=chanRes.data?.items?.[0];
    if(!chan){ytApiCache={error:'Channel not found',fetchedAt:Date.now()};renderYTVideos(ytApiCache);if(btn){btn.textContent='↻ Live';btn.disabled=false;}return;}
    const stats=chan.statistics;
    const uploadsId=chan.contentDetails?.relatedPlaylists?.uploads;
    let videos=[];
    if(uploadsId){
      const plRes=await ytFetch(`/playlistItems?part=contentDetails&playlistId=${uploadsId}&maxResults=5`);
      const ids=(plRes.data?.items||[]).map(i=>i.contentDetails.videoId).filter(Boolean).join(',');
      if(ids){
        const vidRes=await ytFetch(`/videos?part=statistics,snippet&id=${ids}`);
        videos=(vidRes.data?.items||[]).map(v=>({
          id:v.id,title:v.snippet?.title||'',
          views:parseInt(v.statistics?.viewCount)||0,
          likes:parseInt(v.statistics?.likeCount)||0,
          comments:parseInt(v.statistics?.commentCount)||0,
          published:v.snippet?.publishedAt?.slice(0,10)||''
        }));
      }
    }
    ytApiCache={
      subs:parseInt(stats?.subscriberCount)||0,
      views:parseInt(stats?.viewCount)||0,
      videoCount:parseInt(stats?.videoCount)||0,
      videos,fetchedAt:Date.now()
    };
    st.yt.subs=ytApiCache.subs;
    st.yt.views=ytApiCache.views;
    st.yt.apiVideos=ytApiCache.videos;
    st.yt.videoCount=ytApiCache.videoCount;
    if(chan.snippet?.title)st.yt.channelName=chan.snippet.title;
    save();rYT();
    renderYTVideos(ytApiCache);
    toast('YouTube stats updated');
    fetchYTAnalytics();
  }catch(e){
    ytApiCache={error:e.message,fetchedAt:Date.now()};
    renderYTVideos(ytApiCache);
  }
  if(btn){btn.textContent='↻ Live';btn.disabled=false;}
}
function renderYTVideos(data){
  const el=document.getElementById('yt-videos');const ts=document.getElementById('yt-api-ts');
  if(!el)return;
  if(ts&&data?.fetchedAt){const d=new Date(data.fetchedAt);ts.textContent=d.getHours().toString().padStart(2,'0')+':'+d.getMinutes().toString().padStart(2,'0');}
  if(data?.error){el.innerHTML=`<div style="color:var(--red);font-size:12px;padding:4px 0">${data.error}</div>`;return;}
  if(!data?.videos?.length){el.innerHTML='<div class="empty">No videos found</div>';return;}
  el.innerHTML=data.videos.map(v=>`<div style="padding:8px 0;border-bottom:1px solid var(--border)"><div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:4px;line-height:1.3">${escAttr(v.title)}</div><div style="display:flex;gap:12px;font-size:12px;color:var(--text2)"><span style="color:var(--accent2)">${fmtK(v.views)} views</span><span>👍 ${fmtK(v.likes)}</span><span>💬 ${fmtK(v.comments)}</span><span style="margin-left:auto;color:var(--text3)">${escAttr(v.published)}</span></div></div>`).join('');
}
let ytAccessToken=null,ytTokenExpiry=0;
async function getYTAccessToken(){
  if(ytAccessToken&&Date.now()<ytTokenExpiry-60000)return ytAccessToken;
  if(!st.apiKeys.ytRefreshToken)return null;
  const r=await window.electronAPI.refreshYouTubeToken(st.apiKeys.ytClientId, st.apiKeys.ytClientSecret, st.apiKeys.ytRefreshToken);
  if(r?.access_token){ytAccessToken=r.access_token;ytTokenExpiry=Date.now()+(r.expires_in||3600)*1000;return ytAccessToken;}
  return null;
}
async function startYTOAuth(){
  const btn=document.getElementById('yt-oauth-btn');
  if(btn){btn.textContent='Opening browser…';btn.disabled=true;}
  const r=await window.electronAPI?.startYouTubeOAuth?.(st.apiKeys.ytClientId, st.apiKeys.ytClientSecret);
  if(r?.error){toast('Auth failed: '+r.error);if(btn){btn.textContent='Connect Analytics';btn.disabled=false;}return;}
  ytAccessToken=r.access_token;ytTokenExpiry=Date.now()+(r.expires_in||3600)*1000;
  st.apiKeys.ytRefreshToken=r.refresh_token;st.yt.analyticsConnected=true;save();
  toast('Analytics connected!');
  rYT();fetchYTAnalytics();
}
async function fetchYTAnalytics(){
  const token=await getYTAccessToken();
  const el=document.getElementById('yt-analytics-body');
  if(!token){
    const wasConnected=!!st.apiKeys.ytRefreshToken;
    if(el){
      if(wasConnected){
        el.innerHTML=`<div style="text-align:center;padding:8px 0"><div style="font-size:12px;color:var(--text2);margin-bottom:8px">Could not refresh token — re-authenticate to continue</div><button class="btn btn-p btn-sm" id="yt-oauth-btn" onclick="startYTOAuth()">Re-authenticate</button></div>`;
      }else{
        el.innerHTML=`<div style="text-align:center;padding:8px 0"><div style="font-size:12px;color:var(--text2);margin-bottom:10px">Connect to see watch hours, impressions & CTR</div><button class="btn btn-p btn-sm" id="yt-oauth-btn" onclick="startYTOAuth()">Connect Analytics</button></div>`;
      }
    }
    return;
  }
  if(el)el.innerHTML='<div class="empty" style="font-size:12px;color:var(--text3)">Fetching analytics…</div>';
  const today=new Date().toISOString().slice(0,10);
  const d28=new Date(Date.now()-28*864e5).toISOString().slice(0,10);
  try{
    const[r28,rLife]=await Promise.all([
      window.electronAPI.fetchYouTubeAnalytics(`/v2/reports?ids=channel%3D%3DMINE&startDate=${d28}&endDate=${today}&metrics=views,estimatedMinutesWatched,impressions,impressionClickThroughRate`,token),
      window.electronAPI.fetchYouTubeAnalytics(`/v2/reports?ids=channel%3D%3DMINE&startDate=2020-01-01&endDate=${today}&metrics=estimatedMinutesWatched`,token)
    ]);
    if(r28?.status===401||rLife?.status===401){ytAccessToken=null;if(el)el.innerHTML='<div style="color:var(--red);font-size:12px">Token expired — press ↻ Live to re-authenticate</div>';return;}
    if(r28?.status===403){
      if(el)el.innerHTML=`<div style="color:var(--amber);font-size:12px;padding:6px 0">Analytics access denied (403). Make sure your Google account is added as a test user in Google Cloud Console.</div><button class="btn btn-sm" style="font-size:11px;margin-top:6px" onclick="startYTOAuth()">Re-authenticate</button>`;
      return;
    }
    st.yt.analyticsConnected=true;
    if(r28?.data?.rows?.[0]){
      const cols=r28.data.columnHeaders.map(h=>h.name);
      const get=name=>{const i=cols.indexOf(name);return i>=0?r28.data.rows[0][i]:0;};
      st.yt.impressions28d=Math.round(get('impressions'));
      st.yt.ctr28d=get('impressionClickThroughRate');
      st.yt.watchMins28d=Math.round(get('estimatedMinutesWatched'));
    }
    if(rLife?.data?.rows?.[0]){
      const lifeHours=Math.round(rLife.data.rows[0][0]/60);
      st.yt.hours=lifeHours;
    }
    save();rYT();
    const ts=document.getElementById('yt-analytics-ts');
    if(ts){const d=new Date();ts.textContent=d.getHours().toString().padStart(2,'0')+':'+d.getMinutes().toString().padStart(2,'0');}
  }catch(e){
    if(el)el.innerHTML=`<div style="color:var(--red);font-size:12px">Analytics error: ${e.message}</div>`;
  }
}

// ═══ DEV ═══
function rDev(){
  const dt=document.getElementById('dev-title');if(dt)dt.textContent=st.dev.name||'Side Project';
  document.getElementById('dev-m').innerHTML=`<div class="metric"><div class="ml">Members / Users</div><div class="mv">${st.dev.members}</div></div><div class="metric"><div class="ml">Status</div><div class="mv sm">${st.dev.status}</div></div>`;
  const si=document.getElementById('dev-si');if(si)si.value=st.dev.status;
  
  const disp=document.getElementById('dev-notes-display');
  const edit=document.getElementById('dev-notes-edit');
  const un=document.getElementById('dev-notes');
  if(un)un.value=st.dev.notes||'';
  if(disp){disp.innerHTML=st.dev.notes?parseMD(st.dev.notes):emptyState('📝','Click to add notes...');disp.style.display='block';}
  if(edit)edit.style.display='none';
  
  document.getElementById('dev-todos').innerHTML=st.devTodos.length?st.devTodos.map((t,i)=>`<div class="todo-item ${t.done?'checked':''}"><input type="checkbox" ${t.done?'checked':''} onchange="st.devTodos[${i}].done=this.checked;save()"><span>${t.text}</span><button class="del-btn" onclick="st.devTodos.splice(${i},1);save();rDev()">✕</button></div>`).join(''):'<div class="empty">No todos yet</div>';
}
function saveDevNotes(){if(!st.dev)st.dev={};st.dev.notes=document.getElementById('dev-notes').value;save();rDev();toast('Notes saved');}
function updateDev(){
  const raw=document.getElementById('dev-m1i').value;
  if(raw.trim()!==''){
    const m=parseInt(raw);
    if(!isNaN(m)&&m>=0)st.dev.members=m;
  }
  st.dev.status=document.getElementById('dev-si').value;
  save();rDev();toast('Project updated');
}
function addDevTodo(){const v=sanitizeText(document.getElementById('dev-ti').value,200).trim();if(!v)return;st.devTodos.push({text:v,done:false});document.getElementById('dev-ti').value='';save();rDev();}

// ═══ SCHEDULE ═══
function rSchedule(){
  const days=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const evs=st.scheduleEvents&&st.scheduleEvents.length===7?st.scheduleEvents:DEFAULT_SCHED_EVENTS;
  const di=new Date().getDay();const ai=di===0?6:di-1;
  document.getElementById('sched-grid').innerHTML=days.map((d,i)=>`<div class="dc ${i===ai?'today':''}"><div class="dn">${d}</div>${(evs[i]||[]).map(e=>`<div class="de ${evClass(e.c)}">${e.t}</div>`).join('')}</div>`).join('');
  const tf=document.getElementById('today-focus');if(tf)tf.value=st.todayFocus||'';
  rSchedEvents();
  rSecTodos('schedule');
}
function rSchedEvents(){
  const el=document.getElementById('sched-ev-list');if(!el)return;
  const days=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const evs=st.scheduleEvents&&st.scheduleEvents.length===7?st.scheduleEvents:DEFAULT_SCHED_EVENTS;
  const rows=[];
  evs.forEach((dayEvs,di)=>dayEvs.forEach((ev,ei)=>{
    rows.push(`<div class="shi"><span class="chip chip-b" style="min-width:36px;text-align:center">${days[di]}</span><span class="de ${evClass(ev.c)}" style="font-size:12px;padding:2px 8px;border-radius:4px;flex:1">${ev.t}</span><button class="del-btn" onclick="rmSchedEvent(${di},${ei})">✕</button></div>`);
  }));
  el.innerHTML=rows.length?rows.join(''):'<div class="empty">No events yet — add some below</div>';
}
function addSchedEvent(){
  const di=parseInt(document.getElementById('sched-ev-day').value);
  const txt=sanitizeText(document.getElementById('sched-ev-txt').value,60).trim();
  if(!txt)return;
  const type=document.getElementById('sched-ev-type').value;
  st.scheduleEvents[di].push({t:txt,c:type});
  document.getElementById('sched-ev-txt').value='';
  save();rSchedule();toast('Event added');
}
function rmSchedEvent(di,ei){
  st.scheduleEvents[di].splice(ei,1);
  save();rSchedule();toast('Event removed');
}

// ═══ HABITS ═══
function rHabits(){
  const hd=document.getElementById('habit-date');if(hd)hd.textContent=new Date().toDateString();
  document.getElementById('habit-grid').innerHTML=st.habits.length?st.habits.map((h,i)=>`<div class="hi ${h.done?'done':''}" onclick="togHabit(${i})"><div class="hck">${h.done?'✓':''}</div><span style="flex:1">${h.label}</span><span onclick="event.stopPropagation();rmHabit(${i})" style="font-size:13px;color:var(--text3);cursor:pointer;padding:0 2px">✕</span></div>`).join(''):emptyState('✅','No habits yet','Add one below to start tracking');
  const done=st.habits.filter(h=>h.done).length;const total=st.habits.length||1;
  document.getElementById('habit-stats').innerHTML=`<div class="metric"><div class="ml">Done today</div><div class="mv">${done}/${st.habits.length}</div></div><div class="metric"><div class="ml">Completion</div><div class="mv green">${Math.round(done/total*100)}%</div></div>`;
  
  // Heatmap render
  const hm=document.getElementById('habit-heatmap');
  if(hm){
    const days=[];
    for(let i=29;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);days.push(localDateStr(d));}
    hm.innerHTML=days.map(d=>{
      const rec=st.habitHistory[d];
      let cls=''; let txt='No data';
      if(rec&&rec.t>0){
        const pct=rec.d/rec.t;
        if(pct>0)cls='l1';if(pct>=0.5)cls='l2';if(pct>=1)cls='l3';
        txt=`${d}: ${rec.d}/${rec.t}`;
      }
      return`<div class="hm-box ${cls}" title="${txt}"></div>`;
    }).join('');
  }
}
function recordHabitHistory(){const today=localDateStr(new Date());const done=st.habits.filter(h=>h.done).length;const total=st.habits.length||1;st.habitHistory[today]={d:done,t:total};}
function togHabit(i){
  const wasAllDone=st.habits.length>0&&st.habits.every(h=>h.done);
  st.habits[i].done=!st.habits[i].done;save();rHabits();
  if(!wasAllDone&&st.habits.every(h=>h.done))fireConfetti();
  recordHabitHistory();save();rHabits();
}
function rmHabit(i){st.habits.splice(i,1);save();rHabits();}
function addHabit(){const v=sanitizeText(document.getElementById('new-habit-in').value,100).trim();if(!v)return;st.habits.push({label:v,done:false});document.getElementById('new-habit-in').value='';save();rHabits();}
function resetHabits(){st.habits.forEach(h=>h.done=false);recordHabitHistory();save();rHabits();}

// ═══ FITNESS ═══
function rFitness(){
  const fn=document.getElementById('fitness-notes');if(fn)fn.value=st.fitnessNotes||'';
  const disp=document.getElementById('fitness-notes-display');
  const edit=document.getElementById('fitness-notes-edit');
  if(disp){disp.innerHTML=st.fitnessNotes?parseMD(st.fitnessNotes):emptyState('📝','Click to add notes...');disp.style.display='block';}
  if(edit)edit.style.display='none';
  const fl=document.getElementById('fitness-goals-list');
  if(fl)fl.innerHTML=st.fitnessGoals.length?st.fitnessGoals.map((g,i)=>`<div class="gi ${g.done?'done':''}"><div class="gc" onclick="st.fitnessGoals[${i}].done=!st.fitnessGoals[${i}].done;save();rFitness()">${g.done?'✓':''}</div><span class="gt">${g.text}</span><button class="del-btn" onclick="st.fitnessGoals.splice(${i},1);save();rFitness()">✕</button></div>`).join(''):'<div class="empty">No goals yet</div>';
  rSecTodos('fitness');
}
function saveFitnessNotes(){st.fitnessNotes=document.getElementById('fitness-notes').value;save();rFitness();toast('Notes saved');}
function addFitnessGoal(){const v=sanitizeText(document.getElementById('fg-in').value,150).trim();if(!v)return;st.fitnessGoals.push({text:v,done:false});document.getElementById('fg-in').value='';save();rFitness();}

// ═══ TRAVEL ═══
function rTravel(){
  const tl=document.getElementById('trips-list');
  if(tl)tl.innerHTML=st.trips.length?st.trips.map((t,i)=>`<div class="gi"><div class="gc" onclick="st.trips[${i}].done=!st.trips[${i}].done;save();rTravel()">${t.done?'✓':''}</div><div style="flex:1"><div class="gt">${t.dest}</div><div style="font-size:11px;color:var(--text2)">${t.date} · Budget: ${fmt(t.budget)}</div></div><button class="del-btn" onclick="st.trips.splice(${i},1);save();rTravel()">✕</button></div>`).join(''):emptyState('✈️','No trips planned yet','Add your next adventure below');
  rSecTodos('travel');
}
function addTrip(){
  const d=sanitizeText(document.getElementById('trip-dest').value,100).trim();
  const dt=sanitizeText(document.getElementById('trip-date').value,20).trim();
  const b=validateNumber(document.getElementById('trip-budget').value,0,99999);
  if(!d){toast('Destination required');return;}
  st.trips.push({dest:d,date:dt,budget:b,done:false});
  document.getElementById('trip-dest').value='';
  document.getElementById('trip-date').value='';
  document.getElementById('trip-budget').value='';
  save();rTravel();toast('Trip added');
}

// ═══ GOALS ═══
function rGoals(){
  const active=st.goals.filter(g=>!g.done).length;
  const gc=document.getElementById('goals-count');if(gc)gc.textContent=active+' active';
  const cats={'life':'chip-g','fitness':'chip-g','finance':'chip-b','youtube':'chip-a','uni':'chip-b','dev':'chip-a'};
  document.getElementById('goals-list').innerHTML=st.goals.length?st.goals.map((g,i)=>`<div class="gi ${g.done?'done':''}"><div class="gc" onclick="st.goals[${i}].done=!st.goals[${i}].done;save();rGoals()">${g.done?'✓':''}</div><span class="gt">${g.text}</span><span class="chip ${cats[g.category]||'chip-b'}">${g.category}</span><button class="del-btn" onclick="st.goals.splice(${i},1);save();rGoals()">✕</button></div>`).join(''):emptyState('🎯','No goals yet','What are you working toward?');
}
function addGoal(){const t=sanitizeText(document.getElementById('goal-in').value,150).trim();const c=document.getElementById('goal-cat').value;if(!t)return;st.goals.push({text:t,category:c,done:false});document.getElementById('goal-in').value='';save();rGoals();}

// ═══ TODOS ═══
function rSecTodos(sec){
  if(!st.secTodos[sec])st.secTodos[sec]=[];
  const el=document.getElementById('todos-'+sec);if(!el)return;
  el.innerHTML=st.secTodos[sec].length?st.secTodos[sec].map((t,i)=>`<div class="todo-item ${t.done?'checked':''}"><input type="checkbox" ${t.done?'checked':''} onchange="st.secTodos['${sec}'][${i}].done=this.checked;save()"><span>${t.text}</span><button class="del-btn" onclick="st.secTodos['${sec}'].splice(${i},1);save();rSecTodos('${sec}')">✕</button></div>`).join(''):'<div class="empty">No todos yet</div>';
}
function addSecTodo(sec){const inp=document.getElementById('ti-'+sec);if(!inp||!inp.value.trim())return;if(!st.secTodos[sec])st.secTodos[sec]=[];st.secTodos[sec].push({text:sanitizeText(inp.value,200).trim(),done:false});inp.value='';save();rSecTodos(sec);}
function rMasterTodos(){
  const secs=['finance','uni','youtube','schedule','fitness','travel'];
  const labs={finance:'Finance',uni:'Uni',youtube:'YouTube',schedule:'Schedule',fitness:'Fitness',travel:'Travel'};
  let html='';
  if(st.setupTodos.length)html+=`<div class="card"><div class="card-title">Setup</div>${st.setupTodos.map((t,i)=>`<div class="todo-item ${t.done?'checked':''}"><input type="checkbox" ${t.done?'checked':''} onchange="st.setupTodos[${i}].done=this.checked;save()"><span>${t.text}</span></div>`).join('')}</div>`;
  secs.forEach(s=>{const todos=st.secTodos[s]||[];if(!todos.length)return;const p=todos.filter(t=>!t.done).length;html+=`<div class="card"><div class="card-header"><div class="card-title" style="margin-bottom:0">${labs[s]}</div><span class="chip chip-b">${p} pending</span></div>${todos.map((t,i)=>`<div class="todo-item ${t.done?'checked':''}"><input type="checkbox" ${t.done?'checked':''} onchange="st.secTodos['${s}'][${i}].done=this.checked;save()"><span>${t.text}</span><button class="del-btn" onclick="st.secTodos['${s}'].splice(${i},1);save();rMasterTodos()">✕</button></div>`).join('')}</div>`;});
  html+=`<div class="card"><div class="card-header"><div class="card-title" style="margin-bottom:0">General</div></div>${st.genTodos.length?st.genTodos.map((t,i)=>`<div class="todo-item ${t.done?'checked':''}"><input type="checkbox" ${t.done?'checked':''} onchange="st.genTodos[${i}].done=this.checked;save()"><span>${t.text}</span><button class="del-btn" onclick="st.genTodos.splice(${i},1);save();rMasterTodos()">✕</button></div>`).join(''):'<div class="empty">No todos yet</div>'}<div class="ta-row"><input type="text" id="gen-ti" placeholder="Add general todo..." style="flex:1"><button class="btn btn-p btn-sm" onclick="addGenTodo()">Add</button></div></div>`;
  document.getElementById('master-todos').innerHTML=html||'<div class="card"><div class="empty">No todos yet</div></div>';
}
function addGenTodo(){const inp=document.getElementById('gen-ti');if(!inp||!inp.value.trim())return;st.genTodos.push({text:sanitizeText(inp.value,200).trim(),done:false});inp.value='';save();rMasterTodos();}

// ═══ JOURNAL ═══
function rJournal(){
  const today=new Date().toDateString();
  const jt=document.getElementById('journal-title');if(jt)jt.textContent='Today — '+today;
  const jx=document.getElementById('journal-text');if(jx)jx.value=st.journals[today]||'';
  const past=Object.entries(st.journals).filter(([k])=>k!==today).reverse().slice(0,7);
  const pj=document.getElementById('past-journals');
  if(pj)pj.innerHTML=past.length?past.map(([date,text])=>`<div style="margin-bottom:14px;padding-bottom:14px;border-bottom:1px solid var(--border)"><div style="font-size:11px;font-weight:600;color:var(--text2);margin-bottom:5px">${date}</div><div style="font-size:13px;color:var(--text2);line-height:1.6">${parseMD(text)}</div></div>`).join(''):emptyState('📓','No past entries yet','Your reflections will appear here');
}
async function generateJournalPrompt(){
  if(!getGroqKey()){toast('Add your Groq API key in Settings first!');return;}
  const btn=document.getElementById('journal-prompt-btn');
  const box=document.getElementById('journal-prompt-box');
  btn.textContent='Thinking...';btn.disabled=true;
  const r = await callGroq([{role:'user',content:'Generate a single, deep, thought-provoking journaling prompt for me based on my day today (check my habits, sleep, and tasks). Just return the question itself.'}]);
  btn.innerHTML='<span class="ai-dot" style="display:inline-block;margin-right:6px"></span>AI Prompt';btn.disabled=false;
  if(r){
    const clean = parseActions(parseNav(r).clean).clean;
    box.textContent = clean; box.style.display = 'block';
  } else { toast('Failed to get prompt'); }
}
function saveJournal(){const today=new Date().toDateString();st.journals[today]=document.getElementById('journal-text').value;save();rJournal();}

// ═══ MANAGE ═══
function rManage(){
  document.getElementById('manage-list').innerHTML=st.sections.map(s=>{
    const delBtn=!s.core?`<button class="btn btn-sm btn-d" onclick="promptDelSec('${s.id}')">Delete</button>`:'';
    return`<div class="mi" draggable="true" ondragstart="dragStart(event,'${s.id}')" ondragend="dragEnd(event)" ondragover="dragOver(event)" ondrop="dropSec(event,'${s.id}')"><div style="display:flex;align-items:center;gap:12px"><div style="cursor:grab;color:var(--text3);padding:4px 0;font-size:15px;user-select:none;opacity:0.5;line-height:1">⋮⋮</div><div><div style="font-size:14px;font-weight:600;color:var(--text)">${s.icon||'📁'} ${s.label}</div><div style="font-size:10px;color:var(--text3);margin-top:2px">${s.core?'Core':'Custom'} · ${s.visible?'Visible':'Hidden'}</div></div></div><div class="mi-actions"><button class="btn btn-sm" onclick="openRename('${s.id}')">Rename</button><button class="btn btn-sm" onclick="togVis('${s.id}')">${s.visible?'Hide':'Show'}</button>${delBtn}</div></div>`;
  }).join('');
}
let dragId=null;
function dragStart(e,id){dragId=id;e.target.style.opacity='0.4';}
function dragEnd(e){e.target.style.opacity='1';dragId=null;}
function dragOver(e){e.preventDefault();e.dataTransfer.dropEffect='move';}
function dropSec(e,targetId){
  e.preventDefault();if(!dragId||dragId===targetId)return;
  const a=st.sections.findIndex(x=>x.id===dragId);const b=st.sections.findIndex(x=>x.id===targetId);
  if(a<0||b<0)return;
  const[m]=st.sections.splice(a,1);st.sections.splice(b,0,m);
  save();rManage();renderSidebar();
}
function togVis(id){const s=st.sections.find(x=>x.id===id);if(s)s.visible=!s.visible;save();rManage();}
function openRename(id){renamingId=id;const s=st.sections.find(x=>x.id===id);document.getElementById('rename-val').value=s?s.label:'';openModal('modal-rename');}
function doRename(){if(!renamingId)return;const name=sanitizeText(document.getElementById('rename-val').value,60).trim();const s=st.sections.find(x=>x.id===renamingId);if(s&&name)s.label=name;save();closeModal('modal-rename');rManage();renamingId=null;}
function doAddSec(){const name=sanitizeText(document.getElementById('add-name').value,60).trim();const type=document.getElementById('add-type').value;const icon=sanitizeText(document.getElementById('add-icon').value,10)||'📁';if(!name)return;const id='cs_'+Date.now();st.sections.push({id,label:name,icon,core:false,visible:true,type});st.customSecs[id]={name,type,todos:[],notes:'',trackers:[]};document.getElementById('add-name').value='';document.getElementById('add-icon').value='';save();closeModal('modal-add');goHome();}
function promptDelSec(id){showConfirm('Delete section?','Permanently deletes this section and all its data.',()=>{st.sections=st.sections.filter(x=>x.id!==id);delete st.customSecs[id];save();rManage();goHome();});}

// ═══ CUSTOM ═══
function rCustom(id){
  const cs=st.customSecs[id];const sec=st.sections.find(s=>s.id===id);if(!cs||!sec)return;
  const pg=document.getElementById('page-custom');
  const hdr=`<div class="sc">`;
  if(cs.type==='notes'||cs.type==='freeform'){
    pg.innerHTML=hdr+`<div class="card"><div class="card-title">Notes</div><textarea id="cs-n-${id}" style="min-height:160px">${cs.notes||''}</textarea><button class="btn btn-p btn-sm" style="margin-top:8px" onclick="st.customSecs['${id}'].notes=sanitizeText(document.getElementById('cs-n-${id}').value,5000);save()">Save</button></div>`+(cs.type==='notes'?`<div class="card"><div class="card-title">Todos</div><div id="cs-tl-${id}">${(cs.todos||[]).map((t,i)=>`<div class="todo-item ${t.done?'checked':''}"><input type="checkbox" ${t.done?'checked':''} onchange="st.customSecs['${id}'].todos[${i}].done=this.checked;save()"><span>${t.text}</span><button class="del-btn" onclick="st.customSecs['${id}'].todos.splice(${i},1);save();rCustom('${id}')">✕</button></div>`).join('')||'<div class="empty">No todos yet</div>'}</div><div class="ta-row"><input type="text" id="cs-ti-${id}" placeholder="Add todo..." style="flex:1"><button class="btn btn-p btn-sm" onclick="addCsTodo('${id}')">Add</button></div></div>`:'')+`</div>`;
  } else {
    pg.innerHTML=hdr+`<div class="card"><div class="card-title">Trackers</div><div class="mr2">${(cs.trackers||[]).map((t,i)=>`<div class="metric" style="position:relative"><div class="ml">${t.label}</div><div class="mv">${t.value}${t.suffix||''}</div><button onclick="st.customSecs['${id}'].trackers.splice(${i},1);save();rCustom('${id}')" style="position:absolute;top:5px;right:5px;background:none;border:none;cursor:pointer;color:var(--text3);font-size:12px">✕</button></div>`).join('')||'<div style="font-size:12px;color:var(--text2)">No trackers yet</div>'}</div><div class="ir3" style="gap:8px;margin-top:10px"><div><div class="fl">Label</div><input type="text" id="cs-tl-${id}" placeholder="Weight"></div><div><div class="fl">Value</div><input type="text" id="cs-tv-${id}" placeholder="75"></div><div><div class="fl">Suffix</div><input type="text" id="cs-ts-${id}" placeholder="kg"></div></div><button class="btn btn-p btn-sm" style="margin-top:8px" onclick="addCsTracker('${id}')">Add tracker</button></div></div>`;
  }
}
function addCsTodo(id){const inp=document.getElementById('cs-ti-'+id);if(!inp||!inp.value.trim())return;st.customSecs[id].todos.push({text:sanitizeText(inp.value,200).trim(),done:false});inp.value='';save();rCustom(id);}
function addCsTracker(id){const l=document.getElementById('cs-tl-'+id);const v=document.getElementById('cs-tv-'+id);const s=document.getElementById('cs-ts-'+id);if(!l||!l.value.trim())return;st.customSecs[id].trackers.push({label:sanitizeText(l.value,60).trim(),value:v?sanitizeText(v.value,60).trim():'',suffix:s?sanitizeText(s.value,20).trim():''});l.value='';if(v)v.value='';if(s)s.value='';save();rCustom(id);}

// ═══ SLEEP ═══
function sleepDuration(bed,wake){
  const[bh,bm]=bed.split(':').map(Number);
  const[wh,wm]=wake.split(':').map(Number);
  let bedM=bh*60+bm,wakeM=wh*60+wm;
  if(wakeM<=bedM)wakeM+=1440;
  return(wakeM-bedM)/60;
}
function sleepQuality(bed,dur){
  const[h,m]=bed.split(':').map(Number);
  let bedM=h*60+m;
  if(bedM<12*60)bedM+=1440;
  if(dur<6||bedM>25*60)return'poor';
  if(dur<7||bedM>23*60+30)return'ok';
  return'good';
}
function sleepConsistency(logs){
  if(logs.length<2)return 100;
  const angles=logs.map(l=>{const[h,m]=l.bed.split(':').map(Number);return(h*60+m)/1440*2*Math.PI;});
  const sumCos=angles.reduce((a,b)=>a+Math.cos(b),0);
  const sumSin=angles.reduce((a,b)=>a+Math.sin(b),0);
  const r=Math.sqrt(sumCos*sumCos+sumSin*sumSin)/angles.length;
  const circStdMin=Math.sqrt(-2*Math.log(Math.max(r,1e-9)))*(1440/(2*Math.PI));
  return Math.max(0,Math.round(100-circStdMin*1.2));
}
function sleepContext(){
  const logs=(st.sleep?.logs||[]).slice(-7);
  if(!logs.length)return'';
  const durs=logs.map(l=>sleepDuration(l.bed,l.wake));
  const avg=durs.reduce((a,b)=>a+b,0)/durs.length;
  const consistency=sleepConsistency(logs);
  const lateNights=logs.filter(l=>{const[h]=l.bed.split(':').map(Number);return h<6?true:h>=24;}).length;
  const shortNights=durs.filter(d=>d<6).length;
  const trend=durs.length>=3?(durs.slice(-3).reduce((a,b)=>a+b,0)/3-durs.slice(0,3).reduce((a,b)=>a+b,0)/3).toFixed(1):null;
  let ctx=`Sleep last ${logs.length} nights: avg ${avg.toFixed(1)}h, consistency ${consistency}/100.`;
  if(lateNights>0)ctx+=` ${lateNights} late nights (past midnight).`;
  if(shortNights>0)ctx+=` ${shortNights} nights under 6h.`;
  if(trend!==null)ctx+=` Trend: ${parseFloat(trend)>=0?'+':''}${trend}h vs earlier this week.`;
  const last=logs[logs.length-1];
  if(last)ctx+=` Last night: ${last.bed}→${last.wake} (${sleepDuration(last.bed,last.wake).toFixed(1)}h).`;
  return ctx;
}
function logSleep(){
  const bed=document.getElementById('sleep-bed')?.value;
  const wake=document.getElementById('sleep-wake')?.value;
  const note=sanitizeText(document.getElementById('sleep-note')?.value?.trim()||'',100);
  if(!bed||!wake){toast('Enter bed and wake times');return;}
  const today=localDateStr(new Date());
  const existing=st.sleep.logs.findIndex(l=>l.date===today);
  const entry={date:today,bed,wake,note};
  if(existing>=0)st.sleep.logs[existing]=entry;
  else st.sleep.logs.push(entry);
  if(st.sleep.logs.length>90)st.sleep.logs=st.sleep.logs.slice(-90);
  save();
  toast('Sleep logged ✓');
  rSleep();
}
function saveSleepTargets(){
  const bed=document.getElementById('sleep-target-bed')?.value;
  const h=parseFloat(document.getElementById('sleep-target-hours')?.value);
  if(bed)st.sleep.targetBed=bed;
  if(!isNaN(h)&&h>0)st.sleep.targetHours=h;
  save();closeModal('modal-sleep-target');toast('Targets saved');rSleep();
}
function clearOldSleepLogs(){
  const cutoff=new Date();cutoff.setDate(cutoff.getDate()-30);
  const cut=localDateStr(cutoff);
  st.sleep.logs=st.sleep.logs.filter(l=>l.date>=cut);
  save();rSleep();toast('Old logs cleared');
}
function renderSleepChart(){
  const el=document.getElementById('sleep-chart');if(!el)return;
  const days=[];
  for(let i=6;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);days.push(localDateStr(d));}
  const logMap={};(st.sleep.logs||[]).forEach(l=>{logMap[l.date]=l;});
  const dayNames=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const today=localDateStr(new Date());
  const maxH=10;
  const chartH=88;
  const bars=days.map(date=>{
    const log=logMap[date];
    const dn=dayNames[new Date(date+'T12:00:00').getDay()];
    const isToday=date===today;
    if(!log)return`<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:0"><div style="height:${chartH}px;display:flex;align-items:flex-end;width:100%"><div style="width:100%;height:6px;background:rgba(255,255,255,0.04);border-radius:3px 3px 0 0"></div></div><div style="font-size:9px;margin-top:4px;color:${isToday?'var(--accent)':'var(--text3)'};${isToday?'font-weight:700':''}">${dn}</div></div>`;
    const dur=sleepDuration(log.bed,log.wake);
    const quality=sleepQuality(log.bed,dur);
    const pct=Math.min(1,dur/maxH);
    const barH=Math.max(6,Math.round(pct*chartH));
    const colors={good:'var(--green)',ok:'var(--amber)',poor:'var(--red)'};
    const col=colors[quality];
    return`<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:0" title="${log.bed}→${log.wake} (${dur.toFixed(1)}h)"><div style="font-size:8px;color:rgba(232,234,240,0.45);margin-bottom:2px">${dur.toFixed(1)}h</div><div style="height:${chartH-10}px;display:flex;align-items:flex-end;width:100%"><div style="width:100%;height:${barH}px;background:${col};border-radius:3px 3px 0 0;opacity:0.75"></div></div><div style="font-size:9px;margin-top:4px;color:${isToday?'var(--accent)':'var(--text3)'};${isToday?'font-weight:700':''}">${dn}</div></div>`;
  });
  // target line as a subtle indicator
  const targetPct=Math.min(1,st.sleep.targetHours/maxH);
  const targetBarH=Math.max(6,Math.round(targetPct*(chartH-10)));
  el.innerHTML=`<div style="position:relative"><div style="display:flex;gap:4px;align-items:flex-start">${bars.join('')}</div><div style="position:absolute;bottom:${targetBarH+22}px;left:0;right:0;height:1px;background:rgba(139,92,246,0.25);pointer-events:none"></div></div>`;
}
function rSleep(){
  const today=localDateStr(new Date());
  const bedEl=document.getElementById('sleep-bed');
  const wakeEl=document.getElementById('sleep-wake');
  const todayLog=st.sleep.logs.find(l=>l.date===today);
  if(todayLog&&bedEl)bedEl.value=todayLog.bed;
  if(todayLog&&wakeEl)wakeEl.value=todayLog.wake;
  renderSleepChart();
  const logs7=(st.sleep.logs||[]).slice(-7);
  const badge=document.getElementById('sleep-avg-badge');
  if(badge&&logs7.length){
    const avg=logs7.map(l=>sleepDuration(l.bed,l.wake)).reduce((a,b)=>a+b,0)/logs7.length;
    badge.textContent=`avg ${avg.toFixed(1)}h`;
  }
  const stats=document.getElementById('sleep-stats');
  if(stats&&logs7.length){
    const durs=logs7.map(l=>sleepDuration(l.bed,l.wake));
    const avg=durs.reduce((a,b)=>a+b,0)/durs.length;
    const consistency=sleepConsistency(logs7);
    const best=Math.max(...durs);
    const worst=Math.min(...durs);
    const qualCol=consistency>=80?'var(--green)':consistency>=60?'var(--amber)':'var(--red)';
    stats.innerHTML=`<div class="metric"><div class="ml">Avg sleep</div><div class="mv">${avg.toFixed(1)}h</div></div><div class="metric"><div class="ml">Consistency</div><div class="mv" style="color:${qualCol}">${consistency}/100</div></div><div class="metric"><div class="ml">Best night</div><div class="mv green">${best.toFixed(1)}h</div></div><div class="metric" style="grid-column:span 1"><div class="ml">Worst night</div><div class="mv" style="color:var(--amber)">${worst.toFixed(1)}h</div></div>`;
  }else if(stats){stats.innerHTML='<div class="empty">Log some sleep nights to see stats</div>';}
  const insights=document.getElementById('sleep-insights');
  if(insights&&logs7.length){
    const msgs=[];
    const durs=logs7.map(l=>sleepDuration(l.bed,l.wake));
    const avg=durs.reduce((a,b)=>a+b,0)/durs.length;
    if(avg<st.sleep.targetHours-0.5)msgs.push({q:'poor',t:`You're averaging ${avg.toFixed(1)}h — ${(st.sleep.targetHours-avg).toFixed(1)}h below your ${st.sleep.targetHours}h target.`});
    const lateNights=logs7.filter(l=>{const[h]=l.bed.split(':').map(Number);return h<6?true:h>=24;});
    if(lateNights.length>=2)msgs.push({q:'ok',t:`${lateNights.length} late nights (past midnight) this week.`});
    const shortNights=durs.filter(d=>d<6).length;
    if(shortNights>0)msgs.push({q:'poor',t:`${shortNights} night${shortNights>1?'s':''} under 6h this week.`});
    const consistency=sleepConsistency(logs7);
    if(consistency>=85)msgs.push({q:'good',t:`Great consistency — bedtime varies by under 30 min.`});
    if(!msgs.length&&avg>=st.sleep.targetHours-0.3)msgs.push({q:'good',t:`Solid week — hitting your ${st.sleep.targetHours}h target consistently.`});
    insights.innerHTML=msgs.map(m=>`<div class="chip sq-${m.q}" style="display:block;padding:7px 10px;border-radius:8px;margin-bottom:6px;font-size:12px;font-weight:400;text-transform:none;letter-spacing:0;line-height:1.5">${m.t}</div>`).join('');
  }else if(insights){insights.innerHTML='';}
  const logList=document.getElementById('sleep-log-list');
  if(logList){
    const recent=(st.sleep.logs||[]).slice(-14).reverse();
    if(!recent.length){logList.innerHTML=emptyState('🌙','No sleep logged yet','Log your first night above');return;}
    const total=st.sleep.logs.length;
    logList.innerHTML=recent.map((l,i)=>{
      const dur=sleepDuration(l.bed,l.wake);
      const quality=sleepQuality(l.bed,dur);
      const qLabel={good:'Good',ok:'Okay',poor:'Poor'}[quality];
      const durCol={good:'var(--green)',ok:'var(--amber)',poor:'var(--red)'}[quality];
      const d=new Date(l.date+'T12:00:00');
      const dn=d.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'});
      const realIdx=total-1-i;
      return`<div class="sleep-log-item"><div class="sli-date">${dn}</div><div class="sli-times">${l.bed} → ${l.wake}${l.note?` · <span style="color:var(--text3);font-size:11px">${l.note}</span>`:''}</div><span class="chip sq-${quality}" style="font-size:10px;padding:2px 7px">${qLabel}</span><div class="sli-dur" style="color:${durCol}">${dur.toFixed(1)}h</div><button class="del-btn" onclick="st.sleep.logs.splice(${realIdx},1);save();rSleep()">✕</button></div>`;
    }).join('');
  }
}

// ═══ NOTIFICATIONS ═══
function sendNotif(title,body){
  if(!('Notification'in window))return;
  const show=()=>new Notification(title,{body,icon:'icons/icon-192.png',silent:false});
  if(Notification.permission==='granted'){show();}
  else if(Notification.permission!=='denied'){Notification.requestPermission().then(p=>{if(p==='granted')show();});}
}
async function sendAINudge(){
  if(!(getGroqKey()))return;
  const today=new Date().toDateString();
  st.notifLastSent.aiNudge=today;save();
  const r=await callGroq([{role:'user',content:'Give me one proactive personalised observation based on my data. Max 1 sentence.'}]);
  if(r){const{clean}=parseActions(parseNav(r).clean);sendNotif('💡 SychBoard',clean.slice(0,140));}
}
function checkNotifications(){
  const now=new Date();
  const today=now.toDateString();
  const hh=now.getHours().toString().padStart(2,'0');
  const mm=now.getMinutes().toString().padStart(2,'0');
  const t=`${hh}:${mm}`;
  const ns=st.notifSettings;const nl=st.notifLastSent;
  if(ns.bedReminder&&t===ns.bedReminderTime&&nl.bedReminder!==today){
    sendNotif('🌙 Bedtime Reminder',`You aim to be in bed by ${st.sleep.targetBed}. Time to wind down!`);
    st.notifLastSent.bedReminder=today;save();
  }
  if(ns.morningBrief&&t===ns.morningBriefTime&&nl.morningBrief!==today){
    const done=st.habits.filter(h=>h.done).length;
    const wealth=st.balances.bank+st.balances.savings+st.balances.trading;
    const last=st.sleep.logs.slice(-1)[0];
    const slp=last?` · Slept ${sleepDuration(last.bed,last.wake).toFixed(1)}h`:'';
    sendNotif(`☀️ Morning, ${st.userName}!`,`${done}/${st.habits.length} habits · £${wealth.toFixed(0)} wealth${slp}`);
    st.notifLastSent.morningBrief=today;save();
  }
  if(ns.habitReminder&&t===ns.habitReminderTime&&nl.habitReminder!==today){
    const pending=st.habits.filter(h=>!h.done).length;
    if(pending>0){sendNotif('✅ Habit Check-in',`${pending} habit${pending!==1?'s':''} still to do today — don't break the streak!`);st.notifLastSent.habitReminder=today;save();}
  }
  if(ns.aiNudge&&t===ns.aiNudgeTime&&nl.aiNudge!==today){sendAINudge();}
}
// Local mirror of db.js's getAppDate() rollover math, so the renderer can detect a
// quest-reset boundary without polling the DB for the app-date on every tick.
function computeLocalAppDate(rolloverHour){
  const now=new Date();
  if(now.getHours()<rolloverHour)now.setDate(now.getDate()-1);
  return `${now.getFullYear()}-${(now.getMonth()+1).toString().padStart(2,'0')}-${now.getDate().toString().padStart(2,'0')}`;
}
async function checkQuestReset(){
  if(!window.sychboard)return;
  try{
    const rawRh=parseInt(await window.sychboard.settings.get('day_rollover_hour'));
    const rh=Number.isInteger(rawRh)&&rawRh>=0&&rawRh<=23?rawRh:4;
    const appDate=computeLocalAppDate(rh);
    if(st.lastAppDate&&st.lastAppDate!==appDate){
      if(st.notifSettings.questReset)sendNotif('🔄 Daily quests reset','A new day has started — your daily quests are ready!');
      const ap=document.querySelector('.page.active')?.id?.replace('page-','');
      if(ap==='home')renderHomeGamification();
      if(ap==='game')rGame();
    }
    if(st.lastAppDate!==appDate){st.lastAppDate=appDate;save();}
  }catch(e){console.error('[quest-reset]',e.message);}
}
function initNotifications(){
  checkQuestReset();
  setInterval(checkQuestReset,60000);
  checkHabitReset();
  setInterval(checkHabitReset,60000);
  if(!('Notification'in window))return;
  checkNotifications();
  setInterval(checkNotifications,60000);
}
function saveNotifSettings(){
  st.notifSettings.bedReminder=document.getElementById('notif-bed-toggle')?.checked??true;
  st.notifSettings.bedReminderTime=document.getElementById('notif-bed-time')?.value||'22:30';
  st.notifSettings.morningBrief=document.getElementById('notif-morning-toggle')?.checked??true;
  st.notifSettings.morningBriefTime=document.getElementById('notif-morning-time')?.value||'08:00';
  st.notifSettings.habitReminder=document.getElementById('notif-habit-toggle')?.checked??true;
  st.notifSettings.habitReminderTime=document.getElementById('notif-habit-time')?.value||'20:00';
  st.notifSettings.aiNudge=document.getElementById('notif-nudge-toggle')?.checked??false;
  st.notifSettings.aiNudgeTime=document.getElementById('notif-nudge-time')?.value||'12:00';
  st.notifSettings.questReset=document.getElementById('notif-quest-reset-toggle')?.checked??true;
  save();toast('Notification settings saved');
}
function testNotif(){
  if(Notification.permission==='denied'){toast('Notifications blocked — allow in browser settings');return;}
  sendNotif('🧪 SychBoard Notifications Active',`You'll receive reminders at the times you set.`);
}

// ═══ POMODORO & FX ═══
let pomT=null,pomR=false,pomM='focus',pomL=25*60;
function updatePom(){
  const m=Math.floor(pomL/60).toString().padStart(2,'0');
  const s=(pomL%60).toString().padStart(2,'0');
  const pt=document.getElementById('pom-time');
  if(pt)pt.textContent=`${m}:${s}`;
  if(pomL<=0){
    pomR=false;clearInterval(pomT);pomT=null;
    document.getElementById('pom-start-btn').textContent='Start';
    document.getElementById('pom-dot').style.animation='none';
    document.getElementById('pom-dot').style.background='var(--text3)';
    document.getElementById('pom-status').textContent='Finished';
    sendNotif('⏱️ Timer Complete', pomM==='focus'?'Great focus! Time for a short break.':'Break is over. Ready to focus?');
  }
}
function togglePom(){
  pomR=!pomR;
  const btn=document.getElementById('pom-start-btn');
  const dot=document.getElementById('pom-dot');
  const stat=document.getElementById('pom-status');
  if(pomR){
    if(pomL<=0){pomL=pomM==='focus'?st.pomodoro.focus*60:st.pomodoro.break*60;updatePom();}
    btn.textContent='Pause';
    dot.style.background=pomM==='focus'?'var(--accent)':'var(--green)';
    dot.style.animation='aidot 2s infinite';
    stat.textContent=pomM==='focus'?'Focusing...':'Resting...';
    pomT=setInterval(()=>{if(pomL>0){pomL--;updatePom();}},1000);
  }else{
    btn.textContent='Start';
    dot.style.animation='none';
    dot.style.background='var(--text3)';
    stat.textContent='Paused';
    clearInterval(pomT);pomT=null;
  }
}
function togglePomMode(){
  if(pomR)togglePom();
  pomM=pomM==='focus'?'break':'focus';
  pomL=pomM==='focus'?st.pomodoro.focus*60:st.pomodoro.break*60;
  document.getElementById('pom-mode-btn').textContent=pomM==='focus'?'Break':'Focus';
  document.getElementById('pom-status').textContent=pomM==='focus'?'Ready to focus':'Ready to rest';
  updatePom();
}
function fireConfetti(){
  const colors=['#8b5cf6','#3d8ef0','#2ecc8a','#f0a832','#f05090'];
  for(let i=0;i<60;i++){const el=document.createElement('div');el.style.cssText=`position:fixed;left:50%;top:50%;width:8px;height:8px;background:${colors[Math.floor(Math.random()*colors.length)]};border-radius:${Math.random()>0.5?'50%':'2px'};z-index:9999;pointer-events:none`;document.body.appendChild(el);const a=Math.random()*Math.PI*2,v=6+Math.random()*12;let vx=Math.cos(a)*v,vy=Math.sin(a)*v-8,op=1;function anim(){if(op<=0){el.remove();return}vy+=0.3;const r=el.getBoundingClientRect();el.style.left=(r.left+vx)+'px';el.style.top=(r.top+vy)+'px';op-=0.015;el.style.opacity=op;requestAnimationFrame(anim)}requestAnimationFrame(anim)}
}

// ═══ INIT ═══
load();
pomL = st.pomodoro.focus * 60; // Initialize timer based on saved settings
applyColor(st.accentColor||'#e8eaf0');
(async()=>{
  // Fill empty API key slots from .env (main process) — Settings-saved keys always take priority
  try{
    if(window.electronAPI?.getEnvKeys){
      const ek=await window.electronAPI.getEnvKeys();
      if(ek)Object.entries(ek).forEach(([k,v])=>{if(v&&!st.apiKeys[k])st.apiKeys[k]=v;});
    }
  }catch(e){console.warn('[env] key load failed:',e?.message);}
  try{await loadEquips();}catch(e){console.warn('[shop] equips load failed:',e?.message);}
  if(!st.onboarded){
    document.getElementById('boot').style.display='none';
    document.getElementById('onboarding').classList.add('show');
    updateObProgress();
  } else {
    startBoot();
  }
})();

// ═══ AUTO-UPDATE ═══
if(window.electronAPI?.onUpdaterDebug){
  window.electronAPI.onUpdaterDebug(msg=>{
    console.log('[updater]',msg);
    const t=document.createElement('div');
    t.style.cssText='position:fixed;bottom:16px;left:16px;background:#1a1a2e;border:1px solid #8b5cf6;color:#c4b5fd;font-size:11px;padding:6px 12px;border-radius:6px;z-index:9999;font-family:monospace;max-width:400px;opacity:0;transition:opacity 0.3s';
    t.textContent='[updater] '+msg;
    document.body.appendChild(t);
    requestAnimationFrame(()=>t.style.opacity='1');
    setTimeout(()=>{t.style.opacity='0';setTimeout(()=>t.remove(),400);},6000);
  });
}
if(window.electronAPI?.onUpdateAvailable){
  window.electronAPI.onUpdateAvailable(version=>{
    const b=document.getElementById('update-banner');
    if(!b)return;
    b.innerHTML=`<div class="ub-text"><strong>Update available</strong>v${version} is downloading...</div><div class="ub-actions"><button class="btn btn-sm" onclick="document.getElementById('update-banner').classList.remove('show')">✕</button></div>`;
    b.classList.add('show');
  });
}
if(window.electronAPI?.onUpdateDownloaded){
  window.electronAPI.onUpdateDownloaded(()=>{
    const b=document.getElementById('update-banner');
    if(!b)return;
    b.innerHTML=`<div class="ub-text"><strong>Update ready</strong>Restart to install the latest version.</div><div class="ub-actions"><button class="btn btn-p btn-sm" onclick="window.electronAPI.restartAndInstall()">Restart</button><button class="btn btn-sm" onclick="document.getElementById('update-banner').classList.remove('show')">Later</button></div>`;
    b.classList.add('show');
  });
}

if('serviceWorker'in navigator&&location.protocol!=='file:'){
  navigator.serviceWorker.register('./sw.js').catch(()=>{});
}