const APP_VERSION='2.3.4';
const DB_NAME='mad-juliana-tenants-db';
const DB_STORE='app';
const DB_KEY='state';
const KEY='mad-juliana-tenants-v1';
const $=id=>document.getElementById(id);
const today=new Date();
const pad=n=>String(n).padStart(2,'0');
const iso=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const fmtDate=s=>{if(!s)return '—';const d=new Date(`${s}T00:00:00`);return d.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}).replace(/ /g,' ')};
const addMonths=(date,n)=>{const d=new Date(date+'T00:00:00');const day=d.getDate();d.setDate(1);d.setMonth(d.getMonth()+n);const last=new Date(d.getFullYear(),d.getMonth()+1,0).getDate();d.setDate(Math.min(day,last));return iso(d)};
const daysInMonth=s=>{const d=new Date(s+'T00:00:00');return new Date(d.getFullYear(),d.getMonth()+1,0).getDate()};
function customCoverage(start,amount,rate){const safeRate=Number(rate)||0;const paid=Number(amount)||0;if(!safeRate||paid<=0)return {months:0,days:0,end:start};const exact=paid/safeRate;const months=Math.floor(exact+1e-9);const remainder=Math.max(0,exact-months);const afterMonths=addMonths(start,months);const days=Math.floor(remainder*daysInMonth(afterMonths)+1e-9);const end=iso(new Date(new Date(afterMonths+'T00:00:00').getTime()+days*86400000));return {months,days,end};}
const coverageLabel=(months,days)=>{const parts=[];if(months)parts.push(`${months} month${months===1?'':'s'}`);if(days)parts.push(`${days} day${days===1?'':'s'}`);return parts.join(' + ')||'0 days'};
const monthDiff=(a,b)=>{const x=new Date(a+'T00:00:00'),y=new Date(b+'T00:00:00');return Math.max(0,(y.getFullYear()-x.getFullYear())*12+y.getMonth()-x.getMonth())};
const money=(n,c='GHS')=>new Intl.NumberFormat('en-US',{style:'currency',currency:c,minimumFractionDigits:2}).format(Number(n)||0).replace('GHS','GHS').replace('USD','$');
const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

