const S={get(k){try{return JSON.parse(localStorage.getItem('sb4_'+k))}catch{return null}},set(k,v){try{localStorage.setItem('sb4_'+k,JSON.stringify(v))}catch{}}};

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
  onboarded:false,userName:'',accentColor:'#8b5cf6',accentGlow:'rgba(139,92,246,0.15)',
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
  notifSettings:{bedReminder:true,bedReminderTime:'22:30',morningBrief:true,morningBriefTime:'08:00',habitReminder:true,habitReminderTime:'20:00',aiNudge:false,aiNudgeTime:'12:00'},
  notifLastSent:{bedReminder:'',morningBrief:'',habitReminder:'',aiNudge:''},
  apiKeys: { groq: '', t212: '', ytApi: '', ytClientId: '', ytClientSecret: '', ytRefreshToken: '', ytChannelId: '' },
  habitHistory: {},
  subscriptions: []
};

let confirmCb=null,renamingId=null,obSelections=[],obColor='#8b5cf6',obColorGlow='rgba(139,92,246,0.15)',bootStarAnim=null,bootWaveAnim=null,bootChatHistory=[];

function load(){
  const keys=['onboarded','userName','accentColor','accentGlow','focusAreas','sections','groqKey','defaultWage','balances','holidays','trips','shifts','examDate','uniNotes','yt','dev','devTodos','habits','fitnessGoals','fitnessNotes','goals','secTodos','setupTodos','genTodos','todayFocus','journals','customSecs','chatHistory','lastHabitReset','scheduleEvents','sleep','notifSettings','notifLastSent','apiKeys','habitHistory','subscriptions'];
  keys.forEach(k=>{const v=S.get(k);if(v!=null)st[k]=v});
  if(!st.apiKeys)st.apiKeys={groq:st.groqKey||'',t212:'',ytApi:'',ytClientId:'',ytClientSecret:'',ytRefreshToken:'',ytChannelId:''};
  if(!st.habitHistory)st.habitHistory={};
  if(!st.subscriptions)st.subscriptions=[];
  if(!st.secTodos)st.secTodos={};
  ['finance','uni','youtube','schedule','fitness','travel'].forEach(k=>{if(!st.secTodos[k])st.secTodos[k]=[];});
  if(!st.goals)st.goals=[];
  if(!st.chatHistory)st.chatHistory=[];
  if(!st.holidays||st.holidays.length<2)st.holidays=[{name:'Holiday 1',date:'',target:500,saved:0},{name:'Holiday 2',date:'',target:1000,saved:0}];
  if(!st.yt)st.yt={};
  if(st.accentColor==='#3d8ef0'){st.accentColor='#8b5cf6';st.accentGlow='rgba(139,92,246,0.15)';}
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
  if(!st.notifSettings)st.notifSettings={bedReminder:true,bedReminderTime:'22:30',morningBrief:true,morningBriefTime:'08:00',habitReminder:true,habitReminderTime:'20:00',aiNudge:false,aiNudgeTime:'12:00'};
  if(!st.notifLastSent)st.notifLastSent={bedReminder:'',morningBrief:'',habitReminder:'',aiNudge:''};
}
function save(){
  const keys=['onboarded','userName','accentColor','accentGlow','focusAreas','sections','groqKey','defaultWage','balances','holidays','trips','shifts','examDate','uniNotes','yt','dev','devTodos','habits','fitnessGoals','fitnessNotes','goals','secTodos','setupTodos','genTodos','todayFocus','journals','customSecs','chatHistory','lastHabitReset','scheduleEvents','sleep','notifSettings','notifLastSent','apiKeys','habitHistory','subscriptions'];
  keys.forEach(k=>S.set(k,st[k]));
}

// ── ENV HELPERS ──
function getGroqKey(){return st.apiKeys?.groq||st.groqKey||'';}
function emptyState(icon,msg,sub=''){return`<div class="empty"><span class="empty-icon">${icon}</span>${msg}${sub?`<span class="empty-sub">${sub}</span>`:''}</div>`;}
function setMobNav(id){document.querySelectorAll('.mnb-item').forEach(el=>el.classList.remove('active'));const el=document.getElementById('mnb-'+id);if(el)el.classList.add('active');}

const fmt=n=>'£'+Number(n).toFixed(2);
const fmtK=n=>n>=1000?(n/1000).toFixed(1)+'k':String(n);
function satDays(){const d=new Date().getDay();return d===6?7:(6-d)||7;}
function openModal(id){document.getElementById(id).classList.add('open');}
function closeModal(id){document.getElementById(id).classList.remove('open');}
document.getElementById('mc-ok').onclick=()=>{if(confirmCb)confirmCb();closeModal('modal-confirm');confirmCb=null;};
function showConfirm(t,b,cb){document.getElementById('mc-t').textContent=t;document.getElementById('mc-b').textContent=b;confirmCb=cb;openModal('modal-confirm');}

