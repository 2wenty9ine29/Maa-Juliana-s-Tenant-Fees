const APP_VERSION='2.3.5.32';
const SUPABASE_URL='https://nhekfxjmiaoiepesxexr.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_vOBCGhul6_CjvCur1VrjoQ_WQFeLWK5';
let supabaseClient=null, cloudUser=null, cloudSyncTimer=null, cloudSyncBusy=false, applyingCloud=false, cloudChannel=null;
const DB_NAME='mad-juliana-tenants-db';
const DB_STORE='app';
const DB_KEY='state';
const KEY='mad-juliana-tenants-v1';
const $=id=>document.getElementById(id);
let today=new Date();
const pad=n=>String(n).padStart(2,'0');
const iso=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const fmtDate=s=>{if(!s)return '—';const d=new Date(`${s}T00:00:00`);return d.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}).replace(/ /g,' ')};
const addMonths=(date,n)=>{const d=new Date(date+'T00:00:00');const day=d.getDate();d.setDate(1);d.setMonth(d.getMonth()+n);const last=new Date(d.getFullYear(),d.getMonth()+1,0).getDate();d.setDate(Math.min(day,last));return iso(d)};
const daysInMonth=s=>{const d=new Date(s+'T00:00:00');return new Date(d.getFullYear(),d.getMonth()+1,0).getDate()};
const addDays=(date,n)=>{const d=new Date(date+'T00:00:00');d.setDate(d.getDate()+n);return iso(d)};
const daysBetween=(a,b)=>{const x=new Date(a+'T00:00:00'),y=new Date(b+'T00:00:00');return Math.round((Date.UTC(y.getFullYear(),y.getMonth(),y.getDate())-Date.UTC(x.getFullYear(),x.getMonth(),x.getDate()))/86400000)};
const round2=n=>Math.round((Number(n)+Number.EPSILON)*100)/100;
const rateOf=(p,t)=>Number(p?.monthlyRate)||Number(t?.rate)||0;
const coverageStart=t=>t.end||t.start||iso(today);
function customCoverage(start,amount,rate){
  const safeRate=Number(rate)||0;const paid=Number(amount)||0;
  if(!safeRate||paid<=0||!start)return {months:0,days:0,end:start};
  const x=paid/safeRate+0.005/safeRate+1e-9; // half-a-cent tolerance so rounded amounts still give whole months
  const months=Math.floor(x);const remainder=x-months;
  const afterMonths=addMonths(start,months);
  const days=Math.floor(remainder*daysInMonth(afterMonths)+1e-9);
  return {months,days,end:addDays(afterMonths,days)};
}
function coverageBetween(start,end){
  if(!start||!end||end<=start)return {months:0,days:0};
  const a=new Date(start+'T00:00:00'),b=new Date(end+'T00:00:00');
  let m=(b.getFullYear()-a.getFullYear())*12+b.getMonth()-a.getMonth();
  while(m>0&&addMonths(start,m)>end)m--;
  return {months:m,days:daysBetween(addMonths(start,m),end)};
}
function amountForCoverage(rate,start,months,days){
  const r=Number(rate)||0;const after=addMonths(start,months);const dim=daysInMonth(after);
  const exact=months+(days>0?days/dim:0);
  return Math.ceil(r*exact*100-1e-6)/100;
}
const coverageLabel=(months,days)=>{const parts=[];if(months)parts.push(`${months} month${months===1?'':'s'}`);if(days)parts.push(`${days} day${days===1?'':'s'}`);return parts.join(' + ')||'0 days'};
const monthDiff=(a,b)=>{const x=new Date(a+'T00:00:00'),y=new Date(b+'T00:00:00');return Math.max(0,(y.getFullYear()-x.getFullYear())*12+y.getMonth()-x.getMonth())};
const money=(n,c='GHS')=>new Intl.NumberFormat('en-US',{style:'currency',currency:c,minimumFractionDigits:2}).format(Number(n)||0).replace('GHS','GHS').replace('USD','$');
const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

