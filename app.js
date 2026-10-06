const APP_VERSION='2.1.0';
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
    {id:'eudia',name:'Eudia Agyei',currency:'GHS',rate:160,phone:'',start:'2026-03-01',end:'2027-03-01'},
    {id:'emmanuella-afriyie',name:'Emmanuella Afriyie',currency:'USD',rate:250,phone:'',start:'2026-04-01',end:'2027-04-01'},
    {id:'stephen',name:'Stephen Awonu',currency:'GHS',rate:160,phone:'',start:'2026-01-01',end:'2026-06-01'},
    {id:'emmanuella-osei',name:'Emmanuella Osei',currency:'GHS',rate:170,phone:'',start:'2026-06-01',end:'2027-06-01'}
  ],
  payments:[
    {id:'p-eudia',tenantId:'eudia',amount:1920,currency:'GHS',months:12,start:'2026-03-01',end:'2027-03-01',date:'2026-03-01',note:'Original tenancy payment'},
    {id:'p-afriyie',tenantId:'emmanuella-afriyie',amount:3000,currency:'USD',months:12,start:'2026-04-01',end:'2027-04-01',date:'2026-04-01',note:'Original tenancy payment'},
    {id:'p-stephen',tenantId:'stephen',amount:965,currency:'GHS',months:6,start:'2026-01-01',end:'2026-06-01',date:'2026-01-01',note:'Original tenancy payment · GHS 1,900 − GHS 935'},
    {id:'p-osei',tenantId:'emmanuella-osei',amount:2040,currency:'GHS',months:12,start:'2026-06-01',end:'2027-06-01',date:'2026-06-01',note:'Original tenancy payment'}
  ]
};
let data=load();
let currentView='home', selectedTenant=null, lastReceipt=null, undoTimer=null, undoFn=null;
function clone(x){return JSON.parse(JSON.stringify(x))}
function load(){try{const x=JSON.parse(localStorage.getItem(KEY));if(x?.tenants?.length)return x}catch{}return clone(original)}
function save(){localStorage.setItem(KEY,JSON.stringify(data))}
function tenant(id){return data.tenants.find(t=>t.id===id)}
function pricePackage(){return {app:'mad-juliana-tenants',type:'tenant-price-update',version:APP_VERSION,exportedAt:new Date().toISOString(),tenants:data.tenants.map(t=>({id:t.id,name:t.name,currency:t.currency,rate:t.rate,phone:t.phone||'',start:t.start,end:t.end}))}}
function packageText(){return JSON.stringify(pricePackage(),null,2)}
function downloadText(text,name,mime='application/json'){const blob=new Blob([text],{type:mime});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
function normalizePricePackage(raw){if(!raw||typeof raw!=='object')throw new Error('Invalid update');if(raw.app!=='mad-juliana-tenants'||raw.type!=='tenant-price-update'||!Array.isArray(raw.tenants))throw new Error('This is not a Mad Juliana price update');const tenants=raw.tenants.map(t=>({id:String(t.id||''),name:String(t.name||'').trim(),currency:t.currency==='USD'?'USD':'GHS',rate:Number(t.rate),phone:String(t.phone||''),start:String(t.start||''),end:String(t.end||'')})).filter(t=>t.name&&t.rate>=0);if(!tenants.length)throw new Error('No valid tenants found');return {version:raw.version||'unknown',tenants}}
function applyPricePackage(raw){const pkg=normalizePricePackage(raw);const old=clone(data);const byId=new Map(data.tenants.map(t=>[t.id,t]));const byName=new Map(data.tenants.map(t=>[t.name.trim().toLowerCase(),t]));let added=0,updated=0;pkg.tenants.forEach(incoming=>{let t=(incoming.id&&byId.get(incoming.id))||byName.get(incoming.name.toLowerCase());if(t){Object.assign(t,incoming);updated++}else{const id=incoming.id&&!byId.has(incoming.id)?incoming.id:'t-'+Date.now()+'-'+Math.random().toString(36).slice(2,7);data.tenants.push({...incoming,id});added++}});save();render();return {old,added,updated,version:pkg.version}}

function status(t){const now=iso(today);if(t.end<now)return ['Expired','expired'];const days=Math.ceil((new Date(t.end)-new Date(now))/86400000);if(days<=60)return [`Ends in ${days}d`,'soon'];return ['Active','active']}
function activeCount(){return data.tenants.filter(t=>status(t)[1]!=='expired').length}
function totalRecorded(currency){return data.payments.filter(p=>p.currency===currency).reduce((s,p)=>s+p.amount,0)}
function showView(v){currentView=v;document.querySelectorAll('.view').forEach(x=>x.classList.toggle('active',x.id===v+'View'));document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x.dataset.view===v));window.scrollTo({top:0,behavior:'smooth'});render()}