let _toastTimer;
function toast(msg){
  let el=document.getElementById('toast');
  if(!el){el=document.createElement('div');el.id='toast';document.body.appendChild(el);}
  el.textContent=msg;el.classList.add('show');
  clearTimeout(_toastTimer);_toastTimer=setTimeout(()=>el.classList.remove('show'),1800);
}
function applyColor(hex){
  const glowMap={'#8b5cf6':'rgba(139,92,246,0.15)','#3d8ef0':'rgba(61,142,240,0.15)','#2ecc8a':'rgba(46,204,138,0.12)','#f05090':'rgba(240,80,144,0.12)','#f0a832':'rgba(240,168,50,0.12)','#a855f7':'rgba(168,85,247,0.12)','#f05050':'rgba(240,80,80,0.12)'};
  const a2map={'#8b5cf6':'#a78bfa','#3d8ef0':'#5ba3ff','#2ecc8a':'#52d9a0','#f05090':'#f570a8','#f0a832':'#f5bc5a','#a855f7':'#be7cf9','#f05050':'#f57070'};
  st.accentColor=hex;st.accentGlow=glowMap[hex]||'rgba(61,142,240,0.15)';
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
  const _a2map={'#8b5cf6':'#a78bfa','#3d8ef0':'#5ba3ff','#2ecc8a':'#52d9a0','#f05090':'#f570a8','#f0a832':'#f5bc5a','#a855f7':'#be7cf9','#f05050':'#f57070'};
  obColor=color;obColorGlow=glow;
  document.documentElement.style.setProperty('--accent',color);
  document.documentElement.style.setProperty('--accent2',_a2map[color]||color);
}
function activateDanielMode(){
  st.userName='Daniel';
  st.accentColor='#8b5cf6';st.accentGlow='rgba(139,92,246,0.15)';
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
    const name=document.getElementById('ob-name').value.trim();
    if(!name){document.getElementById('ob-name').focus();return;}
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

// ═══ BOOT ═══
function startBoot(){
  const nameEl=document.getElementById('boot-name');
  if(nameEl)nameEl.textContent=st.userName;
  bootChatHistory=[];

  // Stars — orbit slowly around center, glowing
  const sc=document.getElementById('boot-stars');
  if(sc){
    sc.width=window.innerWidth;sc.height=window.innerHeight;
    const ctx=sc.getContext('2d');
    const cx=sc.width/2,cy=sc.height/2;
    const maxR=Math.hypot(cx,cy);
    const stars=Array.from({length:200},()=>({
      angle:Math.random()*Math.PI*2,
      radius:Math.random()*maxR*0.92+maxR*0.04,
      size:Math.random()*1.1+0.2,
      phase:Math.random()*Math.PI*2,
      twinkle:Math.random()*0.003+0.001,
      bright:Math.random()*0.5+0.25,
      orbitSpd:(Math.random()*0.00012+0.00004)*(Math.random()<0.5?1:-1)
    }));
    if(bootStarAnim)cancelAnimationFrame(bootStarAnim);
    function drawStars(t){
      ctx.clearRect(0,0,sc.width,sc.height);
      stars.forEach(s=>{
        s.angle+=s.orbitSpd;
        const x=cx+Math.cos(s.angle)*s.radius;
        const y=cy+Math.sin(s.angle)*s.radius;
        const a=s.bright*(0.3+0.7*Math.abs(Math.sin(t*s.twinkle*200+s.phase)));
        const g=ctx.createRadialGradient(x,y,0,x,y,s.size*4);
        g.addColorStop(0,`rgba(180,215,255,${a*0.55})`);
        g.addColorStop(1,'rgba(0,0,0,0)');
        ctx.beginPath();ctx.arc(x,y,s.size*4,0,Math.PI*2);
        ctx.fillStyle=g;ctx.fill();
        ctx.beginPath();ctx.arc(x,y,s.size,0,Math.PI*2);
        ctx.fillStyle=`rgba(225,238,255,${Math.min(a*1.6,1)})`;ctx.fill();
      });
      bootStarAnim=requestAnimationFrame(drawStars);
    }
    setTimeout(()=>{sc.classList.add('visible');requestAnimationFrame(drawStars);},100);
  }

  // Waves — wavy concentric rings radiating from center
  const wc=document.getElementById('boot-waves');
  if(wc){
    wc.width=window.innerWidth;wc.height=window.innerHeight;
    const wctx=wc.getContext('2d');
    const cx=wc.width/2,cy=wc.height/2;
    let wt=0;
    const rings=[
      {base:90, amp:10,angFreq:6, ph:0.0, spd:0.18,r:61,g:142,b:240,a:0.20},
      {base:175,amp:14,angFreq:8, ph:1.2, spd:0.14,r:91,g:163,b:255,a:0.15},
      {base:275,amp:18,angFreq:7, ph:2.4, spd:0.11,r:61,g:142,b:240,a:0.11},
      {base:390,amp:22,angFreq:9, ph:0.7, spd:0.09,r:120,g:100,b:255,a:0.09},
      {base:520,amp:26,angFreq:6, ph:3.5, spd:0.07,r:61,g:142,b:240,a:0.07},
    ];
    function drawWaves(){
      wctx.clearRect(0,0,wc.width,wc.height);
      wt+=0.005;
      rings.forEach(rng=>{
        const shimmer=0.5+0.5*Math.sin(wt*0.5+rng.ph*1.5);
        wctx.beginPath();
        const steps=360;
        for(let i=0;i<=steps;i++){
          const angle=(i/steps)*Math.PI*2;
          const r=rng.base+rng.amp*Math.sin(rng.angFreq*angle+rng.ph+wt*rng.spd);
          const x=cx+Math.cos(angle)*r;
          const y=cy+Math.sin(angle)*r;
          i===0?wctx.moveTo(x,y):wctx.lineTo(x,y);
        }
        wctx.closePath();
        wctx.strokeStyle=`rgba(${rng.r},${rng.g},${rng.b},${rng.a*shimmer})`;
        wctx.lineWidth=1;wctx.stroke();
      });
      bootWaveAnim=requestAnimationFrame(drawWaves);
    }
    setTimeout(()=>{wc.classList.add('visible');drawWaves();},1500);
  }

  // Content sequence
  const content=document.getElementById('boot-content');
  const bootSecs=document.getElementById('boot-sections');
  const bootLaunch=document.getElementById('boot-launch');

  setTimeout(()=>{if(content)content.classList.add('visible');},3500);
  setTimeout(()=>{
    const greeting=getBootMsg();
    bootChatHistory=[{role:'assistant',content:greeting}];
    const msgEl=addBootMsg('ai',greeting);
    const el=document.getElementById(msgEl);
    if(el){
      Object.assign(el.style,{opacity:'0',transform:'translateY(10px)',transition:'opacity 1.1s ease, transform 1.1s ease'});
      requestAnimationFrame(()=>requestAnimationFrame(()=>{el.style.opacity='1';el.style.transform='translateY(0)';}));
    }
    setTimeout(()=>{
      if(bootSecs){
        const secs=st.sections.filter(s=>s.visible).slice(0,9);
        const list=document.getElementById('boot-sec-list');
        if(list)list.innerHTML=secs.map(s=>`<div class="boot-sec-item" onclick="enterAppAndGo('${s.id}')"><div class="boot-sec-icon">${s.icon||'📁'}</div><div>${s.label}</div></div>`).join('');
        bootSecs.classList.add('visible');
      }
      setTimeout(()=>{if(bootLaunch)bootLaunch.classList.add('visible');},400);
    },1300);
  },4400);
}

function addBootMsg(role,text){
  const msgs=document.getElementById('boot-msgs');if(!msgs)return null;
  const id='bm-'+Date.now()+Math.floor(Math.random()*9999);
  const div=document.createElement('div');
  div.className='boot-msg '+role;div.id=id;
  if(role==='typing'){div.innerHTML='<span></span><span></span><span></span>';}
  else{div.textContent=text;}
  msgs.appendChild(div);msgs.scrollTop=msgs.scrollHeight;
  return id;
}

async function bootSend(){
  const inp=document.getElementById('boot-chat-in');if(!inp)return;
  const msg=inp.value.trim();if(!msg)return;inp.value='';
  addBootMsg('user',msg);
  bootChatHistory.push({role:'user',content:msg});
  const key=getGroqKey();
  if(!key){addBootMsg('ai','No AI key configured.');return;}
  const tid=addBootMsg('typing','');
  const r=await callGroq(bootChatHistory);
  const tEl=document.getElementById(tid);if(tEl)tEl.remove();
  const{clean:r1,sectionId}=parseNav(r||'Ready when you are.');
  const{clean,actions}=parseActions(r1);
  executeActions(actions);
  bootChatHistory.push({role:'assistant',content:clean});
  const rid=addBootMsg('ai','');
  const rEl=document.getElementById(rid);
  if(rEl)typeWrite(rEl,clean,0,sectionId?()=>setTimeout(()=>enterAppAndGo(sectionId),600):null);
  const msgs=document.getElementById('boot-msgs');
  if(msgs)msgs.scrollTop=msgs.scrollHeight;
}

function toggleBootSecs(){
  const list=document.getElementById('boot-sec-list');
  const arrow=document.getElementById('boot-sec-arrow');
  if(!list)return;
  list.classList.toggle('open');
  if(arrow)arrow.classList.toggle('open');
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
  if(st.lastHabitReset!==today){st.habits.forEach(h=>h.done=false);st.lastHabitReset=today;save();}
}
function initSchedEvents(){
  if(!st.scheduleEvents||st.scheduleEvents.length!==7){
    st.scheduleEvents=DEFAULT_SCHED_EVENTS.map(d=>d.map(e=>({...e})));save();
  }
}

function enterApp(){
  if(bootStarAnim){cancelAnimationFrame(bootStarAnim);bootStarAnim=null;}
  if(bootWaveAnim){cancelAnimationFrame(bootWaveAnim);bootWaveAnim=null;}
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
  if(getGroqKey())loadAISug();
  setTimeout(initNotifications,2000);
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
  if(el)el.classList.add('active');
  setSidebarActive(id);
  setMobNav(id);
  const titles={finance:'Finance',uni:'University',youtube:'YouTube',dev:'Dev / Side Project',schedule:'Schedule',habits:'Habits',sleep:'Sleep Tracker',fitness:'Fitness',travel:'Travel',goals:'Goals',todos:'All Todos',journal:'Journal',ai:'AI Assistant',manage:'Manage Sections',settings:'Settings'};
  const sec=st.sections.find(s=>s.id===id);
  setMainTitle(titles[id]||(sec?.label)||id);
  const s=document.getElementById('main-scroll');if(s)s.scrollTop=0;
  const renders={finance:rFinance,uni:rUni,youtube:rYT,dev:rDev,schedule:rSchedule,habits:rHabits,sleep:rSleep,fitness:rFitness,travel:rTravel,goals:rGoals,todos:rMasterTodos,journal:rJournal,ai:rAI,manage:rManage,settings:rSettings};
  if(renders[id])renders[id]();
  else rCustom(id);
}
function toggleSidebar(){
  const sb=document.getElementById('sidebar');
  const ov=document.getElementById('sb-overlay');
  sb.classList.toggle('mob-open');
  ov.classList.toggle('show');
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
    `<div class="sb-item${activePage==='ai'?' active':''}" id="sbi-ai" onclick="goPage('ai')"><span class="sb-icon">💬</span><span>AI Assistant</span></div>`+
    `<div class="sb-item${activePage==='settings'?' active':''}" id="sbi-settings" onclick="goPage('settings')"><span class="sb-icon">⚙</span><span>Settings</span></div>`;
}

// ═══ HOME ═══
function renderHome(){
  renderSidebar();
  const hr=new Date().getHours();
  const g=hr<12?'Good morning':hr<17?'Good afternoon':'Good evening';
  document.getElementById('hg').textContent=g+', '+st.userName+' 👋';
  document.getElementById('hd').textContent=new Date().toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'});
  const done=st.habits.filter(h=>h.done).length;
  const wealth=st.balances.bank+st.balances.savings+st.balances.trading;
  const days=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const evs=st.scheduleEvents&&st.scheduleEvents.length===7?st.scheduleEvents:DEFAULT_SCHED_EVENTS;
  const di=new Date().getDay();const ai=di===0?6:di-1;
  document.getElementById('home-sched').innerHTML=`<div class="overview-card" style="cursor:pointer;margin-bottom:0" onclick="goPage('schedule')"><div class="ov-label" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px"><span>📅 This week</span><span style="font-size:10px;color:var(--text3);font-weight:400;text-transform:none;letter-spacing:0">Open schedule →</span></div><div class="sg" style="gap:4px">${days.map((d,i)=>`<div class="dc ${i===ai?'today':''}" style="min-height:82px"><div class="dn">${d}</div>${(evs[i]||[]).map(e=>`<div class="de ${evClass(e.c)}">${e.t}</div>`).join('')}</div>`).join('')}</div></div>`;
  const ovStats=[];
  if(st.focusAreas.includes('finance')||wealth>0)ovStats.push(`<div class="ov-stat"><div class="ov-val">${fmt(wealth)}</div><div class="ov-lbl">Total wealth</div></div>`);
  ovStats.push(`<div class="ov-stat"><div class="ov-val">${done}/${st.habits.length}</div><div class="ov-lbl">Habits done</div></div>`);
  if(st.focusAreas.includes('youtube'))ovStats.push(`<div class="ov-stat"><div class="ov-val">${satDays()}d</div><div class="ov-lbl">Until stream</div></div>`);
  else ovStats.push(`<div class="ov-stat"><div class="ov-val">${st.goals.filter(g=>!g.done).length}</div><div class="ov-lbl">Active goals</div></div>`);
  document.getElementById('home-ov').innerHTML=`<div class="overview-card"><div class="ov-label">Today at a glance</div><div class="ov-stats">${ovStats.join('')}</div></div>`;
  const recentSleep=(st.sleep?.logs||[]).slice(-1)[0];
  const sleepSum=recentSleep?`Last night: ${sleepDuration(recentSleep.bed,recentSleep.wake).toFixed(1)}h`:'No logs yet';
  const sums={finance:`${fmt(wealth)} total`,uni:`Exam: ${st.examDate}`,youtube:`${st.yt.subs} subs · ${fmtK(st.yt.views)} views`,dev:`${st.dev.members} members · ${st.dev.status}`,schedule:`Stream in ${satDays()} days`,habits:`${done}/${st.habits.length} done today`,sleep:sleepSum,fitness:`${st.fitnessGoals.filter(g=>!g.done).length} goals active`,travel:`${st.trips.length} trip${st.trips.length!==1?'s':''} planned`,goals:`${st.goals.filter(g=>!g.done).length} active goals`,todos:`${[...st.setupTodos,...st.genTodos].filter(t=>!t.done).length} pending`,journal:`${Object.keys(st.journals).length} entries`};
  const vis=st.sections.filter(s=>s.visible);
  document.getElementById('home-grid').innerHTML=vis.map((s,i,arr)=>{const w=arr.length%2!==0&&i===arr.length-1;return`<div class="home-card${w?' wide':''}" onclick="goPage('${s.id}')"><span class="hc-icon">${s.icon||'📁'}</span><div class="hc-label">${s.label}</div><div class="hc-value">${sums[s.id]||'Tap to open'}</div><div class="hc-arrow">›</div></div>`;}).join('');
  try{updateLiveStats();}catch(e){console.error('Live stats error:',e);}
}
function updateLiveStats(){
  const done=st.habits.filter(h=>h.done).length;
  const wealth=st.balances.bank+st.balances.savings+st.balances.trading;
  const recentSleep=(st.sleep?.logs||[]).slice(-1)[0];
  const sleepHours=recentSleep?sleepDuration(recentSleep.bed,recentSleep.wake).toFixed(1):'—';
  const subs=st.yt.subs||0;
  document.getElementById('ls-subs').textContent=subs>0?fmtK(subs):'—';
  document.getElementById('ls-subs-sub').textContent=subs>0?`${fmtK(st.yt.views||0)} views`:'Log your channel ID';
  document.getElementById('ls-wealth').textContent=fmt(wealth);
  document.getElementById('ls-wealth-sub').textContent=`${fmt(st.balances.bank||0)} bank`;
  document.getElementById('ls-habits').textContent=`${done}/${st.habits.length}`;
  document.getElementById('ls-habits-sub').textContent=done===st.habits.length?'All done! 🎉':st.habits.length-done+' remaining';
  document.getElementById('ls-sleep').textContent=sleepHours+'h';
  document.getElementById('ls-sleep-sub').textContent=recentSleep?`${recentSleep.bed}→${recentSleep.wake}`:'Log first night';
}

// ═══ LIVE STATS INTERVAL ═══
let liveStatsInterval=null;
function startLiveStatsUpdates(){
  if(liveStatsInterval)clearInterval(liveStatsInterval);
  liveStatsInterval=setInterval(updateLiveStats,30000);
}
function stopLiveStatsUpdates(){
  if(liveStatsInterval){clearInterval(liveStatsInterval);liveStatsInterval=null;}
}

// ═══ AI ═══
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
  const evs=st.scheduleEvents&&st.scheduleEvents.length===7?st.scheduleEvents:[];
  const now=new Date();const di=now.getDay();const ai=di===0?6:di-1;
  const timeStr=now.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});
  const todayEvs=(evs[ai]||[]).map(e=>e.t).join(', ')||'nothing scheduled';
  const sys=`You are SychBoard AI — a personal life assistant for ${st.userName}. You have FULL access to their real data and should use it proactively. Be concise, warm, and specific. Under 120 words unless asked for detail.

=== FINANCES ===
Bank: £${st.balances.bank} | Savings: £${st.balances.savings} | Trading/Other: £${st.balances.trading} | Total wealth: £${wealth.toFixed(2)}
${t212Context()}
Upcoming shifts: ${st.shifts.slice(0,3).map(s=>`${s.date} ${s.hours}h @£${s.wage}`).join(', ')||'none logged'}
Subscriptions: ${st.subscriptions.map(s=>`${s.name} (£${s.amount} on day ${s.date})`).join(', ')||'none'}. Today is the ${now.getDate()}th. Warn them if a bill is due in the next 3 days.
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
Targets: in bed by ${st.sleep.targetBed}, goal ${st.sleep.targetHours}h

=== GOALS ===
Active (${activeGoals.length}): ${activeGoals.slice(0,6).map(g=>`[${g.category}] ${g.text}`).join(' | ')||'none'}
Completed: ${st.goals.filter(g=>g.done).length}

=== SCHEDULE ===
Today (${now.toLocaleDateString('en-GB',{weekday:'long'})}, Current Time: ${timeStr}): ${todayEvs}
Days until Saturday stream: ${satDays()}
*Note: It is currently ${timeStr}. If an event has already passed, refer to it in the past tense (e.g. "How did your 11:30 session go?"). If it is coming up, remind them to prepare.*

=== TODOS ===
Total pending: ${pendingTodos} | Today's focus: ${st.todayFocus||'not set'}

=== JOURNAL ===
Today: ${todayJournal.slice(0,200)||'nothing written today'}
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

NAVIGATION — use [NAVIGATE:sectionId] after updating data OR when user asks to open a section. IDs: ${navSections}.`;
  try{
    const res=await fetch('https://api.groq.com/openai/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+key},body:JSON.stringify({model:'llama-3.3-70b-versatile',messages:[{role:'system',content:sys},...messages],max_tokens:400,temperature:0.7})});
    const d=await res.json();
    const reply=d.choices?.[0]?.message?.content||null;
    if(reply)console.log('[groq raw]',reply);
    return reply;
  }catch(e){return null;}
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
    else if(a.type==='set_exam_date'){st.examDate=a.val;changed=true;console.log('[actions] set_exam_date',a.val);}
    else if(a.type==='add_todo'){st.genTodos.push({text:a.val,done:false});changed=true;}
    else if(a.type==='add_habit'){st.habits.push({label:a.val,done:false});changed=true;}
    else if(a.type==='add_goal'){st.goals.push({text:a.val,category:a.cat,done:false});changed=true;}
    else if(a.type==='complete_habit'){
      const wasAllDone=st.habits.length>0&&st.habits.every(x=>x.done);
      const h=st.habits.find(x=>x.label.toLowerCase().includes(a.val));
      if(h){h.done=true;changed=true;if(!wasAllDone&&st.habits.every(x=>x.done))fireConfetti();}
    }
    else if(a.type==='add_shift'&&a.hours>0){st.shifts.unshift({date:a.date,hours:a.hours,wage:a.wage||st.defaultWage});changed=true;}
    else if(a.type==='add_trip'){st.trips.push({dest:a.dest,date:a.date,budget:a.budget,done:false});changed=true;}
    else if(a.type==='set_focus'){st.todayFocus=a.val;changed=true;}
    else if(a.type==='log_sleep'){const today=new Date().toISOString().slice(0,10);const existing=st.sleep.logs.findIndex(l=>l.date===today);const entry={date:today,bed:a.bed,wake:a.wake,note:'via AI'};if(existing>=0)st.sleep.logs[existing]=entry;else st.sleep.logs.push(entry);changed=true;}
  });
  if(changed)save();
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
  if(el)el.textContent=clean;
  if(sectionId)setTimeout(()=>goPage(sectionId), 400);
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
      st.balances.bank>0?`My bank balance is now ${fmt(st.balances.bank+100)}`:'Set my bank balance to £1,500',
      st.yt.subs>0?`I just hit ${st.yt.subs+50} subscribers`:'I hit 500 subscribers today',
      `Add a todo to ${['review my notes','check my goals','update my budget'][new Date().getDay()%3]}`,
      st.focusAreas.includes('youtube')?'How close am I to YouTube monetisation?':'What should I focus on today?',
      `What should I focus on today?`,
      st.examDate&&st.examDate!=='TBC'?`How long until my exam on ${st.examDate}?`:'Set my exam date to 15 June',
    ].slice(0,5);
    chips.innerHTML=prompts.map(s=>`<div class="prompt-item" onclick="document.getElementById('chat-in').value=this.textContent;document.getElementById('chat-in').focus()">${s}</div>`).join('');
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