const original={
  tenants:[
    {id:'eudia',name:'Eudia Agyei (Nurse)',currency:'GHS',rate:160,phone:'',start:'2026-03-01',end:'2027-03-01'},
    {id:'emmanuella-afriyie',name:'Emmanuella Afriyie',currency:'USD',rate:250,phone:'',start:'2026-04-01',end:'2027-04-01'},
    {id:'stephen',name:'Stephen Awonu (Borga)',currency:'GHS',rate:160,phone:'',start:'2026-01-01',end:'2027-01-08'},
    {id:'emmanuella-osei',name:'Emmanuella Osei',currency:'GHS',rate:170,phone:'',start:'2026-06-01',end:'2027-06-01'}
  ],
  payments:[
    {id:'p-eudia',tenantId:'eudia',amount:1920,currency:'GHS',months:12,start:'2026-03-01',end:'2027-03-01',date:'2026-03-01',note:'Original tenancy payment'},
    {id:'p-afriyie',tenantId:'emmanuella-afriyie',amount:3000,currency:'USD',months:12,start:'2026-04-01',end:'2027-04-01',date:'2026-04-01',note:'Original tenancy payment'},
    {id:'p-stephen',tenantId:'stephen',amount:965,currency:'GHS',months:6,start:'2026-01-01',end:'2026-07-01',date:'2026-01-01',note:'Original tenancy payment · GHS 1,900 − GHS 935'},
    {id:'p-stephen-1000',tenantId:'stephen',amount:1000,currency:'GHS',months:6,days:7,start:'2026-07-01',end:'2027-01-08',date:'2026-10-06',note:'Payment received · GHS 1,000 · Borga'},
    {id:'p-osei',tenantId:'emmanuella-osei',amount:2040,currency:'GHS',months:12,start:'2026-06-01',end:'2027-06-01',date:'2026-06-01',note:'Original tenancy payment'}
  ]
};
let data=load();
if(!Array.isArray(data.ecgBills)) data.ecgBills=[];
function migrateV217(){
  let changed=false;
  const e=tenant('eudia'); if(e && e.name==='Eudia Agyei'){e.name='Eudia Agyei (Nurse)';changed=true}
  const st=tenant('stephen'); if(st && st.name==='Stephen Awonu'){st.name='Stephen Awonu (Borga)';changed=true}
  if(st){
    const hasBorgaPayment=data.payments.some(p=>p.tenantId==='stephen' && Number(p.amount)===1000 && p.currency==='GHS');
    if(!hasBorgaPayment){
      const start=st.end;
      const calc=customCoverage(start,1000,st.rate);
      data.payments.push({id:'p-stephen-1000',tenantId:'stephen',amount:1000,currency:'GHS',months:calc.months,days:calc.days,start,end:calc.end,date:'2026-10-06',note:'Payment received · GHS 1,000 · Borga'});
      st.end=calc.end;
      changed=true;
    } else {
      const latest=[...data.payments].filter(p=>p.tenantId==='stephen' && Number(p.amount)===1000 && p.currency==='GHS').sort((a,b)=>(b.date||'').localeCompare(a.date||''))[0];
      if(latest && st.end<latest.end){st.end=latest.end;changed=true}
    }
  }
  if(changed){data.updatedAt=new Date().toISOString();try{localStorage.setItem(KEY,JSON.stringify(data))}catch{};}
}
migrateV217();
function makeInitialPayment(t,amountOverride){
  const rate=Number(t.rate)||0;if(!(rate>0)||!t.start||!t.end||t.end<=t.start)return null;
  const useAmount=Number(amountOverride)>0;
  const cov=useAmount?customCoverage(t.start,amountOverride,rate):coverageBetween(t.start,t.end);
  const end=useAmount?cov.end:t.end;
  const amount=useAmount?round2(amountOverride):amountForCoverage(rate,t.start,cov.months,cov.days);
  return {id:'p-'+Date.now()+'-'+Math.random().toString(36).slice(2,6),tenantId:t.id,amount,netAmount:amount,currency:t.currency||'GHS',monthlyRate:rate,months:cov.months,days:cov.days,start:t.start,end,date:t.start<=iso(today)?t.start:iso(today),note:'Initial payment'};
}
function backfillPayments(){
  let n=0;
  data.tenants.forEach(t=>{if(data.payments.some(p=>p.tenantId===t.id))return;const p=makeInitialPayment(t);if(p){data.payments.push(p);n++}});
  return n;
}
function runMigrations(){
  let changed=false;
  if(!Array.isArray(data.payments)){data.payments=[];changed=true}
  if(!Array.isArray(data.ecgBills)){data.ecgBills=[];changed=true}
  // Stephen's January payment was recorded as ending 1 Jun although it is 6 months from 1 Jan; the next payment started 1 Jun instead of 1 Jul.
  const ps=data.payments.find(p=>p.id==='p-stephen');if(ps&&ps.start==='2026-01-01'&&ps.end==='2026-06-01'&&Number(ps.months)===6){ps.end='2026-07-01';changed=true}
  const pb=data.payments.find(p=>p.id==='p-stephen-1000');if(pb&&pb.start==='2026-06-01'&&pb.end==='2027-01-08'){pb.start='2026-07-01';changed=true}
  // Remember the monthly rate each payment was made at, so later rate changes do not rewrite old receipts or ECG maths.
  data.payments.forEach(p=>{if(!Number(p.monthlyRate)){const t=tenant(p.tenantId);if(t&&Number(t.rate)>0){p.monthlyRate=Number(t.rate);changed=true}}});
  // Residents with no payment record get one, so they appear in Payments and can receive ECG bills.
  if(backfillPayments()>0)changed=true;
  if(changed)data.updatedAt=new Date().toISOString();
  return changed;
}
if(runMigrations()){try{localStorage.setItem(KEY,JSON.stringify(data))}catch{}}
let storageReady=false;
let storageLastSaved=null;
let currentView='home', selectedTenant=null, lastReceipt=null, undoTimer=null, undoFn=null, pendingPriceUpdate=null;
function clone(x){return JSON.parse(JSON.stringify(x))}
function load(){try{const x=JSON.parse(localStorage.getItem(KEY));if(x?.tenants?.length)return x}catch{}return clone(original)}
function openStateDB(){return new Promise((resolve,reject)=>{if(!('indexedDB' in window)){reject(new Error('IndexedDB unavailable'));return}const req=indexedDB.open(DB_NAME,1);req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(DB_STORE))db.createObjectStore(DB_STORE)};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error||new Error('Could not open local database'))})}
async function readStateDB(){const db=await openStateDB();return new Promise((resolve,reject)=>{const tx=db.transaction(DB_STORE,'readonly');const req=tx.objectStore(DB_STORE).get(DB_KEY);req.onsuccess=()=>{db.close();resolve(req.result||null)};req.onerror=()=>{db.close();reject(req.error)}})}
async function writeStateDB(snapshot){const db=await openStateDB();return new Promise((resolve,reject)=>{const tx=db.transaction(DB_STORE,'readwrite');tx.objectStore(DB_STORE).put(snapshot,DB_KEY);tx.oncomplete=()=>{db.close();resolve(true)};tx.onerror=()=>{db.close();reject(tx.error||new Error('Could not save local database'))}})}
async function requestPersistentStorage(){try{if(navigator.storage?.persist){const already=await navigator.storage.persisted();if(!already)await navigator.storage.persist();}}catch{} }
function save(){const snapshot={...clone(data),updatedAt:new Date().toISOString()};const stamp=snapshot.updatedAt;(snapshot.tenants||[]).forEach(t=>t.updatedAt=stamp);(snapshot.payments||[]).forEach(p=>p.updatedAt=stamp);(snapshot.ecgBills||[]).forEach(e=>e.updatedAt=stamp);data=snapshot;storageLastSaved=snapshot.updatedAt;try{localStorage.setItem(KEY,JSON.stringify(snapshot))}catch{};writeStateDB(snapshot).then(()=>{storageReady=true;renderStorageStatus()}).catch(()=>renderStorageStatus());requestPersistentStorage();renderStorageStatus();queueCloudSync()}
async function hydratePersistentState(){try{const stored=await readStateDB();if(stored?.tenants?.length){const localTime=Date.parse(data.updatedAt||'');const dbTime=Date.parse(stored.updatedAt||'');if(dbTime>localTime){data=stored;try{localStorage.setItem(KEY,JSON.stringify(data))}catch{};storageLastSaved=stored.updatedAt;render()}}storageReady=true;renderStorageStatus()}catch{storageReady=false;renderStorageStatus()}requestPersistentStorage();const migrated=runMigrations();if(!data.updatedAt||migrated)save();render()}
function tenant(id){return data.tenants.find(t=>t.id===id)}
function pricePackage(){return {app:'mad-juliana-tenants',type:'tenant-price-update',version:APP_VERSION,exportedAt:new Date().toISOString(),tenants:data.tenants.map(t=>({id:t.id,name:t.name,currency:t.currency,rate:t.rate,phone:t.phone||'',start:t.start,end:t.end}))}}
function packageText(){return JSON.stringify(pricePackage(),null,2)}
function encodeUpdateLink(){const json=JSON.stringify(pricePackage());const bytes=new TextEncoder().encode(json);let binary='';bytes.forEach(b=>binary+=String.fromCharCode(b));return `${location.origin}${location.pathname}#update=${btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}`}
function decodeUpdateLink(value){const raw=String(value||'').trim();const marker='#update=';const i=raw.indexOf(marker);if(i<0)throw new Error('That is not a Mad Juliana update link');let token=raw.slice(i+marker.length).split(/[?#&\s]/)[0].replace(/-/g,'+').replace(/_/g,'/');while(token.length%4)token+='=';const binary=atob(token);const bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));return JSON.parse(new TextDecoder().decode(bytes))}
function receiptCoverageLabel(p){const months=Number(p.months)||0,days=Number(p.days)||0;if(days===7)return `${months ? `${months} month${months===1?'':'s'} + ` : ''}1 week`;return coverageLabel(months,days)}
function downloadText(text,name,mime='application/json'){const blob=new Blob([text],{type:mime});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
function normalizePricePackage(raw){if(!raw||typeof raw!=='object')throw new Error('Invalid update');if(raw.app!=='mad-juliana-tenants'||raw.type!=='tenant-price-update'||!Array.isArray(raw.tenants))throw new Error('This is not a Mad Juliana price update');const tenants=raw.tenants.map(t=>({id:String(t.id||''),name:String(t.name||'').trim(),currency:t.currency==='USD'?'USD':'GHS',rate:Number(t.rate),phone:String(t.phone||''),start:String(t.start||''),end:String(t.end||'')})).filter(t=>t.name&&t.rate>=0);if(!tenants.length)throw new Error('No valid tenants found');return {version:raw.version||'unknown',exportedAt:raw.exportedAt||'',tenants}}
function applyPricePackage(raw){const pkg=normalizePricePackage(raw);const old=clone(data);const byId=new Map(data.tenants.map(t=>[t.id,t]));const byName=new Map(data.tenants.map(t=>[t.name.trim().toLowerCase(),t]));let added=0,updated=0;pkg.tenants.forEach(incoming=>{let t=(incoming.id&&byId.get(incoming.id))||byName.get(incoming.name.toLowerCase());if(t){const keepEnd=incoming.end&&incoming.end>(t.end||'')?incoming.end:t.end;Object.assign(t,{...incoming,start:incoming.start||t.start,end:keepEnd});syncLatestPaymentToEnd(t,t.end);updated++}else{const id=incoming.id&&!byId.has(incoming.id)?incoming.id:'t-'+Date.now()+'-'+Math.random().toString(36).slice(2,7);data.tenants.push({...incoming,id});added++}});backfillPayments();save();render();return {old,added,updated,version:pkg.version}}

function status(t){const now=iso(today);if(t.end<now)return ['Expired','expired'];const days=Math.ceil((new Date(t.end)-new Date(now))/86400000);if(days<=60)return [`Ends in ${days}d`,'soon'];return ['Active','active']}
function activeCount(){return data.tenants.filter(t=>status(t)[1]!=='expired').length}
function totalRecorded(currency){return round2(data.payments.filter(p=>p.currency===currency&&tenant(p.tenantId)).reduce((s,p)=>s+(Number(p.netAmount??p.amount)||0),0))}
function showView(v){currentView=v;document.querySelectorAll('.view').forEach(x=>x.classList.toggle('active',x.id===v+'View'));document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x.dataset.view===v));window.scrollTo({top:0,behavior:'smooth'});render()}

document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.view)));
$('brandBtn').onclick=()=>showView('home');$('settingsBtn').onclick=()=>showView('settings');