document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.view)));
$('brandBtn').onclick=()=>showView('home');$('settingsBtn').onclick=()=>showView('settings');

autoRender();
function autoRender(){render();}
function render(){renderHome();renderPeople();renderPayments();renderReminders();renderPricePreview();populatePaymentTenants();}
function renderPricePreview(){const el=$('pricePreview');if(!el)return;el.textContent=data.tenants.map(t=>`${t.name} — ${money(t.rate,t.currency)} / month`).join('\n')||'No residents yet.'}
function renderHome(){
  $('homeTenantCount').textContent=data.tenants.length;$('homeActiveCount').textContent=activeCount();
  $('homeCollected').textContent=money(totalRecorded('GHS'),'GHS');
  $('homeEndingSoon').textContent=data.tenants.filter(t=>status(t)[1]==='soon').length;
  $('homeExpired').textContent=data.tenants.filter(t=>status(t)[1]==='expired').length;
}
function renderPeople(){
  const q=($('peopleSearch')?.value||'').toLowerCase().trim();
  const list=data.tenants.filter(t=>t.name.toLowerCase().includes(q));
  $('peopleList').innerHTML=list.map(t=>{const [label,cls]=status(t);return `<button class="person-row" data-person="${t.id}"><div class="avatar">${t.name.split(' ').map(x=>x[0]).slice(0,2).join('')}</div><div class="person-main"><strong>${esc(t.name)}</strong><span>${money(t.rate,t.currency)}/month · paid through ${fmtDate(t.end)}</span></div><span class="status ${cls}">${label}</span><i>›</i></button>`}).join('')||`<div class="empty">No tenants found.</div>`;
  document.querySelectorAll('[data-person]').forEach(b=>b.onclick=()=>openDetail(b.dataset.person));
}
function renderPayments(){
  const ps=[...data.payments].sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  $('paymentRecordCount').textContent=ps.length;$('paymentTotal').textContent=money(totalRecorded('GHS'),'GHS');
  $('paymentsList').innerHTML=ps.map(p=>{const t=tenant(p.tenantId);return `<button class="payment-row" data-person="${t.id}"><div class="payment-date"><b>${new Date(p.date+'T00:00:00').toLocaleDateString('en-US',{month:'short'})}</b><small>${new Date(p.date+'T00:00:00').getFullYear()}</small></div><div class="payment-main"><strong>${esc(t.name)}</strong><span>${fmtDate(p.start)} → ${fmtDate(p.end)} · ${p.months?`${p.months} month${p.months===1?'':'s'}${p.days?` + ${p.days} day${p.days===1?'':'s'}`:''}`:'Custom'}</span></div><strong class="payment-amount">${money(p.amount,p.currency)}</strong><i>›</i></button>`}).join('')||`<div class="empty">No payments yet.</div>`;
  document.querySelectorAll('#paymentsList [data-person]').forEach(b=>b.onclick=()=>openDetail(b.dataset.person));
}
function renderReminders(){
  const sorted=[...data.tenants].sort((a,b)=>a.end.localeCompare(b.end));
  $('remindersList').innerHTML=sorted.map(t=>{const [label,cls]=status(t);return `<div class="reminder-row"><div class="avatar small">${t.name.split(' ').map(x=>x[0]).slice(0,2).join('')}</div><div><strong>${esc(t.name)}</strong><span>Payment ends ${fmtDate(t.end)}</span></div><span class="status ${cls}">${label}</span></div>`}).join('');
}
$('peopleSearch').oninput=renderPeople;