// ═══ SETTINGS ═══
function rSettings(){
  const ni=document.getElementById('name-in');if(ni)ni.value=st.userName||'';
  const wi=document.getElementById('wage-in');if(wi)wi.value=st.defaultWage||10;
  const sw=document.getElementById('accent-swatches');
  if(sw){
    const cols=['#8b5cf6','#3d8ef0','#2ecc8a','#f05090','#f0a832','#f05050'];
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
    ns.innerHTML=
      row('notif-bed','🌙 Bedtime reminder','bedReminder','bedReminderTime')+
      row('notif-morning','☀️ Morning brief','morningBrief','morningBriefTime')+
      row('notif-habit','✅ Habit check-in','habitReminder','habitReminderTime')+
      row('notif-nudge','💡 AI nudge (needs AI key)','aiNudge','aiNudgeTime')+
      `<div style="display:flex;gap:8px;margin-top:10px"><button class="btn btn-p btn-sm" onclick="saveNotifSettings()">Save notification settings</button><button class="btn btn-sm" onclick="testNotif()">Send test</button></div>`;
    document.getElementById('set-inj').innerHTML = `<div class="si"><div class="sl">Groq API key</div><div class="ss">Powers all AI features. Get a free key at console.groq.com</div><input type="password" id="groq-key-in" placeholder="gsk_..." value="${st.apiKeys.groq||''}" style="margin-top:8px"><button class="btn btn-p btn-sm" style="margin-top:8px" onclick="saveGroqKey()">Save</button></div>${devPanel}`;
  }
}
function saveGroqKey(){
  const v=document.getElementById('groq-key-in').value.trim();
  if(!v)return;
  st.apiKeys.groq=v;save();
  toast('Groq API key saved');
}
function saveDevKeys() {
  st.apiKeys.t212 = document.getElementById('dev-t212').value.trim();
  st.apiKeys.ytChannelId = document.getElementById('dev-yt-chan').value.trim();
  st.apiKeys.ytApi = document.getElementById('dev-yt-api').value.trim();
  st.apiKeys.ytClientId = document.getElementById('dev-yt-id').value.trim();
  st.apiKeys.ytClientSecret = document.getElementById('dev-yt-sec').value.trim();
  save(); toast('Developer keys saved!');
  if(st.apiKeys.ytChannelId) fetchYTData();
}
function exportData(){
  const data={};
  for(let i=0;i<localStorage.length;i++){
    const k=localStorage.key(i);if(k.startsWith('sb4_'))data[k]=localStorage.getItem(k);
  }
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download=`sychboard-backup-${new Date().toISOString().slice(0,10)}.json`;
  a.click();URL.revokeObjectURL(url);toast('Backup exported!');
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
    t212Cache={error:'Invalid API key — check TRADING212_API_KEY in .env',fetchedAt:Date.now()};
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
  st.holidays[i]={name:document.getElementById('hn-'+i).value||st.holidays[i].name,date:document.getElementById('hd-'+i).value||'',target:parseFloat(document.getElementById('ht-'+i).value)||0,saved:parseFloat(document.getElementById('hs-'+i).value)||0};
  save();rFinance();
}
function updateBal(){const k=document.getElementById('bal-sel').value;const v=parseFloat(document.getElementById('bal-amt').value)||0;st.balances[k]=v;document.getElementById('bal-amt').value='';save();rFinance();toast('Balance updated');}
function rShifts(){
  const el=document.getElementById('shift-list');if(!el)return;
  if(!st.shifts.length){el.innerHTML=emptyState('💼','No shifts logged yet','Add your first shift above');document.getElementById('shift-totals').innerHTML='';return;}
  el.innerHTML=st.shifts.map((s,i)=>`<div class="shi"><span style="font-weight:600">${s.date}</span><span style="color:var(--text2)">${s.hours}h @ ${fmt(s.wage)}/hr</span><span style="color:var(--green);font-weight:700">${fmt(s.hours*s.wage)}</span><button class="btn btn-sm" style="color:var(--red);border-color:var(--red);background:var(--red-light)" onclick="rmShift(${i})">✕</button></div>`).join('');
  const all=st.shifts.reduce((a,s)=>a+s.hours*s.wage,0);
  const now=new Date();const ms=new Date(now.getFullYear(),now.getMonth(),1);
  const mon=st.shifts.filter(s=>new Date(s.date+' '+now.getFullYear())>=ms).reduce((a,s)=>a+s.hours*s.wage,0);
  document.getElementById('shift-totals').innerHTML=`<div class="metric"><div class="ml">All time</div><div class="mv">${fmt(all)}</div></div><div class="metric"><div class="ml">This month</div><div class="mv green">${fmt(mon)}</div></div>`;
}
function addShift(){const d=document.getElementById('sh-d').value.trim();const h=parseFloat(document.getElementById('sh-h').value)||0;const w=parseFloat(document.getElementById('sh-w').value)||st.defaultWage;if(!d||!h)return;st.shifts.unshift({date:d,hours:h,wage:w});document.getElementById('sh-d').value='';document.getElementById('sh-h').value='';save();rShifts();}
function rmShift(i){st.shifts.splice(i,1);save();rShifts();}