autoRender();
hydratePersistentState();
function refreshToday(){const n=new Date();if(iso(n)!==iso(today)){today=n;render()}}
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshToday()});window.addEventListener('pageshow',refreshToday);
function autoRender(){render();}
function renderStorageStatus(){const el=$('storageStatus');if(!el)return;el.innerHTML=storageReady?`<b>✓ Your information is saved on this device</b><span>Saved locally in the app and a second offline database. Refreshing or leaving the app for months should not erase your records.</span>${storageLastSaved?`<small>Last saved: ${esc(formatChangedAt(storageLastSaved))}</small>`:''}`:`<b>Saving your information…</b><span>Setting up protected local storage for your records.</span>`}
function render(){renderHome();renderPeople();renderPayments();renderReminders();renderPricePreview();populatePaymentTenants();}
function renderPricePreview(){const el=$('pricePreview');if(!el)return;el.textContent=data.tenants.map(t=>`${t.name} — ${money(t.rate,t.currency)} / month`).join('\n')||'No residents yet.'}
function renderHome(){
  $('homeTenantCount').textContent=data.tenants.length;
  $('homeActiveCount').textContent=activeCount();
}
function renderPeople(){
  const q=($('peopleSearch')?.value||'').toLowerCase().trim();
  const list=data.tenants.filter(t=>t.name.toLowerCase().includes(q));
  $('peopleList').innerHTML=list.map(t=>{const [label,cls]=status(t);const p=latestPayment(t.id);const ecg=Number(p?.ecgDeduction)||0;const rent=Number(p?.netAmount??p?.amount)||0;const detail=ecg>0?` · rent ${money(rent,t.currency)} · ECG ${money(ecg,t.currency)} deducted`:'';return `<div class="person-swipe" data-swipe-tenant="${esc(t.id)}"><button class="person-row" data-person="${esc(t.id)}" type="button"><div class="avatar">${t.name.split(' ').map(x=>x[0]).slice(0,2).join('')}</div><div class="person-main"><strong>${esc(t.name)}</strong><span>${money(t.rate,t.currency)}/month · paid to ${fmtDate(t.end)}${detail}</span></div><span class="status ${cls}">${label}</span><i>›</i></button><button class="swipe-delete" type="button" data-delete-tenant="${esc(t.id)}" aria-label="Delete ${esc(t.name)}">Delete</button></div>`}).join('')||`<div class="empty">No tenants found.</div>`;
  document.querySelectorAll('#peopleList .person-swipe').forEach(w=>{
    const row=w.querySelector('[data-person]'); let startX=0,startY=0,dragging=false,moved=false;
    w.addEventListener('pointerdown',e=>{if(e.target.closest('.swipe-delete'))return;startX=e.clientX;startY=e.clientY;dragging=true;moved=false;w.setPointerCapture?.(e.pointerId)});
    w.addEventListener('pointermove',e=>{if(!dragging)return;const dx=e.clientX-startX,dy=e.clientY-startY;if(Math.abs(dx)>8&&Math.abs(dx)>Math.abs(dy)){moved=true;w.classList.toggle('swiping',dx<0)}});
    w.addEventListener('pointerup',e=>{if(!dragging)return;dragging=false;const dx=e.clientX-startX,dy=e.clientY-startY;if(Math.abs(dx)>8&&Math.abs(dx)>Math.abs(dy)){w.classList.toggle('open',dx<-65);w.classList.remove('swiping')}else if(!moved){if(w.classList.contains('open'))w.classList.remove('open');else openDetail(row.dataset.person)} });
    w.addEventListener('pointercancel',()=>{dragging=false;w.classList.remove('swiping')});
  });
  document.querySelectorAll('#peopleList [data-delete-tenant]').forEach(b=>b.onclick=()=>deleteTenant(b.dataset.deleteTenant));
}
function approximateCoverage(p){
  const months=Number(p.months)||0, days=Number(p.days)||0;
  if(months===0) return 'Less than a month';
  return `About ${months + (days>=15 ? 1 : 0)} month${(months + (days>=15 ? 1 : 0))===1?'':'s'}`;
}
function timeLeftText(p){
  const end=p.end;if(!end)return '';
  const now=iso(today),start=p.start||p.date||now;
  const dayMs=86400000;
  if(end<=now)return 'Completed';
  if(start>now){const d=Math.ceil((new Date(start+'T00:00:00')-new Date(now+'T00:00:00'))/dayMs);return d>=45?`Starts in about ${Math.round(d/30.44)} months`:`Starts in ${d} day${d===1?'':'s'}`}
  const d=Math.ceil((new Date(end+'T00:00:00')-new Date(now+'T00:00:00'))/dayMs);
  if(d>=45){const m=Math.round(d/30.44);return `About ${m} month${m===1?'':'s'} left`}
  return `${d} day${d===1?'':'s'} left`;
}
function paymentCoverageLine(p){
  const paid=approximateCoverage(p).replace(/^About /,'').replace(/^Less than a month$/,'<1 month');
  const left=timeLeftText(p);
  return `${paid} paid${left?` · ${left}`:''}`;
}
function paymentMonthHeader(date){
  const d=new Date(`${date}T00:00:00`);
  return d.toLocaleDateString('en-US',{month:'long',year:'numeric'}).toUpperCase();
}
function renderPayments(){
  const ps=[...data.payments].filter(p=>tenant(p.tenantId)).sort((a,b)=>(b.date||'').localeCompare(a.date||'')||(b.end||'').localeCompare(a.end||''));
  $('paymentRecordCount').textContent=ps.length;
  $('paymentTotalGHS').textContent=money(totalRecorded('GHS'),'GHS');
  $('paymentTotalUSD').textContent=money(totalRecorded('USD'),'USD');
  const groups=[];
  ps.forEach(p=>{
    const key=String(p.date||'').slice(0,7)||'unknown';
    let g=groups.find(x=>x.key===key);
    if(!g){g={key,title:paymentMonthHeader(p.date||iso(today)),items:[]};groups.push(g)}
    g.items.push(p);
  });
  $('paymentsList').innerHTML=groups.map(g=>`<section class="payment-group"><h3 class="payment-month-header">${esc(g.title)}</h3><div class="payment-group-list">${g.items.map(p=>{const t=tenant(p.tenantId);if(!t)return '';const [statusLabel,statusClass]=status(t);const badge=statusClass==='active'?'':`<span class="status ${statusClass}">${statusLabel}</span>`;const ecg=Number(p.ecgDeduction)||0;const rent=Number(p.netAmount??p.amount)||0;const extra=ecg>0?` · ECG ${money(ecg,p.currency)} deducted`:'';return `<button class="payment-row ${statusClass}" data-person="${esc(t.id)}"><div class="payment-main"><div class="payment-row-top"><strong>${esc(t.name)}</strong><strong class="payment-amount">${money(rent,p.currency)}</strong></div><div class="payment-row-bottom"><span>${paymentCoverageLine(p)}${extra}</span>${badge}</div></div><i class="payment-chevron">›</i></button>`}).join('')}</div></section>`).join('')||`<div class="empty">No payments yet.</div>`;
  document.querySelectorAll('#paymentsList [data-person]').forEach(b=>b.onclick=()=>openDetail(b.dataset.person));
}
function latestPayment(id){return [...data.payments].filter(p=>p.tenantId===id).sort((a,b)=>(b.end||'').localeCompare(a.end||'')||(b.date||'').localeCompare(a.date||''))[0]||null}
function syncLatestPaymentToEnd(t,newEnd){
  const p=latestPayment(t.id);if(!p||!newEnd||p.end===newEnd)return false;
  const start=p.start||t.start;if(!start||newEnd<=start)return false;
  const cov=coverageBetween(start,newEnd);const net=amountForCoverage(rateOf(p,t),start,cov.months,cov.days);
  p.months=cov.months;p.days=cov.days;p.end=newEnd;p.netAmount=net;p.amount=round2(net+(Number(p.ecgDeduction)||0));
  return true;
}
function renderReminders(){
  const sorted=[...data.tenants].sort((a,b)=>a.end.localeCompare(b.end));
  $('remindersList').innerHTML=sorted.map(t=>{const [label,cls]=status(t);const p=latestPayment(t.id);const ecg=Number(p?.ecgDeduction)||0;const rent=Number(p?.netAmount??p?.amount)||0;const extra=ecg>0?` · Rent ${money(rent,p.currency)} · ECG ${money(ecg,p.currency)} deducted`:'';return `<div class="reminder-row"><div class="avatar small">${t.name.split(' ').map(x=>x[0]).slice(0,2).join('')}</div><div><strong>${esc(t.name)}</strong><span>Paid to ${fmtDate(t.end)}${extra}</span></div><span class="status ${cls}">${label}</span>${p?`<button class="reminder-print" type="button" data-receipt-tenant="${esc(t.id)}" aria-label="Open and share receipt for ${esc(t.name)}">Receipt</button>`:'<span class="no-receipt">No receipt</span>'}</div>`}).join('');
  document.querySelectorAll('[data-receipt-tenant]').forEach(b=>b.onclick=()=>openReceiptForTenant(b.dataset.receiptTenant,true));
  const history=[...data.payments].sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  const el=$('reminderHistoryList');
  if(el) el.innerHTML=history.map(p=>{const t=tenant(p.tenantId);if(!t)return '';const ecg=Number(p.ecgDeduction)||0;const rent=Number(p.netAmount??p.amount)||0;const detail=ecg>0?`${approximateCoverage(p)} · Rent ${money(rent,p.currency)} · ECG ${money(ecg,p.currency)} deducted`:approximateCoverage(p);return `<button class="history-row history-row-button" data-history-person="${esc(t.id)}"><div><b>${esc(t.name)}</b><span>${fmtDate(p.date)} · ${detail}${p.note?` · ${esc(p.note)}`:''}</span></div><strong>${money(rent,p.currency)}</strong></button>`}).join('')||'<div class="empty">No payment records.</div>';
  document.querySelectorAll('[data-history-person]').forEach(b=>b.onclick=()=>openDetail(b.dataset.historyPerson));
}
$('peopleSearch').oninput=renderPeople;