function openDetail(id){selectedTenant=id;const t=tenant(id);$('detailName').textContent=t.name;$('detailEnd').textContent=fmtDate(t.end);$('detailRate').textContent=money(t.rate,t.currency)+'/month';const [label,cls]=status(t);$('detailStatus').textContent=label;$('detailStatus').className='detail-status '+cls;const ps=data.payments.filter(p=>p.tenantId===id).sort((a,b)=>b.date.localeCompare(a.date));$('detailHistoryCount').textContent=ps.length+' record'+(ps.length===1?'':'s');$('detailHistory').innerHTML=ps.map(p=>`<div class="history-row"><div><b>${fmtDate(p.date)}</b><span>${fmtDate(p.start)} → ${fmtDate(p.end)}${p.months?` · ${p.months} month${p.months===1?'':'s'}${p.days?` + ${p.days} day${p.days===1?'':'s'}`:''}`:''}${p.note?` · ${esc(p.note)}`:''}</span></div><strong>${money(p.amount,p.currency)}</strong></div>`).join('')||'<div class="empty">No payment records.</div>';openSheet('tenantDetailSheet')}
$('extendBtn').onclick=()=>{closeSheets();openPaymentSheet(selectedTenant)};
$('editTenantBtn').onclick=()=>{closeSheets();openTenantSheet(selectedTenant)};

function populatePaymentTenants(){const el=$('paymentTenant');const current=el.value;el.innerHTML=data.tenants.map(t=>`<option value="${t.id}">${esc(t.name)} · ${money(t.rate,t.currency)}/mo</option>`).join('');if(selectedTenant&&tenant(selectedTenant))el.value=selectedTenant;else if(current&&tenant(current))el.value=current;updatePaymentPreview()}
function openPaymentSheet(id){selectedTenant=id||selectedTenant;populatePaymentTenants();$('paymentTenant').value=selectedTenant||data.tenants[0]?.id||'';$('paymentDate').value=iso(today);$('paymentMonths').value=6;$('paymentNote').value='';setDuration('6');openSheet('paymentSheet')}
function setDuration(v){document.querySelectorAll('[data-duration]').forEach(b=>b.classList.toggle('selected',b.dataset.duration===String(v)));const custom=v==='custom';$('paymentMonths').readOnly=custom;$('customHelper').hidden=!custom;const t=tenant($('paymentTenant').value);if(!custom&&t){$('paymentMonths').value=Number(v);$('paymentAmount').value=(t.rate*Number(v)).toFixed(2)}else if(t&&custom){$('paymentAmount').value='';$('paymentMonths').value='';}updatePaymentPreview()}
document.querySelectorAll('[data-duration]').forEach(b=>b.onclick=()=>setDuration(b.dataset.duration));
$('paymentTenant').onchange=()=>{const t=tenant($('paymentTenant').value);const custom=document.querySelector('[data-duration].selected')?.dataset.duration==='custom';if(t&&!custom)$('paymentAmount').value=(t.rate*Number($('paymentMonths').value||6)).toFixed(2);updatePaymentPreview()};$('paymentMonths').oninput=()=>{const t=tenant($('paymentTenant').value);const custom=document.querySelector('[data-duration].selected')?.dataset.duration==='custom';if(t&&!custom)$('paymentAmount').value=(t.rate*Number($('paymentMonths').value||0)).toFixed(2);updatePaymentPreview()};$('paymentAmount').oninput=updatePaymentPreview;
function updatePaymentPreview(){const t=tenant($('paymentTenant').value);if(!t){$('periodPreview').textContent='';return}const amount=Number($('paymentAmount').value||0);const start=t.end;const custom=document.querySelector('[data-duration].selected')?.dataset.duration==='custom';let months=Number($('paymentMonths').value||0),days=0,end=months?addMonths(start,months):start;if(custom&&amount>0){const x=customCoverage(start,amount,t.rate);months=x.months;days=x.days;end=x.end;$('paymentMonths').value=months||'';}const label=custom?coverageLabel(months,days):(months?months+' month'+(months===1?'':'s'):'Custom amount');$('periodPreview').innerHTML=`<span>${custom?'PAYMENT COVERS':'NEW PERIOD'}</span><b>${fmtDate(start)} → ${fmtDate(end)}</b><small>${label} · ${money(amount,t.currency)}</small>`}
$('newPaymentBtn').onclick=()=>openPaymentSheet();