function rSubs(){
  const el=document.getElementById('subs-list');if(!el)return;
  el.innerHTML=st.subscriptions.length?st.subscriptions.map((s,i)=>`<div class="row"><span class="rl" style="font-weight:600">${s.name} <span style="font-size:10px;color:var(--text3);font-weight:500;margin-left:4px">Day ${s.date}</span></span><div style="display:flex;align-items:center;gap:12px"><span class="rv">${fmt(s.amount)}</span><button class="del-btn" style="margin:0" onclick="st.subscriptions.splice(${i},1);save();rSubs()">✕</button></div></div>`).join(''):emptyState('💳','No bills tracked yet');
}
function addSub(){const n=document.getElementById('sub-name').value.trim();const a=parseFloat(document.getElementById('sub-amt').value);const d=parseInt(document.getElementById('sub-day').value);if(!n||!a||!d)return;st.subscriptions.push({name:n,amount:a,date:d});document.getElementById('sub-name').value='';document.getElementById('sub-amt').value='';document.getElementById('sub-day').value='';save();rSubs();}

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
function updateExamDate(){st.examDate=document.getElementById('exam-in').value||'TBC';save();rUni();toast('Exam date saved');}
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
  if(!st.yt.weekChecks||st.yt.weekChecks.length!==YT_CHECKS.length)st.yt.weekChecks=YT_CHECKS.map(()=>false);
  document.getElementById('yt-checklist').innerHTML=YT_CHECKS.map((item,i)=>`<div class="todo-item ${st.yt.weekChecks[i]?'checked':''}"><input type="checkbox" ${st.yt.weekChecks[i]?'checked':''} onchange="st.yt.weekChecks[${i}]=this.checked;save();this.closest('.todo-item').classList.toggle('checked',this.checked)"><span>${item}</span></div>`).join('');
  rSecTodos('youtube');
  if(st.yt.apiVideos?.length)renderYTVideos({videos:st.yt.apiVideos});
  if(!ytApiCache||ytApiCache.error||Date.now()-ytApiCache.fetchedAt>5*60*1000)fetchYTData();
  else if(!!st.apiKeys.ytRefreshToken&&!st.yt.impressions28d)fetchYTAnalytics();
  else renderYTVideos(ytApiCache);
}
function updateYT(){const s=parseInt(document.getElementById('yt-si').value);const v=parseInt(document.getElementById('yt-vi').value);const h=parseInt(document.getElementById('yt-hi').value);if(s)st.yt.subs=s;if(v)st.yt.views=v;if(h)st.yt.hours=h;save();rYT();toast('Stats updated');}
let ytApiCache=null;
async function fetchYTData(){
  const channelId=st.apiKeys.ytChannelId;
  const ytFetch=(path)=>window.electronAPI?.fetchYouTube(path, st.apiKeys.ytApi);
  const vidEl=document.getElementById('yt-videos');
  if(!ytFetch){if(vidEl)vidEl.innerHTML='<div class="empty" style="font-size:12px;color:var(--text3)">Live stats require the desktop app</div>';return;}
  if(!channelId){if(vidEl)vidEl.innerHTML='<div class="empty" style="font-size:12px;color:var(--text3)">Set YOUTUBE_CHANNEL_ID in .env</div>';return;}
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
  el.innerHTML=data.videos.map(v=>`<div style="padding:8px 0;border-bottom:1px solid var(--border)"><div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:4px;line-height:1.3">${v.title}</div><div style="display:flex;gap:12px;font-size:12px;color:var(--text2)"><span style="color:var(--accent2)">${fmtK(v.views)} views</span><span>👍 ${fmtK(v.likes)}</span><span>💬 ${fmtK(v.comments)}</span><span style="margin-left:auto;color:var(--text3)">${v.published}</span></div></div>`).join('');
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
function updateDev(){const m=parseInt(document.getElementById('dev-m1i').value);if(m)st.dev.members=m;st.dev.status=document.getElementById('dev-si').value;save();rDev();toast('Project updated');}
function addDevTodo(){const v=document.getElementById('dev-ti').value.trim();if(!v)return;st.devTodos.push({text:v,done:false});document.getElementById('dev-ti').value='';save();rDev();}

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
  const txt=document.getElementById('sched-ev-txt').value.trim();
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
    for(let i=29;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);days.push(d.toISOString().slice(0,10));}
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
function recordHabitHistory(){const today=new Date().toISOString().slice(0,10);const done=st.habits.filter(h=>h.done).length;const total=st.habits.length||1;st.habitHistory[today]={d:done,t:total};}
function togHabit(i){
  const wasAllDone=st.habits.length>0&&st.habits.every(h=>h.done);
  st.habits[i].done=!st.habits[i].done;save();rHabits();
  if(!wasAllDone&&st.habits.every(h=>h.done))fireConfetti();
  recordHabitHistory();save();rHabits();
}
function rmHabit(i){st.habits.splice(i,1);save();rHabits();}
function addHabit(){const v=document.getElementById('new-habit-in').value.trim();if(!v)return;st.habits.push({label:v,done:false});document.getElementById('new-habit-in').value='';save();rHabits();}
function resetHabits(){st.habits.forEach(h=>h.done=false);recordHabitHistory();save();rHabits();}