function openDetail(id){const t=tenant(id);if(!t)return;selectedTenant=id;const p=latestPayment(id);const ecg=Number(p?.ecgDeduction)||0;const rent=Number(p?.netAmount??p?.amount)||0;$('detailName').textContent=t.name;$('detailEnd').textContent=fmtDate(t.end);$('detailRate').textContent=money(t.rate,t.currency)+'/month';$('detailRentAmount').textContent=p?money(rent,t.currency):'—';$('detailEcgAmount').textContent=ecg>0?money(ecg,t.currency):'None';$('detailCoverage').textContent=p?paymentCoverageLine(p):'No payment yet';const [label,cls]=status(t);$('detailStatus').textContent=label;$('detailStatus').className='detail-status '+cls;openSheet('tenantDetailSheet')}
$('extendBtn').onclick=()=>{closeSheets();openPaymentSheet(selectedTenant)};
$('ecgBillBtn').onclick=()=>{closeSheets();openEcgSheet(selectedTenant)};
$('detailReceiptBtn').onclick=()=>openReceiptForTenant(selectedTenant,true);
$('editTenantBtn').onclick=()=>{closeSheets();openTenantSheet(selectedTenant)};

function populatePaymentTenants(){const el=$('paymentTenant');const current=el.value;el.innerHTML=data.tenants.map(t=>`<option value="${t.id}">${esc(t.name)} · ${money(t.rate,t.currency)}/mo</option>`).join('');if(selectedTenant&&tenant(selectedTenant))el.value=selectedTenant;else if(current&&tenant(current))el.value=current;updatePaymentPreview()}
function openPaymentSheet(id){selectedTenant=id||selectedTenant;populatePaymentTenants();$('paymentTenant').value=selectedTenant||data.tenants[0]?.id||'';$('paymentDate').value=iso(today);$('paymentMonths').value=6;$('paymentNote').value='';setDuration('6');openSheet('paymentSheet')}
function setDuration(v){document.querySelectorAll('[data-duration]').forEach(b=>b.classList.toggle('selected',b.dataset.duration===String(v)));const custom=v==='custom';$('paymentMonths').readOnly=true;$('customHelper').hidden=!custom;const t=tenant($('paymentTenant').value);if(!custom&&t){$('paymentMonths').value=Number(v);$('paymentAmount').value=(t.rate*Number(v)).toFixed(2)}else if(t&&custom){$('paymentAmount').value='';$('paymentMonths').value='';}updatePaymentPreview()}
document.querySelectorAll('[data-duration]').forEach(b=>b.onclick=()=>setDuration(b.dataset.duration));
$('paymentTenant').onchange=()=>{const t=tenant($('paymentTenant').value);const custom=document.querySelector('[data-duration].selected')?.dataset.duration==='custom';if(t&&!custom)$('paymentAmount').value=(t.rate*Number($('paymentMonths').value||6)).toFixed(2);updatePaymentPreview()};$('paymentMonths').oninput=updatePaymentPreview;$('paymentAmount').oninput=updatePaymentPreview;
function updatePaymentPreview(){const t=tenant($('paymentTenant').value);if(!t){$('periodPreview').textContent='';return}const amount=Number($('paymentAmount').value||0);const start=coverageStart(t);let months=0,days=0,end=start;if(amount>0){const x=customCoverage(start,amount,t.rate);months=x.months;days=x.days;end=x.end;$('paymentMonths').value=months||'';}const label=amount>0?coverageLabel(months,days):'Enter amount';$('periodPreview').innerHTML=`<span>PAYMENT COVERS</span><b>${fmtDate(start)} → ${fmtDate(end)}</b><small>${label} · ${money(amount,t.currency)}</small>`}
function formatCalculationNote(note){
  const raw=String(note||'');
  const m=raw.match(/(?:GH¢|GHS|USD|\$)\s*([\d,]+(?:\.\d+)?)\s*[−–-]\s*(?:GH¢|GHS|USD|\$)\s*([\d,]+(?:\.\d+)?)\s*(?:=\s*(?:GH¢|GHS|USD|\$)\s*([\d,]+(?:\.\d+)?))?/i);
  if(!m)return '';
  const a=m[1].replace(/,/g,''),b=m[2].replace(/,/g,''),c=m[3]?(m[3].replace(/,/g,'')):String(Number(a)-Number(b));
  return `GH¢  ${a}- GHS ${b} = GH¢  ${c}`;
}
function makeReceipt(t,p){
  const hasEcg=Number(p.ecgDeduction)>0 || p.type==='ecg';
  const canvas=document.createElement('canvas');canvas.width=1000;canvas.height=hasEcg?1122:1120;const c=canvas.getContext('2d');
  const receiptTenantName=String(t.name||'').replace(/\s*\([^)]*\)/g,'').trim();
  c.fillStyle='#fff';c.fillRect(0,0,1000,canvas.height);c.fillStyle='#111';c.textAlign='center';c.font='700 42px Georgia';c.fillText('TENANCY AGREEMENT',500,72);c.fillRect(385,86,230,3);
  const calc=formatCalculationNote(p.note);let y=135;if(calc){c.font='700 25px Georgia';c.fillText(calc,500,y);y+=58}
  const periodText=`${monthYear(p.start)} TO ${monthYear(p.end)}`;
  const rows=[['LAND LADY','JULIANA AIDA ANTWI'],['TENANT',receiptTenantName.toUpperCase()],['PERIOD',periodText],['MONTHLY RATE',money(rateOf(p,t),t.currency)],['START PERIOD',monthYear(p.start)],['END PERIOD',monthYear(p.end)]];
  if(hasEcg){
    rows.push(['TOTAL',money(p.amount,p.currency)]);
    rows.push(['ECG BILL',money(p.ecgDeduction,p.currency)]);
    rows.push(['NEW TOTAL',money(p.netAmount??p.amount,p.currency)]);
  }else{
    rows.push(['AMOUNT',money(p.netAmount??p.amount,p.currency)]);
  }
  c.textAlign='left';rows.forEach(([a,b])=>{c.font='700 25px Georgia';c.fillText(a,100,y);c.textAlign='center';c.font='400 25px Georgia';c.fillText(b,650,y);c.textAlign='left';y+=58});
  y+=28;c.font='700 23px Georgia';c.fillText('Landlady:',100,y);c.fillText('Tenant:',600,y);y+=34;c.font='400 23px Georgia';c.fillText('Juliana Aida Antwi',100,y);c.fillText(receiptTenantName,600,y);y+=34;c.fillText('Signed',100,y);c.fillText('Signed',600,y);
  c.fillStyle='#777';c.font='400 17px Georgia';c.fillText(`${p.type==='ecg'?'ECG bill date':'Payment date'}: ${fmtDate(p.date)}`,100,hasEcg?1062:1060);
  return canvas.toDataURL('image/png');
}
function makeEcgReceipt(t,e){const p=latestPayment(t.id);return p?makeReceipt(t,p):makeReceipt(t,{...e,type:'ecg',start:e.originalStart||t.start,end:e.newEnd||t.end,months:e.monthsLeft,days:e.daysLeft,amount:e.totalAmount,netAmount:e.newTotal,ecgDeduction:e.ecgDeduction})}
function monthYear(s){return new Date(s+'T00:00:00').toLocaleDateString('en-US',{month:'long',year:'numeric'}).toUpperCase()}
function dataUrlToBlob(dataUrl){const [head,body]=String(dataUrl).split(',');const mime=(head.match(/data:([^;]+)/)||[])[1]||'image/png';const bin=atob(body);const bytes=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);return new Blob([bytes],{type:mime})}