const original={
  tenants:[
    {id:'eudia',name:'Eudia Agyei (Nurse)',currency:'GHS',rate:160,phone:'',start:'2026-03-01',end:'2027-03-01'},
    {id:'emmanuella-afriyie',name:'Emmanuella Afriyie',currency:'USD',rate:250,phone:'',start:'2026-04-01',end:'2027-04-01'},
    {id:'stephen',name:'Stephen Awonu (Borga)',currency:'GHS',rate:160,phone:'',start:'2026-01-01',end:'2026-06-01'},
    {id:'emmanuella-osei',name:'Emmanuella Osei',currency:'GHS',rate:170,phone:'',start:'2026-06-01',end:'2027-06-01'}
  ],
  payments:[
    {id:'p-eudia',tenantId:'eudia',amount:1920,currency:'GHS',months:12,start:'2026-03-01',end:'2027-03-01',date:'2026-03-01',note:'Original tenancy payment'},
    {id:'p-afriyie',tenantId:'emmanuella-afriyie',amount:3000,currency:'USD',months:12,start:'2026-04-01',end:'2027-04-01',date:'2026-04-01',note:'Original tenancy payment'},
    {id:'p-stephen',tenantId:'stephen',amount:965,currency:'GHS',months:6,start:'2026-01-01',end:'2026-06-01',date:'2026-01-01',note:'Original tenancy payment · GHS 1,900 − GHS 935'},
    {id:'p-stephen-1000',tenantId:'stephen',amount:1000,currency:'GHS',months:6,days:7,start:'2026-06-01',end:'2027-01-08',date:'2026-10-06',note:'Payment received · GHS 1,000 · Borga'},
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
let storageReady=false;
let storageLastSaved=null;
let currentView='home', selectedTenant=null, lastReceipt=null, undoTimer=null, undoFn=null, pendingPriceUpdate=null;
function clone(x){return JSON.parse(JSON.stringify(x))}
function load(){try{const x=JSON.parse(localStorage.getItem(KEY));if(x?.tenants?.length)return x}catch{}return clone(original)}
function openStateDB(){return new Promise((resolve,reject)=>{if(!('indexedDB' in window)){reject(new Error('IndexedDB unavailable'));return}const req=indexedDB.open(DB_NAME,1);req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(DB_STORE))db.createObjectStore(DB_STORE)};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error||new Error('Could not open local database'))})}
async function readStateDB(){const db=await openStateDB();return new Promise((resolve,reject)=>{const tx=db.transaction(DB_STORE,'readonly');const req=tx.objectStore(DB_STORE).get(DB_KEY);req.onsuccess=()=>{db.close();resolve(req.result||null)};req.onerror=()=>{db.close();reject(req.error)}})}
async function writeStateDB(snapshot){const db=await openStateDB();return new Promise((resolve,reject)=>{const tx=db.transaction(DB_STORE,'readwrite');tx.objectStore(DB_STORE).put(snapshot,DB_KEY);tx.oncomplete=()=>{db.close();resolve(true)};tx.onerror=()=>{db.close();reject(tx.error||new Error('Could not save local database'))}})}
async function requestPersistentStorage(){try{if(navigator.storage?.persist){const already=await navigator.storage.persisted();if(!already)await navigator.storage.persist();}}catch{} }
function save(){const snapshot={...clone(data),updatedAt:new Date().toISOString()};data=snapshot;storageLastSaved=snapshot.updatedAt;try{localStorage.setItem(KEY,JSON.stringify(snapshot))}catch{};writeStateDB(snapshot).then(()=>{storageReady=true;renderStorageStatus()}).catch(()=>renderStorageStatus());requestPersistentStorage();renderStorageStatus()}
async function hydratePersistentState(){try{const stored=await readStateDB();if(stored?.tenants?.length){const localTime=Date.parse(data.updatedAt||'');const dbTime=Date.parse(stored.updatedAt||'');if(dbTime>localTime){data=stored;try{localStorage.setItem(KEY,JSON.stringify(data))}catch{};storageLastSaved=stored.updatedAt;render()}}storageReady=true;renderStorageStatus()}catch{storageReady=false;renderStorageStatus()}requestPersistentStorage();if(!data.updatedAt)save()}
function tenant(id){return data.tenants.find(t=>t.id===id)}
function pricePackage(){return {app:'mad-juliana-tenants',type:'tenant-price-update',version:APP_VERSION,exportedAt:new Date().toISOString(),tenants:data.tenants.map(t=>({id:t.id,name:t.name,currency:t.currency,rate:t.rate,phone:t.phone||'',start:t.start,end:t.end}))}}
function packageText(){return JSON.stringify(pricePackage(),null,2)}
function encodeUpdateLink(){const json=JSON.stringify(pricePackage());const bytes=new TextEncoder().encode(json);let binary='';bytes.forEach(b=>binary+=String.fromCharCode(b));return `${location.origin}${location.pathname}#update=${btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}`}
function decodeUpdateLink(value){const raw=String(value||'').trim();const marker='#update=';const i=raw.indexOf(marker);if(i<0)throw new Error('That is not a Mad Juliana update link');let token=raw.slice(i+marker.length).split(/[?#&\s]/)[0].replace(/-/g,'+').replace(/_/g,'/');while(token.length%4)token+='=';const binary=atob(token);const bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));return JSON.parse(new TextDecoder().decode(bytes))}
function receiptCoverageLabel(p){const months=Number(p.months)||0,days=Number(p.days)||0;if(days===7)return `${months ? `${months} month${months===1?'':'s'} + ` : ''}1 week`;return coverageLabel(months,days)}
function downloadText(text,name,mime='application/json'){const blob=new Blob([text],{type:mime});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
function normalizePricePackage(raw){if(!raw||typeof raw!=='object')throw new Error('Invalid update');if(raw.app!=='mad-juliana-tenants'||raw.type!=='tenant-price-update'||!Array.isArray(raw.tenants))throw new Error('This is not a Mad Juliana price update');const tenants=raw.tenants.map(t=>({id:String(t.id||''),name:String(t.name||'').trim(),currency:t.currency==='USD'?'USD':'GHS',rate:Number(t.rate),phone:String(t.phone||''),start:String(t.start||''),end:String(t.end||'')})).filter(t=>t.name&&t.rate>=0);if(!tenants.length)throw new Error('No valid tenants found');return {version:raw.version||'unknown',exportedAt:raw.exportedAt||'',tenants}}
function applyPricePackage(raw){const pkg=normalizePricePackage(raw);const old=clone(data);const byId=new Map(data.tenants.map(t=>[t.id,t]));const byName=new Map(data.tenants.map(t=>[t.name.trim().toLowerCase(),t]));let added=0,updated=0;pkg.tenants.forEach(incoming=>{let t=(incoming.id&&byId.get(incoming.id))||byName.get(incoming.name.toLowerCase());if(t){Object.assign(t,incoming);updated++}else{const id=incoming.id&&!byId.has(incoming.id)?incoming.id:'t-'+Date.now()+'-'+Math.random().toString(36).slice(2,7);data.tenants.push({...incoming,id});added++}});save();render();return {old,added,updated,version:pkg.version}}

function status(t){const now=iso(today);if(t.end<now)return ['Expired','expired'];const days=Math.ceil((new Date(t.end)-new Date(now))/86400000);if(days<=60)return [`Ends in ${days}d`,'soon'];return ['Active','active']}
function activeCount(){return data.tenants.filter(t=>status(t)[1]!=='expired').length}
function totalRecorded(currency){return data.payments.filter(p=>p.currency===currency).reduce((s,p)=>s+p.amount,0)}
function showView(v){currentView=v;document.querySelectorAll('.view').forEach(x=>x.classList.toggle('active',x.id===v+'View'));document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x.dataset.view===v));window.scrollTo({top:0,behavior:'smooth'});render()}

document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.view)));
$('brandBtn').onclick=()=>showView('home');$('settingsBtn').onclick=()=>showView('settings');