// ═══ FITNESS ═══
function rFitness(){
  const fn=document.getElementById('fitness-notes');if(fn)fn.value=st.fitnessNotes||'';
  const fl=document.getElementById('fitness-goals-list');
  if(fl)fl.innerHTML=st.fitnessGoals.length?st.fitnessGoals.map((g,i)=>`<div class="gi ${g.done?'done':''}"><div class="gc" onclick="st.fitnessGoals[${i}].done=!st.fitnessGoals[${i}].done;save();rFitness()">${g.done?'✓':''}</div><span class="gt">${g.text}</span><button class="del-btn" onclick="st.fitnessGoals.splice(${i},1);save();rFitness()">✕</button></div>`).join(''):'<div class="empty">No goals yet</div>';
  rSecTodos('fitness');
}
function addFitnessGoal(){const v=document.getElementById('fg-in').value.trim();if(!v)return;st.fitnessGoals.push({text:v,done:false});document.getElementById('fg-in').value='';save();rFitness();}

// ═══ TRAVEL ═══
function rTravel(){
  const tl=document.getElementById('trips-list');
  if(tl)tl.innerHTML=st.trips.length?st.trips.map((t,i)=>`<div class="gi"><div class="gc" onclick="st.trips[${i}].done=!st.trips[${i}].done;save();rTravel()">${t.done?'✓':''}</div><div style="flex:1"><div class="gt">${t.dest}</div><div style="font-size:11px;color:var(--text2)">${t.date} · Budget: ${fmt(t.budget)}</div></div><button class="del-btn" onclick="st.trips.splice(${i},1);save();rTravel()">✕</button></div>`).join(''):emptyState('✈️','No trips planned yet','Add your next adventure below');
  rSecTodos('travel');
}
function addTrip(){const d=document.getElementById('trip-dest').value.trim();const dt=document.getElementById('trip-date').value.trim();const b=parseFloat(document.getElementById('trip-budget').value)||0;if(!d)return;st.trips.push({dest:d,date:dt,budget:b,done:false});document.getElementById('trip-dest').value='';document.getElementById('trip-date').value='';document.getElementById('trip-budget').value='';save();rTravel();}