function cloudStatus(text){const el=$('cloudSyncStatus');if(el)el.textContent=text;const badge=$('cloudBadge');if(badge)badge.textContent=text==='Connected'?'Live':text}
function cloudSetSignedIn(user){cloudUser=user||null;const out=$('cloudSignedOut'),inn=$('cloudSignedIn');if(out)out.hidden=!!user;if(inn)inn.hidden=!user;if($('cloudUserEmail'))$('cloudUserEmail').textContent=user?.email||'';cloudStatus(user?'Connected':'Offline')}
function ensureCloudIds(){if(!data.tenants)data.tenants=[];if(!data.payments)data.payments=[];if(!data.ecgBills)data.ecgBills=[];data.tenants.forEach(t=>{if(!t.cloudId)t.cloudId=crypto.randomUUID()});data.payments.forEach(p=>{if(!p.cloudId)p.cloudId=crypto.randomUUID()});data.ecgBills.forEach(e=>{if(!e.cloudId)e.cloudId=crypto.randomUUID()})}
function tenantCloudId(id){return tenant(id)?.cloudId||null}
function queueCloudSync(){if(!cloudUser||applyingCloud)return;clearTimeout(cloudSyncTimer);cloudSyncTimer=setTimeout(()=>syncToCloud(),500)}
async function syncToCloud(){
  if(!cloudUser||cloudSyncBusy||!supabaseClient)return;
  cloudSyncBusy=true;cloudStatus('Syncing…');
  try{
    ensureCloudIds();
    const localTenantIds=data.tenants.map(t=>t.cloudId).filter(Boolean), localPaymentIds=data.payments.map(p=>p.cloudId).filter(Boolean), localEcgIds=data.ecgBills.map(e=>e.cloudId).filter(Boolean);
    // Delete cloud records that no longer exist locally. ECG first, then payments, then tenants.
    {const r=await supabaseClient.from('ecg_deductions').select('id').eq('owner_id',cloudUser.id);if(r.error)throw r.error;const extras=(r.data||[]).filter(x=>!localEcgIds.includes(x.id)).map(x=>x.id);if(extras.length){const d=await supabaseClient.from('ecg_deductions').delete().in('id',extras);if(d.error)throw d.error}}
    if(localPaymentIds.length){const r=await supabaseClient.from('payments').select('id').eq('owner_id',cloudUser.id);if(r.error)throw r.error;const extras=(r.data||[]).filter(x=>!localPaymentIds.includes(x.id)).map(x=>x.id);if(extras.length){const d=await supabaseClient.from('payments').delete().in('id',extras);if(d.error)throw d.error}}else{const d=await supabaseClient.from('payments').delete().eq('owner_id',cloudUser.id);if(d.error)throw d.error}
    if(localTenantIds.length){const r=await supabaseClient.from('tenants').select('id').eq('owner_id',cloudUser.id);if(r.error)throw r.error;const extras=(r.data||[]).filter(x=>!localTenantIds.includes(x.id)).map(x=>x.id);if(extras.length){const d=await supabaseClient.from('tenants').delete().in('id',extras);if(d.error)throw d.error}}else{const d=await supabaseClient.from('tenants').delete().eq('owner_id',cloudUser.id);if(d.error)throw d.error}
    const stamp=new Date().toISOString();
    const tenantRows=data.tenants.map(t=>({id:t.cloudId,owner_id:cloudUser.id,name:t.name,phone:t.phone||null,currency:t.currency||'GHS',monthly_rate:Number(t.rate)||0,start_date:t.start||null,paid_to:t.end||null,notes:t.notes||null,updated_at:t.updatedAt||stamp}));
    const tenantRes=tenantRows.length?await supabaseClient.from('tenants').upsert(tenantRows,{onConflict:'id'}):{error:null};if(tenantRes.error)throw tenantRes.error;
    const paymentRows=data.payments.map(p=>({id:p.cloudId,owner_id:cloudUser.id,tenant_id:tenantCloudId(p.tenantId),amount:Number(p.amount)||0,currency:p.currency||'GHS',monthly_rate:Number(p.monthlyRate)||Number(tenant(p.tenantId)?.rate)||0,start_date:p.start||null,end_date:p.end||null,months:Number(p.months)||0,days:Number(p.days)||0,payment_date:p.date||stamp,note:p.note||null,net_amount:p.netAmount==null?Number(p.amount)||0:Number(p.netAmount)||0,ecg_deduction:Number(p.ecgDeduction)||0,ecg_updated_at:p.ecgUpdatedAt||null,updated_at:p.updatedAt||stamp}));
    const payRes=paymentRows.length?await supabaseClient.from('payments').upsert(paymentRows,{onConflict:'id'}):{error:null};if(payRes.error)throw payRes.error;
    const ecgRows=data.ecgBills.map(e=>({id:e.cloudId,owner_id:cloudUser.id,tenant_id:tenantCloudId(e.tenantId),payment_id:data.payments.find(p=>p.id===e.paymentId)?.cloudId,amount:Number(e.ecgDeduction)||0,currency:tenant(e.tenantId)?.currency||'GHS',total_before:Number(e.totalAmount)||0,new_total:Number(e.newTotal)||0,months_left:Number(e.monthsLeft)||0,days_left:Number(e.daysLeft)||0,deducted_at:e.date?new Date(e.date+'T00:00:00').toISOString():stamp,note:e.note||null,created_at:e.createdAt||stamp})).filter(e=>e.payment_id);
    const ecgRes=ecgRows.length?await supabaseClient.from('ecg_deductions').upsert(ecgRows,{onConflict:'id'}):{error:null};if(ecgRes.error)throw ecgRes.error;
    const s=await supabaseClient.from('app_settings').upsert({owner_id:cloudUser.id,property_name:'Mad Juliana’s Tenants Payment',landlady_name:'Juliana Aida Antwi',updated_at:stamp},{onConflict:'owner_id'});if(s.error)throw s.error;
    cloudStatus('Connected');
  }catch(e){console.error(e);cloudStatus('Offline')}finally{cloudSyncBusy=false}
}
async function pullCloudState(){
  if(!cloudUser||!supabaseClient)return;cloudStatus('Syncing…');
  try{
    const [tr,pr,er]=await Promise.all([supabaseClient.from('tenants').select('*').order('created_at'),supabaseClient.from('payments').select('*').order('payment_date'),supabaseClient.from('ecg_deductions').select('*').order('deducted_at')]);
    if(tr.error)throw tr.error;if(pr.error)throw pr.error;if(er.error)throw er.error;
    const rows=tr.data||[], pays=pr.data||[], ecgs=er.data||[];
    const cloudLatest=Math.max(0,...rows.map(r=>Date.parse(r.updated_at||r.created_at||'')||0),...pays.map(r=>Date.parse(r.updated_at||r.created_at||'')||0),...ecgs.map(r=>Date.parse(r.deducted_at||r.created_at||'')||0));
    const localLatest=Date.parse(data.updatedAt||'')||0;
    if(localLatest>cloudLatest+250){await syncToCloud();return}
    if(!rows.length&&!pays.length&&!ecgs.length){await syncToCloud();return}
    const old=clone(data);const byCloud=new Map(data.tenants.map(t=>[t.cloudId,t]));rows.forEach(r=>{let t=byCloud.get(r.id);if(!t){t={id:'t-'+r.id.slice(0,8),cloudId:r.id,name:r.name,currency:r.currency||'GHS',rate:Number(r.monthly_rate)||0,phone:r.phone||'',start:r.start_date||'',end:r.paid_to||'',notes:r.notes||''};data.tenants.push(t)}Object.assign(t,{name:r.name,phone:r.phone||'',currency:r.currency||'GHS',rate:Number(r.monthly_rate)||0,start:r.start_date||'',end:r.paid_to||'',notes:r.notes||'',updatedAt:r.updated_at||r.created_at||''})});
    const tenantByCloud=new Map(data.tenants.map(t=>[t.cloudId,t.id]));const payByCloud=new Map(data.payments.map(p=>[p.cloudId,p]));
    pays.forEach(r=>{let p=payByCloud.get(r.id);if(!p){p={id:'p-'+r.id.slice(0,8),cloudId:r.id,tenantId:tenantByCloud.get(r.tenant_id),amount:Number(r.amount)||0,currency:r.currency||'GHS'};data.payments.push(p)}Object.assign(p,{tenantId:tenantByCloud.get(r.tenant_id)||p.tenantId,amount:Number(r.amount)||0,currency:r.currency||'GHS',monthlyRate:Number(r.monthly_rate)||0,start:r.start_date||'',end:r.end_date||'',months:Number(r.months)||0,days:Number(r.days)||0,date:(r.payment_date||'').slice(0,10)||iso(today),note:r.note||'',netAmount:r.net_amount==null?Number(r.amount)||0:Number(r.net_amount)||0,ecgDeduction:Number(r.ecg_deduction)||0,ecgUpdatedAt:r.ecg_updated_at||null,updatedAt:r.updated_at||r.created_at||''})});
    const remotePaymentIds=new Set(pays.map(r=>r.id));data.payments=data.payments.filter(p=>!p.cloudId||remotePaymentIds.has(p.cloudId));
    const ecgByCloud=new Map(data.ecgBills.map(e=>[e.cloudId,e]));ecgs.forEach(r=>{const p=data.payments.find(x=>x.cloudId===r.payment_id);if(!p)return;let e=ecgByCloud.get(r.id);if(!e){e={id:'e-'+r.id.slice(0,8),cloudId:r.id,tenantId:tenantByCloud.get(r.tenant_id),paymentId:p.id};data.ecgBills.push(e)}Object.assign(e,{tenantId:tenantByCloud.get(r.tenant_id)||e.tenantId,paymentId:p.id,totalAmount:Number(r.total_before)||0,ecgDeduction:Number(r.amount)||0,newTotal:Number(r.new_total)||0,monthsLeft:Number(r.months_left)||0,daysLeft:Number(r.days_left)||0,date:(r.deducted_at||'').slice(0,10)||iso(today),note:r.note||'',updatedAt:r.created_at||r.deducted_at||''})});
    const remoteEcgIds=new Set(ecgs.map(r=>r.id));data.ecgBills=data.ecgBills.filter(e=>!e.cloudId||remoteEcgIds.has(e.cloudId));
    const remoteTenantIds=new Set(rows.map(r=>r.id));data.tenants=data.tenants.filter(t=>!t.cloudId||remoteTenantIds.has(t.cloudId));
    backfillPayments();data.tenants.forEach(t=>{const ps=data.payments.filter(p=>p.tenantId===t.id).sort((a,b)=>(a.end||'').localeCompare(b.end||''));if(ps.length)t.end=ps[ps.length-1].end||t.end});
    applyingCloud=true;save();applyingCloud=false;render();cloudStatus('Connected');return old;
  }catch(e){console.error(e);cloudStatus('Offline')}
}