$('paymentForm').onsubmit=e=>{e.preventDefault();const t=tenant($('paymentTenant').value);if(!t)return;const amount=Number($('paymentAmount').value);const custom=document.querySelector('[data-duration].selected')?.dataset.duration==='custom';if(!amount||amount<=0)return toast('Enter a payment amount');const old=clone(data);const start=t.end;let months=Number($('paymentMonths').value||0),days=0,end=months?addMonths(start,months):start;if(custom){const x=customCoverage(start,amount,t.rate);months=x.months;days=x.days;end=x.end;if(!months&&!days)return toast('Amount is too small to cover any time');}const p={id:'p-'+Date.now(),tenantId:t.id,amount,currency:t.currency,months:months||null,days:days||0,start,end,date:$('paymentDate').value,note:$('paymentNote').value.trim()||'Renewal payment'};data.payments.push(p);t.end=end;save();closeSheets();render();lastReceipt=makeReceipt(t,p);$('receiptImage').src=lastReceipt;openSheet('receiptSheet');toastAction(`${money(amount,t.currency)} recorded for ${t.name}`,'Undo',()=>{data=old;save();closeSheets();render()},5000)};

function makeReceipt(t,p){const canvas=document.createElement('canvas');canvas.width=1000;canvas.height=1250;const c=canvas.getContext('2d');c.fillStyle='#fbfbfa';c.fillRect(0,0,1000,1250);c.fillStyle='#151515';c.font='700 42px Arial';c.textAlign='center';c.fillText('TENANCY AGREEMENT',500,95);c.fillRect(385,108,230,4);c.textAlign='left';c.font='700 28px Arial';const rows=[['LAND LADY:','Juliana Aida Antwi'],['TENANT:',t.name],['PERIOD:',`${monthYear(p.start)} TO ${monthYear(p.end)}`],['MONTHLY RATE:',money(t.rate,t.currency)],['START PERIOD:',monthYear(p.start)],['END PERIOD:',monthYear(p.end)],['AMOUNT:',money(p.amount,p.currency)]];let y=180;rows.forEach(([a,b])=>{c.font='700 27px Arial';c.fillText(a,120,y);c.font='400 27px Arial';c.fillText(b,430,y);y+=62});c.font='700 25px Arial';c.fillText('Landlady:',120,690);c.font='400 25px Arial';c.fillText('Juliana Aida Antwi',120,725);c.fillText('Signed',120,760);c.font='700 25px Arial';c.fillText('Tenant:',600,690);c.font='400 25px Arial';c.fillText(t.name,600,725);c.fillText('Signed',600,760);c.strokeStyle='#dedbd6';c.lineWidth=2;c.strokeRect(65,55,870,805);c.fillStyle='#777';c.font='400 18px Arial';c.fillText('Generated by Mad Juliana’s Tenants Payment',120,1180);c.fillText(`Payment date: ${fmtDate(p.date)}`,120,1210);return canvas.toDataURL('image/png')}
function monthYear(s){return new Date(s+'T00:00:00').toLocaleDateString('en-US',{month:'long',year:'numeric'}).toUpperCase()}
$('shareReceiptBtn').onclick=async()=>{if(!lastReceipt)return;try{const blob=await (await fetch(lastReceipt)).blob();const file=new File([blob],'tenancy-agreement.png',{type:'image/png'});if(navigator.share&&(!navigator.canShare||navigator.canShare({files:[file]})))await navigator.share({title:'Tenancy Agreement',files:[file]});else downloadReceipt()}catch(e){downloadReceipt()}};
function downloadReceipt(){const a=document.createElement('a');a.href=lastReceipt;a.download='tenancy-agreement.png';a.click()}
$('downloadReceiptBtn').onclick=downloadReceipt;

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
$('copyPricesBtn').onclick=async()=>{const text=packageText();try{await navigator.clipboard.writeText(text);toast('Updated residents & prices copied');}catch{const ta=$('pricePackage');ta.focus();ta.select();document.execCommand('copy');toast('Updated residents & prices copied')}};
$('downloadPricesBtn').onclick=()=>downloadText(packageText(),`mad-juliana-tenant-prices-${iso(today)}.json`);
$('pastePricesBtn').onclick=()=>{const raw=$('pricePackage').value.trim();if(!raw)return toast('Paste the copied update first');try{const result=applyPricePackage(JSON.parse(raw));$('pricePackage').value='';toastAction(`${result.updated} resident${result.updated===1?'':'s'} updated${result.added?` · ${result.added} added`:''}`,'Undo',()=>{data=result.old;save();render()},5000)}catch(e){toast(e.message||'Could not apply update')}};
$('pricePackage').value='';

$('resetBtn').onclick=()=>{if(confirm('Reset to the four original tenants and payment records?')){data=clone(original);save();render();toast('Original tenant records restored')}};