// ═══ GOALS ═══
function rGoals(){
  const active=st.goals.filter(g=>!g.done).length;
  const gc=document.getElementById('goals-count');if(gc)gc.textContent=active+' active';
  const cats={'life':'chip-g','fitness':'chip-g','finance':'chip-b','youtube':'chip-a','uni':'chip-b','dev':'chip-a'};
  document.getElementById('goals-list').innerHTML=st.goals.length?st.goals.map((g,i)=>`<div class="gi ${g.done?'done':''}"><div class="gc" onclick="st.goals[${i}].done=!st.goals[${i}].done;save();rGoals()">${g.done?'✓':''}</div><span class="gt">${g.text}</span><span class="chip ${cats[g.category]||'chip-b'}">${g.category}</span><button class="del-btn" onclick="st.goals.splice(${i},1);save();rGoals()">✕</button></div>`).join(''):emptyState('🎯','No goals yet','What are you working toward?');
}
function addGoal(){const t=document.getElementById('goal-in').value.trim();const c=document.getElementById('goal-cat').value;if(!t)return;st.goals.push({text:t,category:c,done:false});document.getElementById('goal-in').value='';save();rGoals();}

// ═══ TODOS ═══
function rSecTodos(sec){
  if(!st.secTodos[sec])st.secTodos[sec]=[];
  const el=document.getElementById('todos-'+sec);if(!el)return;
  el.innerHTML=st.secTodos[sec].length?st.secTodos[sec].map((t,i)=>`<div class="todo-item ${t.done?'checked':''}"><input type="checkbox" ${t.done?'checked':''} onchange="st.secTodos['${sec}'][${i}].done=this.checked;save()"><span>${t.text}</span><button class="del-btn" onclick="st.secTodos['${sec}'].splice(${i},1);save();rSecTodos('${sec}')">✕</button></div>`).join(''):'<div class="empty">No todos yet</div>';
}
function addSecTodo(sec){const inp=document.getElementById('ti-'+sec);if(!inp||!inp.value.trim())return;if(!st.secTodos[sec])st.secTodos[sec]=[];st.secTodos[sec].push({text:inp.value.trim(),done:false});inp.value='';save();rSecTodos(sec);}
function rMasterTodos(){
  const secs=['finance','uni','youtube','schedule','fitness','travel'];
  const labs={finance:'Finance',uni:'Uni',youtube:'YouTube',schedule:'Schedule',fitness:'Fitness',travel:'Travel'};
  let html='';
  if(st.setupTodos.length)html+=`<div class="card"><div class="card-title">Setup</div>${st.setupTodos.map((t,i)=>`<div class="todo-item ${t.done?'checked':''}"><input type="checkbox" ${t.done?'checked':''} onchange="st.setupTodos[${i}].done=this.checked;save()"><span>${t.text}</span></div>`).join('')}</div>`;
  secs.forEach(s=>{const todos=st.secTodos[s]||[];if(!todos.length)return;const p=todos.filter(t=>!t.done).length;html+=`<div class="card"><div class="card-header"><div class="card-title" style="margin-bottom:0">${labs[s]}</div><span class="chip chip-b">${p} pending</span></div>${todos.map((t,i)=>`<div class="todo-item ${t.done?'checked':''}"><input type="checkbox" ${t.done?'checked':''} onchange="st.secTodos['${s}'][${i}].done=this.checked;save()"><span>${t.text}</span><button class="del-btn" onclick="st.secTodos['${s}'].splice(${i},1);save();rMasterTodos()">✕</button></div>`).join('')}</div>`;});
  html+=`<div class="card"><div class="card-header"><div class="card-title" style="margin-bottom:0">General</div></div>${st.genTodos.length?st.genTodos.map((t,i)=>`<div class="todo-item ${t.done?'checked':''}"><input type="checkbox" ${t.done?'checked':''} onchange="st.genTodos[${i}].done=this.checked;save()"><span>${t.text}</span><button class="del-btn" onclick="st.genTodos.splice(${i},1);save();rMasterTodos()">✕</button></div>`).join(''):'<div class="empty">No todos yet</div>'}<div class="ta-row"><input type="text" id="gen-ti" placeholder="Add general todo..." style="flex:1"><button class="btn btn-p btn-sm" onclick="addGenTodo()">Add</button></div></div>`;
  document.getElementById('master-todos').innerHTML=html||'<div class="card"><div class="empty">No todos yet</div></div>';
}
function addGenTodo(){const inp=document.getElementById('gen-ti');if(!inp||!inp.value.trim())return;st.genTodos.push({text:inp.value.trim(),done:false});inp.value='';save();rMasterTodos();}