async function cloudAuth(mode){if(!supabaseClient)return toast('Cloud service is not available');const email=$('cloudEmail')?.value.trim(),password=$('cloudPassword')?.value;if(!email||password.length<6)return toast('Enter an email and a password of at least 6 characters');cloudStatus('Connecting…');try{let res;if(mode==='signup')res=await supabaseClient.auth.signUp({email,password});else res=await supabaseClient.auth.signInWithPassword({email,password});if(res.error)throw res.error;if(res.data.user){cloudSetSignedIn(res.data.user);setupCloudRealtime();ensureCloudIds();await pullCloudState();await syncToCloud();toast(mode==='signup'?'Account created. Cloud sync is on.':'Cloud sync connected.')}else toast('Check your email to confirm the account, then sign in.')}catch(e){cloudStatus('Offline');toast(e.message||'Could not connect to cloud')}}
function setupCloudRealtime(){if(!supabaseClient||!cloudUser)return;if(cloudChannel)supabaseClient.removeChannel(cloudChannel);cloudChannel=supabaseClient.channel('mad-juliana-live').on('postgres_changes',{event:'*',schema:'public',table:'tenants',filter:`owner_id=eq.${cloudUser.id}`},()=>pullCloudState()).on('postgres_changes',{event:'*',schema:'public',table:'payments',filter:`owner_id=eq.${cloudUser.id}`},()=>pullCloudState()).on('postgres_changes',{event:'*',schema:'public',table:'ecg_deductions',filter:`owner_id=eq.${cloudUser.id}`},()=>pullCloudState()).subscribe();}
async function initCloud(){try{if(!window.supabase?.createClient)return;supabaseClient=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY);supabaseClient.auth.onAuthStateChange((event,session)=>{cloudSetSignedIn(session?.user||null);if(session?.user&&event!=='SIGNED_OUT'){setupCloudRealtime();pullCloudState()}else if(event==='SIGNED_OUT'&&cloudChannel){supabaseClient.removeChannel(cloudChannel);cloudChannel=null}});const {data:{session}}=await supabaseClient.auth.getSession();cloudSetSignedIn(session?.user||null);if(session?.user){setupCloudRealtime();await pullCloudState();}document.body.dataset.cloudReady='1'}catch(e){console.error(e)}}
$('cloudSignInBtn')?.addEventListener('click',()=>cloudAuth('signin'));$('cloudSignUpBtn')?.addEventListener('click',()=>cloudAuth('signup'));$('cloudSyncNowBtn')?.addEventListener('click',()=>syncToCloud());$('cloudSignOutBtn')?.addEventListener('click',async()=>{if(supabaseClient)await supabaseClient.auth.signOut();cloudSetSignedIn(null);toast('Cloud sync signed out')});
initCloud();

async function shareReceiptImage(){
  if(!lastReceipt){toast('No receipt available yet');return false}
  try{
    const blob=dataUrlToBlob(lastReceipt);const file=new File([blob],'tenancy-agreement.png',{type:'image/png'});
    if(!navigator.share){toast('Sharing is not supported here. Tap Save image instead.');return false}
    if(navigator.canShare && !navigator.canShare({files:[file]})){toast('This device cannot share image files here. Tap Save image instead.');return false}
    await navigator.share({title:'Tenancy Agreement',text:'Tenancy Agreement',files:[file]});
    return true;
  }catch(e){if(e?.name==='AbortError')return false;toast('Could not open sharing. Tap Save image instead.');return false}
}
async function openReceiptForTenant(id,autoShare=false){const t=tenant(id),p=latestPayment(id);if(!t||!p){toast('No receipt available for this tenant yet');return}const ecg=Number(p.ecgDeduction)||0;if(ecg>0&&!Number(p.netAmount)){const net=Math.max(0,Number(p.amount)-ecg);const cov=customCoverage(p.start,net,t.rate);p.netAmount=net;p.months=cov.months;p.days=cov.days;p.end=cov.end;t.end=cov.end;save();render()}lastReceipt=makeReceipt(t,p);$('receiptImage').src=lastReceipt;closeSheets();openSheet('receiptSheet');if(autoShare)await shareReceiptImage()}
$('shareReceiptBtn').onclick=()=>shareReceiptImage();
function downloadReceipt(){if(!lastReceipt)return;const a=document.createElement('a');a.href=lastReceipt;a.download='tenancy-agreement.png';document.body.appendChild(a);a.click();a.remove();}
$('downloadReceiptBtn').onclick=downloadReceipt;

$('paymentForm').onsubmit=e=>{e.preventDefault();const t=tenant($('paymentTenant').value);if(!t){toast('Choose a tenant first');return}const amount=Number($('paymentAmount').value);if(!(amount>0)){toast('Enter a payment amount');return}const start=coverageStart(t);const calc=customCoverage(start,amount,t.rate);if(calc.months===0&&calc.days===0){toast('The payment is too small to cover any time');return}const label=receiptCoverageLabel({months:calc.months,days:calc.days});const ok=window.confirm(`${t.name}

Payment ${money(amount,t.currency)}
Covers ${label}
Paid to ${fmtDate(calc.end)}

Record this payment?`);if(!ok)return;const old=clone(data);const p={id:'p-'+Date.now(),tenantId:t.id,amount,currency:t.currency,monthlyRate:Number(t.rate)||0,netAmount:amount,months:calc.months,days:calc.days,start,end:calc.end,date:$('paymentDate').value||iso(today),note:$('paymentNote').value.trim()};data.payments.push(p);t.end=calc.end;save();render();lastReceipt=makeReceipt(t,p);$('receiptImage').src=lastReceipt;closeSheets();openSheet('receiptSheet');toastAction(`${t.name}: ${money(amount,t.currency)} recorded · ${label}`,'Undo',()=>{data=old;save();render();lastReceipt=null},5000)};