autoRender();
hydratePersistentState();
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
  $('peopleList').innerHTML=list.map(t=>{const [label,cls]=status(t);return `<button class="person-row" data-person="${t.id}"><div class="avatar">${t.name.split(' ').map(x=>x[0]).slice(0,2).join('')}</div><div class="person-main"><strong>${esc(t.name)}</strong><span>${money(t.rate,t.currency)}/month · paid to ${fmtDate(t.end)}</span></div><span class="status ${cls}">${label}</span><i>›</i></button>`}).join('')||`<div class="empty">No tenants found.</div>`;
  document.querySelectorAll('[data-person]').forEach(b=>b.onclick=()=>openDetail(b.dataset.person));
}
function approximateCoverage(p){
  const months=Number(p.months)||0, days=Number(p.days)||0;
  if(months===0) return 'Less than a month';
  return `About ${months + (days>=15 ? 1 : 0)} month${(months + (days>=15 ? 1 : 0))===1?'':'s'}`;
}
function paymentMonthHeader(date){
  const d=new Date(`${date}T00:00:00`);
  return d.toLocaleDateString('en-US',{month:'long',year:'numeric'}).toUpperCase();
}
function renderPayments(){
  const ps=[...data.payments].sort((a,b)=>(b.date||'').localeCompare(a.date||''));
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
  $('paymentsList').innerHTML=groups.map(g=>`<section class="payment-group"><h3 class="payment-month-header">${esc(g.title)}</h3><div class="payment-group-list">${g.items.map(p=>{const t=tenant(p.tenantId);if(!t)return '';const [statusLabel,statusClass]=status(t);const badge=statusClass==='active'?'':`<span class="status ${statusClass}">${statusLabel}</span>`;return `<button class="payment-row ${statusClass}" data-person="${esc(t.id)}"><div class="payment-main"><div class="payment-row-top"><strong>${esc(t.name)}</strong><strong class="payment-amount">${money(p.amount,p.currency)}</strong></div><div class="payment-row-bottom"><span>${approximateCoverage(p)}</span>${badge}</div></div><i class="payment-chevron">›</i></button>`}).join('')}</div></section>`).join('')||`<div class="empty">No payments yet.</div>`;
  document.querySelectorAll('#paymentsList [data-person]').forEach(b=>b.onclick=()=>openDetail(b.dataset.person));
}
function latestPayment(id){return [...data.payments].filter(p=>p.tenantId===id).sort((a,b)=>(b.date||'').localeCompare(a.date||''))[0]||null}
function renderReminders(){
  const sorted=[...data.tenants].sort((a,b)=>a.end.localeCompare(b.end));
  $('remindersList').innerHTML=sorted.map(t=>{const [label,cls]=status(t);const p=latestPayment(t.id);return `<div class="reminder-row"><div class="avatar small">${t.name.split(' ').map(x=>x[0]).slice(0,2).join('')}</div><div><strong>${esc(t.name)}</strong><span>Paid to ${fmtDate(t.end)}</span></div><span class="status ${cls}">${label}</span>${p?`<button class="reminder-print" type="button" data-receipt-tenant="${esc(t.id)}" aria-label="Open and share receipt for ${esc(t.name)}">Receipt</button>`:'<span class="no-receipt">No receipt</span>'}</div>`}).join('');
  document.querySelectorAll('[data-receipt-tenant]').forEach(b=>b.onclick=()=>openReceiptForTenant(b.dataset.receiptTenant,true));
  const history=[...data.payments].sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  const el=$('reminderHistoryList');
  if(el) el.innerHTML=history.map(p=>{const t=tenant(p.tenantId);if(!t)return '';return `<button class="history-row history-row-button" data-history-person="${esc(t.id)}"><div><b>${esc(t.name)}</b><span>${fmtDate(p.date)} · ${approximateCoverage(p)}${p.note?` · ${esc(p.note)}`:''}</span></div><strong>${money(p.amount,p.currency)}</strong></button>`}).join('')||'<div class="empty">No payment records.</div>';
  document.querySelectorAll('[data-history-person]').forEach(b=>b.onclick=()=>openDetail(b.dataset.historyPerson));
}
$('peopleSearch').oninput=renderPeople;