// ═══ JOURNAL ═══
function rJournal(){
  const today=new Date().toDateString();
  const jt=document.getElementById('journal-title');if(jt)jt.textContent='Today — '+today;
  const jx=document.getElementById('journal-text');if(jx)jx.value=st.journals[today]||'';
  const past=Object.entries(st.journals).filter(([k])=>k!==today).reverse().slice(0,7);
  const pj=document.getElementById('past-journals');
  if(pj)pj.innerHTML=past.length?past.map(([date,text])=>`<div style="margin-bottom:14px;padding-bottom:14px;border-bottom:1px solid var(--border)"><div style="font-size:11px;font-weight:600;color:var(--text2);margin-bottom:5px">${date}</div><div style="font-size:13px;color:var(--text2);line-height:1.6">${parseMD(text)}</div></div>`).join(''):emptyState('📓','No past entries yet','Your reflections will appear here');
}
function saveJournal(){const today=new Date().toDateString();st.journals[today]=document.getElementById('journal-text').value;save();rJournal();}

// ═══ MANAGE ═══
function rManage(){
  document.getElementById('manage-list').innerHTML=st.sections.map(s=>{
    const delBtn=!s.core?`<button class="btn btn-sm btn-d" onclick="promptDelSec('${s.id}')">Delete</button>`:'';
    return`<div class="mi"><div><div style="font-size:14px;font-weight:600;color:var(--text)">${s.icon||'📁'} ${s.label}</div><div style="font-size:10px;color:var(--text3);margin-top:2px">${s.core?'Core':'Custom'} · ${s.visible?'Visible':'Hidden'}</div></div><div class="mi-actions"><button class="btn btn-sm" onclick="openRename('${s.id}')">Rename</button><button class="btn btn-sm" onclick="togVis('${s.id}')">${s.visible?'Hide':'Show'}</button>${delBtn}</div></div>`;
  }).join('');
}
function togVis(id){const s=st.sections.find(x=>x.id===id);if(s)s.visible=!s.visible;save();rManage();}
function openRename(id){renamingId=id;const s=st.sections.find(x=>x.id===id);document.getElementById('rename-val').value=s?s.label:'';openModal('modal-rename');}
function doRename(){if(!renamingId)return;const name=document.getElementById('rename-val').value.trim();const s=st.sections.find(x=>x.id===renamingId);if(s&&name)s.label=name;save();closeModal('modal-rename');rManage();renamingId=null;}
function doAddSec(){const name=document.getElementById('add-name').value.trim();const type=document.getElementById('add-type').value;const icon=document.getElementById('add-icon').value||'📁';if(!name)return;const id='cs_'+Date.now();st.sections.push({id,label:name,icon,core:false,visible:true,type});st.customSecs[id]={name,type,todos:[],notes:'',trackers:[]};document.getElementById('add-name').value='';document.getElementById('add-icon').value='';save();closeModal('modal-add');goHome();}
function promptDelSec(id){showConfirm('Delete section?','Permanently deletes this section and all its data.',()=>{st.sections=st.sections.filter(x=>x.id!==id);delete st.customSecs[id];save();rManage();goHome();});}