function ecgStateForTenant(t,bill){
  const p=latestPayment(t.id);
  if(!p)return null;
  const gross=Number(p.amount)||0;
  const already=Number(p.ecgDeduction)||0;
  const available=Math.max(0,round2(gross-already));
  const deduction=Math.max(0,Number(bill)||0);
  const newTotal=Math.max(0,round2(available-deduction));
  const start=p.start||t.start;
  const coverage=customCoverage(start,newTotal,rateOf(p,t));
  return {p,gross,already,available,deduction,newTotal,start,coverage};
}
// ECG bills in Ghana are in cedis. For a tenant who pays in USD the bill is converted at the rate typed in.
function ecgBillInput(t){
  const raw=Number($('ecgAmount').value||0);
  const usdTenant=t&&t.currency==='USD';
  const cur=usdTenant?$('ecgBillCurrency').value:(t?.currency||'GHS');
  if(!usdTenant||cur==='USD')return {value:round2(raw),raw,cur:t?.currency||'GHS',fx:null,error:''};
  const fx=Number($('ecgFxRate').value||0);
  if(!(fx>0))return {value:0,raw,cur:'GHS',fx:null,error:'Enter the exchange rate (GHS per $1)'};
  return {value:round2(raw/fx),raw,cur:'GHS',fx,error:''};
}
function updateEcgFxUi(){
  const t=tenant(selectedTenant);const usd=!!t&&t.currency==='USD';
  $('ecgFxRow').hidden=!usd;
  $('ecgFxLabel').hidden=!usd||$('ecgBillCurrency').value!=='GHS';
}
function updateEcgClearButton(){
  const t=tenant(selectedTenant),p=t?latestPayment(t.id):null;
  const btn=$('clearEcgBtn');
  if(btn)btn.disabled=!(p&&Number(p.ecgDeduction)>0);
}
function renderEcgPreview(){
  const t=tenant(selectedTenant);const inp=t?ecgBillInput(t):{value:0,raw:0,error:''};const bill=inp.value;const state=t?ecgStateForTenant(t,bill):null;
  updateEcgClearButton();updateEcgFxUi();
  if(!state){$('ecgPreview').innerHTML='<span>NO PAYMENT</span><b>There is no payment to deduct from yet.</b><small>Record a payment for this tenant first.</small>';return}
  if(inp.error&&inp.raw>0){$('ecgPreview').innerHTML=`<span>EXCHANGE RATE</span><b>${esc(inp.error)}</b><small>The bill is in cedis, so it has to be converted to dollars first.</small>`;return}
  if(!(inp.raw>0)||!(bill>0)){$('ecgPreview').innerHTML='<span>NEW TOTAL</span><b>Enter the ECG bill amount</b><small>Type a bill amount to see the rent value and remaining coverage update live.</small>';return}
  const {available,newTotal,coverage}=state;
  const label=coverageLabel(coverage.months,coverage.days);
  const conv=inp.fx?`<small>${money(inp.raw,'GHS')} ÷ ${inp.fx} = ${money(bill,t.currency)}</small>`:'';
  const over=bill>available?`<small style="color:#a34d43">The bill is more than the ${money(available,t.currency)} available.</small>`:'';
  $('ecgPreview').innerHTML=`<div class="ecg-live-grid"><div><span>TOTAL</span><b>${money(available,t.currency)}</b></div><div><span>ECG BILL</span><b>${money(bill,t.currency)}</b></div><div><span>NEW TOTAL</span><b>${money(newTotal,t.currency)}</b></div><div><span>COVERS</span><b>${esc(label)}</b></div></div>${conv}<small>Paid to after deduction · ${fmtDate(coverage.end)}</small>${over}`;
}
function openEcgSheet(id){selectedTenant=id||selectedTenant;const t=tenant(selectedTenant);if(!t)return;const p=latestPayment(t.id);$('ecgTenant').textContent=t.name;$('ecgCurrentPaidTo').textContent=fmtDate(t.end);$('ecgRate').textContent=money(p?rateOf(p,t):t.rate,t.currency)+'/month';$('ecgAmount').value='';$('ecgBillCurrency').value='GHS';try{$('ecgFxRate').value=localStorage.getItem('mad-juliana-fx')||''}catch{$('ecgFxRate').value=''}updateEcgFxUi();$('ecgPreview').innerHTML=p?'<span>NEW TOTAL</span><b>Enter the ECG bill amount</b><small>Type a bill amount to see the rent value and remaining coverage update live.</small>':'<span>NO PAYMENT</span><b>There is no payment to deduct from yet.</b><small>Record a payment for this tenant first.</small>';updateEcgClearButton();openSheet('ecgSheet')}
$('ecgAmount').oninput=renderEcgPreview;$('ecgBillCurrency').onchange=renderEcgPreview;$('ecgFxRate').oninput=renderEcgPreview;
$('clearEcgBtn').onclick=()=>{
  const t=tenant(selectedTenant),p=t?latestPayment(t.id):null;if(!t||!p||!(Number(p.ecgDeduction)>0)){toast('There is no ECG deduction to clear');return}
  const cleared=Number(p.ecgDeduction)||0;const original=customCoverage(p.start||t.start,Number(p.amount)||0,rateOf(p,t));
  const ok=window.confirm(`Clear ECG bill ${money(cleared,t.currency)} for ${t.name}?\n\nThis restores the payment to ${money(p.amount,t.currency)} and Paid to ${fmtDate(original.end)}.`);
  if(!ok)return;
  const old=clone(data);
  p.ecgDeduction=0;p.netAmount=Number(p.amount)||0;p.months=original.months;p.days=original.days;p.end=original.end;p.ecgUpdatedAt=null;t.end=original.end;data.ecgBills=data.ecgBills.filter(e=>e.paymentId!==p.id);
  save();render();$('ecgCurrentPaidTo').textContent=fmtDate(t.end);$('ecgAmount').value='';renderEcgPreview();toastAction(`${t.name}: ECG bill cleared`,'Undo',()=>{data=old;save();render();lastReceipt=null},5000);
};
$('ecgForm').onsubmit=ev=>{
  ev.preventDefault();const t=tenant(selectedTenant);if(!t)return;
  const inp=ecgBillInput(t);const bill=inp.value;const state=ecgStateForTenant(t,bill);
  if(!state){toast('Record a payment for this tenant first');return}
  if(inp.error){toast(inp.error);return}
  if(!(bill>0)){toast('Enter an ECG bill amount');return}
  if(!(state.available>0)){toast('There is no remaining rent value available to deduct from');return}
  if(bill>state.available){toast(`ECG bill cannot exceed ${money(state.available,t.currency)}`);return}
  const {p,newTotal,start,coverage}=state;const label=coverageLabel(coverage.months,coverage.days);
  const conv=inp.fx?`\n(${money(inp.raw,'GHS')} ÷ ${inp.fx})`:'';
  const ok=window.confirm(`${t.name}\n\nTotal ${money(state.available,t.currency)}\nECG Bill ${money(bill,t.currency)}${conv}\nNew Total ${money(newTotal,t.currency)}\nCovers ${label}\nPaid to ${fmtDate(coverage.end)}\n\nRecord this ECG bill?`);
  if(!ok)return;
  const old=clone(data);const originalEnd=p.end;
  p.ecgDeduction=round2((Number(p.ecgDeduction)||0)+bill);p.netAmount=newTotal;p.months=coverage.months;p.days=coverage.days;p.end=coverage.end;p.ecgUpdatedAt=new Date().toISOString();t.end=coverage.end;
  data.ecgBills.push({id:'e-'+Date.now(),tenantId:t.id,paymentId:p.id,totalAmount:state.available,ecgDeduction:bill,billAmount:inp.raw,billCurrency:inp.cur,fxRate:inp.fx,newTotal,monthsLeft:coverage.months,daysLeft:coverage.days,originalStart:start,originalEnd,newEnd:coverage.end,date:iso(today)});
  if(inp.fx){try{localStorage.setItem('mad-juliana-fx',String(inp.fx))}catch{}}
  save();render();lastReceipt=makeReceipt(t,p);$('receiptImage').src=lastReceipt;closeSheets();openSheet('receiptSheet');
  toastAction(`${t.name}: ECG ${money(bill,t.currency)} deducted · covers ${label}`,'Undo',()=>{data=old;save();render();lastReceipt=null},5000);
};