function openDetail(id){selectedTenant=id;const t=tenant(id);$('detailName').textContent=t.name;$('detailEnd').textContent=fmtDate(t.end);$('detailRate').textContent=money(t.rate,t.currency)+'/month';const [label,cls]=status(t);$('detailStatus').textContent=label;$('detailStatus').className='detail-status '+cls;openSheet('tenantDetailSheet')}
$('extendBtn').onclick=()=>{closeSheets();openPaymentSheet(selectedTenant)};
$('ecgBillBtn').onclick=()=>{closeSheets();openEcgSheet(selectedTenant)};
$('detailReceiptBtn').onclick=()=>openReceiptForTenant(selectedTenant,true);
$('editTenantBtn').onclick=()=>{closeSheets();openTenantSheet(selectedTenant)};

function populatePaymentTenants(){const el=$('paymentTenant');const current=el.value;el.innerHTML=data.tenants.map(t=>`<option value="${t.id}">${esc(t.name)} · ${money(t.rate,t.currency)}/mo</option>`).join('');if(selectedTenant&&tenant(selectedTenant))el.value=selectedTenant;else if(current&&tenant(current))el.value=current;updatePaymentPreview()}
function openPaymentSheet(id){selectedTenant=id||selectedTenant;populatePaymentTenants();$('paymentTenant').value=selectedTenant||data.tenants[0]?.id||'';$('paymentDate').value=iso(today);$('paymentMonths').value=6;$('paymentNote').value='';setDuration('6');openSheet('paymentSheet')}
function setDuration(v){document.querySelectorAll('[data-duration]').forEach(b=>b.classList.toggle('selected',b.dataset.duration===String(v)));const custom=v==='custom';$('paymentMonths').readOnly=true;$('customHelper').hidden=!custom;const t=tenant($('paymentTenant').value);if(!custom&&t){$('paymentMonths').value=Number(v);$('paymentAmount').value=(t.rate*Number(v)).toFixed(2)}else if(t&&custom){$('paymentAmount').value='';$('paymentMonths').value='';}updatePaymentPreview()}
document.querySelectorAll('[data-duration]').forEach(b=>b.onclick=()=>setDuration(b.dataset.duration));
$('paymentTenant').onchange=()=>{const t=tenant($('paymentTenant').value);const custom=document.querySelector('[data-duration].selected')?.dataset.duration==='custom';if(t&&!custom)$('paymentAmount').value=(t.rate*Number($('paymentMonths').value||6)).toFixed(2);updatePaymentPreview()};$('paymentMonths').oninput=updatePaymentPreview;$('paymentAmount').oninput=updatePaymentPreview;
function updatePaymentPreview(){const t=tenant($('paymentTenant').value);if(!t){$('periodPreview').textContent='';return}const amount=Number($('paymentAmount').value||0);const start=t.end;let months=0,days=0,end=start;if(amount>0){const x=customCoverage(start,amount,t.rate);months=x.months;days=x.days;end=x.end;$('paymentMonths').value=months||'';}const label=amount>0?coverageLabel(months,days):'Enter amount';$('periodPreview').innerHTML=`<span>PAYMENT COVERS</span><b>${fmtDate(start)} → ${fmtDate(end)}</b><small>${label} · ${money(amount,t.currency)}</small>`}
function formatCalculationNote(note){
  const raw=String(note||'');
  const m=raw.match(/(?:GH¢|GHS|USD|\$)\s*([\d,]+(?:\.\d+)?)\s*[−–-]\s*(?:GH¢|GHS|USD|\$)\s*([\d,]+(?:\.\d+)?)\s*(?:=\s*(?:GH¢|GHS|USD|\$)\s*([\d,]+(?:\.\d+)?))?/i);
  if(!m)return '';
  const a=m[1].replace(/,/g,''),b=m[2].replace(/,/g,''),c=m[3]?(m[3].replace(/,/g,'')):String(Number(a)-Number(b));
  return `GH¢  ${a}- GHS ${b} = GH¢  ${c}`;
}
function makeReceipt(t,p){
  const hasEcg=Number(p.ecgDeduction)>0 || p.type==='ecg';
  const canvas=document.createElement('canvas');canvas.width=1000;canvas.height=hasEcg?1180:1120;const c=canvas.getContext('2d');
  const receiptTenantName=String(t.name||'').replace(/\s*\([^)]*\)/g,'').trim();
  c.fillStyle='#fff';c.fillRect(0,0,1000,canvas.height);c.fillStyle='#111';c.textAlign='center';c.font='700 42px Georgia';c.fillText('TENANCY AGREEMENT',500,72);c.fillRect(385,86,230,3);
  const calc=formatCalculationNote(p.note);let y=135;if(calc){c.font='700 25px Georgia';c.fillText(calc,500,y);y+=58}
  const periodText=`${monthYear(p.start)} TO ${monthYear(p.end)}`;
  const rows=[['LAND LADY','JULIANA AIDA ANTWI'],['TENANT',receiptTenantName.toUpperCase()],['PERIOD',periodText],['MONTHLY RATE',money(t.rate,t.currency)],['START PERIOD',monthYear(p.start)],['END PERIOD',monthYear(p.end)]];
  if(p.type==='ecg'){
    rows.push(['TOTAL',money(p.totalAmount,p.currency)]);
    rows.push(['ECG BILL',money(p.ecgDeduction,p.currency)]);
    rows.push(['NEW TOTAL',money(p.newTotal,p.currency)]);
    rows.push(['MONTHS LEFT',`${Number(p.monthsLeft)||0} month${Number(p.monthsLeft)===1?'':'s'}`]);
  }else{
    rows.push(['AMOUNT',money(p.netAmount??p.amount,p.currency)]);
    if(hasEcg){rows.push(['ECG DEDUCTED',money(p.ecgDeduction,p.currency)]);rows.push(['MONTHS LEFT',`${Number(p.months)||0} month${Number(p.months)===1?'':'s'}`])}
  }
  c.textAlign='left';rows.forEach(([a,b])=>{c.font='700 25px Georgia';c.fillText(a,100,y);c.textAlign='center';c.font='400 25px Georgia';c.fillText(b,650,y);c.textAlign='left';y+=58});
  y+=28;c.font='700 23px Georgia';c.fillText('Landlady:',100,y);c.fillText('Tenant:',600,y);y+=34;c.font='400 23px Georgia';c.fillText('Juliana Aida Antwi',100,y);c.fillText(receiptTenantName,600,y);y+=34;c.fillText('Signed',100,y);c.fillText('Signed',600,y);
  c.fillStyle='#777';c.font='400 17px Georgia';c.fillText(`${p.type==='ecg'?'ECG bill date':'Payment date'}: ${fmtDate(p.date)}`,100,hasEcg?1120:1060);
  return canvas.toDataURL('image/png');
}
function makeEcgReceipt(t,e){return makeReceipt(t,{...e,type:'ecg',start:e.originalStart||t.start,end:e.originalEnd||t.end,monthsLeft:e.monthsLeft})}
function monthYear(s){return new Date(s+'T00:00:00').toLocaleDateString('en-US',{month:'long',year:'numeric'}).toUpperCase()}
function dataUrlToBlob(dataUrl){const [head,body]=String(dataUrl).split(',');const mime=(head.match(/data:([^;]+)/)||[])[1]||'image/png';const bin=atob(body);const bytes=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);return new Blob([bytes],{type:mime})}
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
async function openReceiptForTenant(id,autoShare=false){const t=tenant(id),p=latestPayment(id);if(!t||!p){toast('No receipt available for this tenant yet');return}lastReceipt=makeReceipt(t,p);$('receiptImage').src=lastReceipt;closeSheets();openSheet('receiptSheet');if(autoShare)await shareReceiptImage()}
$('shareReceiptBtn').onclick=()=>shareReceiptImage();
function downloadReceipt(){if(!lastReceipt)return;const a=document.createElement('a');a.href=lastReceipt;a.download='tenancy-agreement.png';document.body.appendChild(a);a.click();a.remove();}
$('downloadReceiptBtn').onclick=downloadReceipt;