// ═══ CUSTOM ═══
function rCustom(id){
  const cs=st.customSecs[id];const sec=st.sections.find(s=>s.id===id);if(!cs||!sec)return;
  const pg=document.getElementById('page-custom');
  const hdr=`<div class="sc">`;
  if(cs.type==='notes'||cs.type==='freeform'){
    pg.innerHTML=hdr+`<div class="card"><div class="card-title">Notes</div><textarea id="cs-n-${id}" style="min-height:160px">${cs.notes||''}</textarea><button class="btn btn-p btn-sm" style="margin-top:8px" onclick="st.customSecs['${id}'].notes=document.getElementById('cs-n-${id}').value;save()">Save</button></div>`+(cs.type==='notes'?`<div class="card"><div class="card-title">Todos</div><div id="cs-tl-${id}">${(cs.todos||[]).map((t,i)=>`<div class="todo-item ${t.done?'checked':''}"><input type="checkbox" ${t.done?'checked':''} onchange="st.customSecs['${id}'].todos[${i}].done=this.checked;save()"><span>${t.text}</span><button class="del-btn" onclick="st.customSecs['${id}'].todos.splice(${i},1);save();rCustom('${id}')">✕</button></div>`).join('')||'<div class="empty">No todos yet</div>'}</div><div class="ta-row"><input type="text" id="cs-ti-${id}" placeholder="Add todo..." style="flex:1"><button class="btn btn-p btn-sm" onclick="addCsTodo('${id}')">Add</button></div></div>`:'')+`</div>`;
  } else {
    pg.innerHTML=hdr+`<div class="card"><div class="card-title">Trackers</div><div class="mr2">${(cs.trackers||[]).map((t,i)=>`<div class="metric" style="position:relative"><div class="ml">${t.label}</div><div class="mv">${t.value}${t.suffix||''}</div><button onclick="st.customSecs['${id}'].trackers.splice(${i},1);save();rCustom('${id}')" style="position:absolute;top:5px;right:5px;background:none;border:none;cursor:pointer;color:var(--text3);font-size:12px">✕</button></div>`).join('')||'<div style="font-size:12px;color:var(--text2)">No trackers yet</div>'}</div><div class="ir3" style="gap:8px;margin-top:10px"><div><div class="fl">Label</div><input type="text" id="cs-tl-${id}" placeholder="Weight"></div><div><div class="fl">Value</div><input type="text" id="cs-tv-${id}" placeholder="75"></div><div><div class="fl">Suffix</div><input type="text" id="cs-ts-${id}" placeholder="kg"></div></div><button class="btn btn-p btn-sm" style="margin-top:8px" onclick="addCsTracker('${id}')">Add tracker</button></div></div>`;
  }
}
function addCsTodo(id){const inp=document.getElementById('cs-ti-'+id);if(!inp||!inp.value.trim())return;st.customSecs[id].todos.push({text:inp.value.trim(),done:false});inp.value='';save();rCustom(id);}
function addCsTracker(id){const l=document.getElementById('cs-tl-'+id);const v=document.getElementById('cs-tv-'+id);const s=document.getElementById('cs-ts-'+id);if(!l||!l.value.trim())return;st.customSecs[id].trackers.push({label:l.value.trim(),value:v?v.value:'',suffix:s?s.value:''});l.value='';if(v)v.value='';if(s)s.value='';save();rCustom(id);}

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
  if(bedM<6*60)bedM+=1440;
  if(dur<6||bedM>25*60)return'poor';
  if(dur<7||bedM>23*60+30)return'ok';
  return'good';
}
function sleepConsistency(logs){
  if(logs.length<2)return 100;
  const mins=logs.map(l=>{const[h,m]=l.bed.split(':').map(Number);let v=h*60+m;if(v<6*60)v+=1440;return v;});
  const mean=mins.reduce((a,b)=>a+b,0)/mins.length;
  const std=Math.sqrt(mins.reduce((a,b)=>a+(b-mean)**2,0)/mins.length);
  return Math.max(0,Math.round(100-std*1.2));
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
  const note=document.getElementById('sleep-note')?.value?.trim()||'';
  if(!bed||!wake){toast('Enter bed and wake times');return;}
  const today=new Date().toISOString().slice(0,10);
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
  const cut=cutoff.toISOString().slice(0,10);
  st.sleep.logs=st.sleep.logs.filter(l=>l.date>=cut);
  save();rSleep();toast('Old logs cleared');
}
function renderSleepChart(){
  const el=document.getElementById('sleep-chart');if(!el)return;
  const days=[];
  for(let i=6;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);days.push(d.toISOString().slice(0,10));}
  const logMap={};(st.sleep.logs||[]).forEach(l=>{logMap[l.date]=l;});
  const dayNames=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const today=new Date().toISOString().slice(0,10);
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
  const today=new Date().toISOString().slice(0,10);
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
function initNotifications(){
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
  save();toast('Notification settings saved');
}
function testNotif(){
  if(Notification.permission==='denied'){toast('Notifications blocked — allow in browser settings');return;}
  sendNotif('🧪 SychBoard Notifications Active',`You'll receive reminders at the times you set.`);
}

// ═══ POMODORO & FX ═══
let pomT=null,pomL=25*60,pomR=false,pomM='focus';
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
  pomL=pomM==='focus'?25*60:5*60;
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
applyColor(st.accentColor||'#8b5cf6');
if(!st.onboarded){
  document.getElementById('boot').style.display='none';
  document.getElementById('onboarding').classList.add('show');
  updateObProgress();
} else {
  startBoot();
}

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