function deleteTenant(id){
  const t=tenant(id);if(!t)return;
  const ok=window.confirm(`Delete ${t.name}?\n\nThis will remove the tenant, their payment history, and ECG records. This cannot be undone except with the Undo button immediately after deletion.`);
  if(!ok)return;
  const old=clone(data);data.tenants=data.tenants.filter(x=>x.id!==id);data.payments=data.payments.filter(p=>p.tenantId!==id);data.ecgBills=data.ecgBills.filter(e=>e.tenantId!==id);if(selectedTenant===id){selectedTenant=null;closeSheets()}save();render();toastAction(`${t.name} deleted`,'Undo',()=>{data=old;save();render()},6000);
}

function openTenantSheet(id){const t=id?tenant(id):null;$('tenantId').value=t?.id||'';$('tenantSheetTitle').textContent=t?'Edit tenant':'Add tenant';$('tenantName').value=t?.name||'';$('tenantRate').value=t?.rate??'';$('tenantCurrency').value=t?.currency||'GHS';$('tenantPhone').value=t?.phone||'';$('tenantStart').value=t?.start||iso(today);$('tenantEnd').value=t?.end||addMonths(iso(today),12);$('tenantAmount').value='';$('tenantAmountRow').hidden=!!t;syncTenantEnd();openSheet('tenantSheet')}
$('addTenantBtn').onclick=()=>openTenantSheet();
// Adding a resident also records their first payment. Typing the amount paid works out "Paid to" for you.
function syncTenantEnd(){
  const hint=$('tenantCoverageHint');if(!hint)return;
  if($('tenantId').value){hint.hidden=true;return}
  const amt=Number($('tenantAmount').value)||0,rate=Number($('tenantRate').value)||0,start=$('tenantStart').value,endEl=$('tenantEnd');
  if(!(rate>0)||!start){hint.hidden=true;return}
  if(amt>0){const c=customCoverage(start,amt,rate);endEl.value=c.end;hint.hidden=false;hint.textContent=`${money(amt,$('tenantCurrency').value)} covers ${coverageLabel(c.months,c.days)} · paid to ${fmtDate(c.end)}`;return}
  if(endEl.value&&endEl.value>start){const c=coverageBetween(start,endEl.value);hint.hidden=false;hint.textContent=`First payment record: ${coverageLabel(c.months,c.days)} = ${money(amountForCoverage(rate,start,c.months,c.days),$('tenantCurrency').value)}`}else hint.hidden=true;
}
['tenantAmount','tenantRate','tenantStart','tenantCurrency'].forEach(i=>$(i).addEventListener('input',syncTenantEnd));
$('tenantEnd').addEventListener('input',()=>{$('tenantAmount').value='';syncTenantEnd()});
$('tenantForm').onsubmit=e=>{
  e.preventDefault();
  const id=$('tenantId').value;
  const payload={name:$('tenantName').value.trim(),rate:Number($('tenantRate').value),currency:$('tenantCurrency').value,phone:$('tenantPhone').value.trim(),start:$('tenantStart').value,end:$('tenantEnd').value};
  if(!payload.name||!(payload.rate>=0)||Number.isNaN(payload.rate)){toast('Enter a name and a monthly rate');return}
  if(!payload.start||!payload.end){toast('Choose the start period and paid-to date');return}
  const amt=Number($('tenantAmount').value)||0;
  if(!id&&amt>0&&payload.rate>0)payload.end=customCoverage(payload.start,amt,payload.rate).end;
  if(payload.end<=payload.start){toast('"Paid to" must be after the start period');return}
  const old=clone(data);
  if(id){
    const t=tenant(id);if(!t)return;const prevEnd=t.end;const lp=latestPayment(id);
    if(lp&&payload.end!==prevEnd&&payload.end<=(lp.start||t.start)){toast(`"Paid to" must be after ${fmtDate(lp.start||t.start)}, when the latest payment starts`);return}
    Object.assign(t,payload);
    if(payload.end!==prevEnd)syncLatestPaymentToEnd(t,payload.end);
    backfillPayments();
  }else{
    const t={id:'t-'+Date.now(),...payload};data.tenants.push(t);
    const first=makeInitialPayment(t,amt>0?amt:null);if(first)data.payments.push(first);
  }
  save();render();closeSheets();
  toastAction(id?'Tenant updated':'Tenant added and first payment recorded','Undo',()=>{data=old;save();render()},4000);
};

function openSheet(id){document.querySelectorAll('.sheet').forEach(s=>s.classList.remove('open'));$(id).classList.add('open');$(id).setAttribute('aria-hidden','false');$('backdrop').classList.add('open')}
function closeSheets(){document.querySelectorAll('.sheet').forEach(s=>{s.classList.remove('open');s.setAttribute('aria-hidden','true')});$('backdrop').classList.remove('open')}
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=closeSheets);$('backdrop').onclick=closeSheets;

function toastAction(msg,label,fn,ms=4000){clearTimeout(undoTimer);undoFn=fn;$('toastText').textContent=msg;$('toastUndo').hidden=false;$('toastUndo').textContent=label;$('toast').classList.add('show');undoTimer=setTimeout(()=>{$('toast').classList.remove('show');$('toastUndo').hidden=true;undoFn=null},ms)}
$('toastUndo').onclick=()=>{if(undoFn){undoFn();undoFn=null}$('toast').classList.remove('show');$('toastUndo').hidden=true};
function toast(msg){$('toastText').textContent=msg;$('toastUndo').hidden=true;$('toast').classList.add('show');setTimeout(()=>$('toast').classList.remove('show'),2200)}

$('exportBtn').onclick=()=>downloadText(JSON.stringify({app:'mad-juliana-tenants',type:'full-backup',version:APP_VERSION,exportedAt:new Date().toISOString(),data},null,2),`mad-juliana-tenants-backup-${iso(today)}.json`);
$('copyLinkBtn').onclick=async()=>{const link=encodeUpdateLink();try{await navigator.clipboard.writeText(link);toast('Update link copied to clipboard');}catch{const ta=document.createElement('textarea');ta.value=link;document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();toast('Update link copied to clipboard')}};
$('downloadPricesBtn').onclick=()=>downloadText(packageText(),`mad-juliana-tenant-prices-${iso(today)}.json`);
function formatChangedAt(s){if(!s)return 'Date not available';const d=new Date(s);if(Number.isNaN(d.getTime()))return 'Date not available';return d.toLocaleString('en-GB',{day:'numeric',month:'short',year:'numeric',hour:'numeric',minute:'2-digit'})}
function renderUpdatePreview(pkg){const el=$('updatePreview');if(!el)return;el.hidden=false;el.innerHTML=`<div class="update-meta"><b>Update found</b><span>Last changed: ${esc(formatChangedAt(pkg.exportedAt))}</span><span>App version: v${esc(pkg.version)}</span></div><div class="update-residents">${pkg.tenants.map(t=>`<div><span>${esc(t.name)}</span><strong>${money(t.rate,t.currency)}/mo</strong></div>`).join('')}</div><div class="update-actions"><button id="cancelUpdateBtn" class="settings-btn">Cancel</button><button id="confirmUpdateBtn" class="settings-btn sync-primary">Okay, add update</button></div>`;$('cancelUpdateBtn').onclick=()=>{pendingPriceUpdate=null;el.hidden=true};$('confirmUpdateBtn').onclick=()=>{if(!pendingPriceUpdate)return;try{const result=applyPricePackage(pendingPriceUpdate);pendingPriceUpdate=null;el.hidden=true;toastAction(`${result.updated} resident${result.updated===1?'':'s'} updated${result.added?` · ${result.added} added`:''}`,'Undo',()=>{data=result.old;save();render()},5000)}catch(e){toast(e.message||'Could not apply update')}}}
$('applyLinkBtn').onclick=async()=>{try{if(!navigator.clipboard?.readText)throw new Error('Clipboard reading is not available here.');const raw=(await navigator.clipboard.readText()).trim();if(!raw)throw new Error('Your clipboard is empty. Copy the update link first.');let pkg;if(raw.includes('#update='))pkg=decodeUpdateLink(raw);else{try{pkg=JSON.parse(raw)}catch{throw new Error('Clipboard does not contain a Mad Juliana update link')}}pendingPriceUpdate=normalizePricePackage(pkg);renderUpdatePreview(pendingPriceUpdate)}catch(e){toast(e.message||'Could not read the clipboard')}};
$('updateLink').value='';
if(location.hash.startsWith('#update=')){setTimeout(()=>{try{navigator.clipboard?.writeText(location.href);showView('settings');toast('Update link copied. Tap Paste from clipboard to review it.')}catch{showView('settings')}},150)}

$('resetBtn').onclick=()=>{if(confirm('Reset to the four original tenants and payment records?')){data=clone(original);save();render();toast('Original tenant records restored')}};