$('paymentForm').onsubmit=e=>{e.preventDefault();const t=tenant($('paymentTenant').value);if(!t){toast('Choose a tenant first');return}const amount=Number($('paymentAmount').value);if(!(amount>0)){toast('Enter a payment amount');return}const start=t.end;const calc=customCoverage(start,amount,t.rate);if(calc.months===0&&calc.days===0){toast('The payment is too small to cover any time');return}const label=receiptCoverageLabel({months:calc.months,days:calc.days});const ok=window.confirm(`${t.name}

Payment ${money(amount,t.currency)}
Covers ${label}
Paid to ${fmtDate(calc.end)}

Record this payment?`);if(!ok)return;const old=clone(data);const p={id:'p-'+Date.now(),tenantId:t.id,amount,currency:t.currency,netAmount:amount,months:calc.months,days:calc.days,start,end:calc.end,date:$('paymentDate').value||iso(today),note:$('paymentNote').value.trim()};data.payments.push(p);t.end=calc.end;save();render();lastReceipt=makeReceipt(t,p);$('receiptImage').src=lastReceipt;closeSheets();openSheet('receiptSheet');toastAction(`${t.name}: ${money(amount,t.currency)} recorded · ${label}`,'Undo',()=>{data=old;save();render();lastReceipt=null},5000)};

function openEcgSheet(id){selectedTenant=id||selectedTenant;const t=tenant(selectedTenant);if(!t)return;$('ecgTenant').textContent=t.name;$('ecgCurrentPaidTo').textContent=fmtDate(t.end);$('ecgRate').textContent=money(t.rate,t.currency)+'/month';$('ecgAmount').value='';$('ecgPreview').textContent='Enter the ECG bill amount.';openSheet('ecgSheet')}
$('ecgAmount').oninput=()=>{const t=tenant(selectedTenant);const bill=Number($('ecgAmount').value||0);if(!t||bill<=0){$('ecgPreview').textContent='Enter the ECG bill amount.';return}const latest=latestPayment(t.id);const priorEcg=latest?data.ecgBills.filter(x=>x.paymentId===latest.id).reduce((sum,x)=>sum+(Number(x.ecgDeduction)||0),0):0;const total=Math.max(0,Number(latest?.netAmount??latest?.amount??0)-priorEcg);const newTotal=Math.max(0,total-bill);const monthsLeft=Math.max(0,Math.floor(newTotal/(Number(t.rate)||1)+1e-9));const originalStart=latest?.start||t.start;const originalEnd=latest?.end||t.end;$('ecgPreview').innerHTML=`<span>TOTAL</span><b>${money(total,t.currency)}</b><small>ECG bill · ${money(bill,t.currency)} · New total ${money(newTotal,t.currency)} · ${monthsLeft} month${monthsLeft===1?'':'s'} left</small>`};
$('ecgForm').onsubmit=ev=>{ev.preventDefault();const t=tenant(selectedTenant);const bill=Number($('ecgAmount').value||0);if(!t||bill<=0){toast('Enter the ECG bill amount');return}const latest=latestPayment(t.id);const priorEcg=latest?data.ecgBills.filter(x=>x.paymentId===latest.id).reduce((sum,x)=>sum+(Number(x.ecgDeduction)||0),0):0;const total=Math.max(0,Number(latest?.netAmount??latest?.amount??0)-priorEcg);if(!(total>0)){toast('There is no payment amount available to deduct from');return}if(bill>=total){toast('ECG bill must be less than the payment total');return}const newTotal=total-bill;const monthsLeft=Math.max(0,Math.floor(newTotal/(Number(t.rate)||1)+1e-9));const originalEnd=t.end;const originalStart=latest?.start||t.start;const newCoverage=customCoverage(originalStart,newTotal,t.rate);const ok=window.confirm(`${t.name}

Total ${money(total,t.currency)}
ECG Bill ${money(bill,t.currency)}
New Total ${money(newTotal,t.currency)}
Months left ${monthsLeft}
Paid to ${fmtDate(newCoverage.end)}

Record this ECG bill?`);if(!ok)return;const old=clone(data);const billRec={id:'e-'+Date.now(),tenantId:t.id,paymentId:latest?.id||null,totalAmount:total,ecgDeduction:bill,newTotal,monthsLeft,originalStart,originalEnd,date:iso(today)};data.ecgBills.push(billRec);t.end=newCoverage.end;save();render();lastReceipt=makeEcgReceipt(t,billRec);$('receiptImage').src=lastReceipt;closeSheets();openSheet('receiptSheet');toastAction(`${t.name}: ECG ${money(bill,t.currency)} deducted · ${monthsLeft} month${monthsLeft===1?'':'s'} left`,'Undo',()=>{data=old;save();render();lastReceipt=null},5000)};


function openTenantSheet(id){const t=id?tenant(id):null;$('tenantId').value=t?.id||'';$('tenantSheetTitle').textContent=t?'Edit tenant':'Add tenant';$('tenantName').value=t?.name||'';$('tenantRate').value=t?.rate??'';$('tenantCurrency').value=t?.currency||'GHS';$('tenantPhone').value=t?.phone||'';$('tenantStart').value=t?.start||iso(today);$('tenantEnd').value=t?.end||addMonths(iso(today),12);openSheet('tenantSheet')}
$('addTenantBtn').onclick=()=>openTenantSheet();
$('tenantForm').onsubmit=e=>{e.preventDefault();const id=$('tenantId').value;const payload={name:$('tenantName').value.trim(),rate:Number($('tenantRate').value),currency:$('tenantCurrency').value,phone:$('tenantPhone').value.trim(),start:$('tenantStart').value,end:$('tenantEnd').value};if(!payload.name||payload.rate<0)return;const old=clone(data);if(id)Object.assign(tenant(id),payload);else data.tenants.push({id:'t-'+Date.now(),...payload});save();closeSheets();render();toastAction(id?'Tenant updated':'Tenant added','Undo',()=>{data=old;save();render()},4000)};

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
