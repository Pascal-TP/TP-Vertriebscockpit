'use strict';

const STORAGE_KEY = 'tp-vertriebscockpit-demo-v1';
const owners = ['Anna Becker', 'Michael Krüger', 'Svenja Peters'];
const pipelineStages = ['01 Lead','02 Kontaktversuch','03 Kontakt hergestellt','04 Termin vereinbart','05 Bedarf qualifiziert','06 Angebot','07 Verhandlung','08 Gewonnen','09 Verloren'];
const today = new Date();
const iso = d => new Date(d).toISOString().slice(0,10);
const addDays = n => { const d=new Date(); d.setDate(d.getDate()+n); return iso(d); };

const seedData = {
  customers: [
    {id:'K-1001',type:'Bestandskunde',name:'Meyer Haustechnik GmbH',street:'Industriestraße 12',zip:'21614',city:'Buxtehude',contact:'Thomas Meyer',phone:'04161 555210',mobile:'0171 2345678',email:'t.meyer@beispiel.de',owner:'Anna Becker',pipeline:'08 Gewonnen',potential:'A – sehr hoch',trades:['Sanitär','Heizung'],lastContact:addDays(-18),nextAppointment:addDays(2),note:'Interesse an neuer Produktlinie und gemeinsamer Schulung.'},
    {id:'K-1002',type:'Interessent',name:'Dach & Solar Nord GmbH',street:'Am Markt 7',zip:'21680',city:'Stade',contact:'Laura Hansen',phone:'04141 661122',mobile:'',email:'hansen@beispiel.de',owner:'Michael Krüger',pipeline:'05 Bedarf qualifiziert',potential:'B – hoch',trades:['Dach','Elektro'],lastContact:addDays(-7),nextAppointment:addDays(5),note:'Bedarf für PV-Unterkonstruktion und Elektrokomponenten.'},
    {id:'K-1003',type:'Kaltakquise',name:'Elbe Ausbau KG',street:'Hafenstraße 28',zip:'21079',city:'Hamburg',contact:'Jan Richter',phone:'040 775533',mobile:'',email:'',owner:'Svenja Peters',pipeline:'02 Kontaktversuch',potential:'B – hoch',trades:['Trockenbau','Boden'],lastContact:addDays(-4),nextAppointment:'',note:'Beim ersten Versuch nicht erreicht.'},
    {id:'K-1004',type:'Bestandskunde',name:'Schulz Gebäudetechnik',street:'Bahnhofstraße 44',zip:'27404',city:'Zeven',contact:'Peter Schulz',phone:'04281 99880',mobile:'',email:'info@beispiel.de',owner:'Anna Becker',pipeline:'06 Angebot',potential:'A – sehr hoch',trades:['Heizung','Klima','Lüftung'],lastContact:addDays(-202),nextAppointment:'',note:'Offenes Angebot nachfassen.'},
    {id:'K-1005',type:'Interessent',name:'Nordlicht Elektrotechnik GmbH',street:'Feldstraße 5',zip:'21244',city:'Buchholz',contact:'Miriam Lange',phone:'04181 400550',mobile:'',email:'lange@beispiel.de',owner:'Michael Krüger',pipeline:'04 Termin vereinbart',potential:'C – mittel',trades:['Elektro'],lastContact:addDays(-12),nextAppointment:addDays(1),note:'Ersttermin vor Ort.'},
    {id:'K-1006',type:'Kaltakquise',name:'Baukonzept Altes Land',street:'Obstmarschenweg 9',zip:'21635',city:'Jork',contact:'Kai Martens',phone:'04162 889900',mobile:'',email:'',owner:'Svenja Peters',pipeline:'01 Lead',potential:'C – mittel',trades:['Dach','Fassade'],lastContact:'',nextAppointment:'',note:'Neuer Datensatz aus Akquiseliste.'}
  ],
  activities: [
    {id:'A-1',date:addDays(-1),customerId:'K-1002',owner:'Michael Krüger',type:'Telefon',goal:'Bedarfsanalyse',result:'Bedarf erkannt',next:'Termin vorbereiten',due:addDays(4),note:'Entscheiderin nimmt am Termin teil.'},
    {id:'A-2',date:addDays(-2),customerId:'K-1001',owner:'Anna Becker',type:'E-Mail',goal:'Bestandskundenpflege',result:'Information gesendet',next:'Rückmeldung abwarten',due:addDays(7),note:'Unterlagen zur Schulung versendet.'},
    {id:'A-3',date:addDays(-4),customerId:'K-1003',owner:'Svenja Peters',type:'Kaltakquise Telefon',goal:'Neukundengewinnung',result:'Nicht erreicht',next:'Erneut anrufen',due:addDays(1),note:'Zentrale verwies auf Vormittag.'},
    {id:'A-4',date:addDays(-6),customerId:'K-1005',owner:'Michael Krüger',type:'Telefon',goal:'Neukundengewinnung',result:'Termin vereinbart',next:'Vor-Ort-Termin',due:addDays(1),note:'Schwerpunkt Elektrokomponenten.'},
    {id:'A-5',date:addDays(-8),customerId:'K-1004',owner:'Anna Becker',type:'Angebot',goal:'Angebot nachfassen',result:'Angebot erstellt',next:'Angebot telefonisch nachfassen',due:addDays(-3),note:'Angebot übermittelt.'},
    {id:'A-6',date:addDays(-12),customerId:'K-1002',owner:'Michael Krüger',type:'Vor-Ort-Besuch',goal:'Produktvorstellung',result:'Bedarf erkannt',next:'Folgetermin',due:addDays(5),note:'Gutes Gespräch, konkretes Projekt vorhanden.'}
  ],
  appointments: [
    {id:'T-1',date:addDays(1),time:'09:30',customerId:'K-1005',owner:'Michael Krüger',subject:'Ersttermin / Bedarfsermittlung',note:'Produktmuster mitnehmen'},
    {id:'T-2',date:addDays(2),time:'11:00',customerId:'K-1001',owner:'Anna Becker',subject:'Jahresgespräch',note:'Umsatzentwicklung vorbereiten'},
    {id:'T-3',date:addDays(5),time:'14:00',customerId:'K-1002',owner:'Michael Krüger',subject:'Projektbesprechung',note:'PV und Elektro'},
    {id:'T-4',date:addDays(7),time:'08:30',customerId:'K-1003',owner:'Svenja Peters',subject:'Akquisebesuch',note:'Termin noch bestätigen'}
  ],
  followups: [
    {id:'W-1',customerId:'K-1004',owner:'Anna Becker',due:addDays(-3),priority:'Hoch',task:'Offenes Angebot telefonisch nachfassen',status:'Offen'},
    {id:'W-2',customerId:'K-1003',owner:'Svenja Peters',due:addDays(1),priority:'Mittel',task:'Zweiten telefonischen Kontaktversuch starten',status:'Offen'},
    {id:'W-3',customerId:'K-1002',owner:'Michael Krüger',due:addDays(4),priority:'Hoch',task:'Unterlagen für Projekttermin vorbereiten',status:'In Bearbeitung'},
    {id:'W-4',customerId:'K-1001',owner:'Anna Becker',due:addDays(7),priority:'Niedrig',task:'Termin für Produktschulung abstimmen',status:'Offen'},
    {id:'W-5',customerId:'K-1005',owner:'Michael Krüger',due:addDays(-1),priority:'Mittel',task:'Besuchsbericht ergänzen',status:'Erledigt'}
  ]
};

let data = loadData();
let currentCustomerId = null;
let calendarOffset = 0;
let pendingImport = [];
let activeNoteTarget = null;

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const customerById = id => data.customers.find(c => c.id === id);
const formatDate = value => value ? new Intl.DateTimeFormat('de-DE').format(new Date(value+'T12:00:00')) : '–';
const daysBetween = value => value ? Math.floor((new Date()-new Date(value+'T12:00:00'))/86400000) : 9999;
const initials = name => name.split(/\s+/).map(x=>x[0]).slice(0,2).join('').toUpperCase();

function loadData(){ try{return JSON.parse(localStorage.getItem(STORAGE_KEY)) || structuredClone(seedData);}catch{return structuredClone(seedData);} }
function saveData(){ localStorage.setItem(STORAGE_KEY,JSON.stringify(data)); renderAll(); }
function toast(message){ const el=$('#toast'); el.textContent=message; el.classList.add('show'); setTimeout(()=>el.classList.remove('show'),2400); }
function getWeek(d){ const date=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())); date.setUTCDate(date.getUTCDate()+4-(date.getUTCDay()||7)); const yearStart=new Date(Date.UTC(date.getUTCFullYear(),0,1)); return Math.ceil((((date-yearStart)/86400000)+1)/7); }

const viewMeta={dashboard:['Dashboard','Aktivitäten, Termine und offene Aufgaben im Überblick','Vertriebsaktivitäten im Überblick'],customers:['Kunden','Bestandskunden, Interessenten und Kaltakquise zentral verwalten','Kundenstamm und Historie'],appointments:['Termine','Besuche planen, vorbereiten und direkt navigieren','Termin- und Tourenübersicht'],activities:['Aktivitäten','Kontakt- und Besuchshistorie ohne zusätzliche E-Mail-Berichte','Alle Vertriebsaktivitäten'],followups:['Wiedervorlagen','Nächste Schritte zuverlässig verfolgen','Offene Aufgaben und Fristen'],import:['CSV-Import','Bestehende Kundenlisten strukturiert übernehmen','Daten aus CSV übernehmen']};
function showView(name){
  $$('.view').forEach(v=>v.classList.toggle('active',v.id===`view-${name}`));
  $$('.nav-button').forEach(b=>b.classList.toggle('active',b.dataset.view===name));
  const [title,sub,hint]=viewMeta[name]; $('#pageTitle').textContent=title; $('#pageSubtitle').textContent=sub; $('#locationLabel').textContent=title; $('#locationHint').textContent=hint;
  $('#sidebar').classList.remove('open');
}

function fillOwnerSelects(){
  ['dashboardOwner','customerOwnerFilter'].forEach(id=>{const el=$('#'+id); const first=el.options[0].outerHTML; el.innerHTML=first+owners.map(o=>`<option>${o}</option>`).join('');});
}

function renderDashboard(){
  const owner=$('#dashboardOwner').value || 'all'; const period=$('#dashboardPeriod').value;
  const now=new Date(); const filtered=data.activities.filter(a=>{ if(owner!=='all'&&a.owner!==owner)return false; const d=new Date(a.date+'T12:00:00'); if(period==='week')return getWeek(d)===getWeek(now)&&d.getFullYear()===now.getFullYear(); if(period==='month')return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear(); return true; });
  const appointments=data.appointments.filter(a=>owner==='all'||a.owner===owner);
  const open=data.followups.filter(w=>w.status!=='Erledigt'&&(owner==='all'||w.owner===owner));
  const results={activities:filtered.length,visits:filtered.filter(a=>a.type.includes('Besuch')).length,appointments:filtered.filter(a=>a.result==='Termin vereinbart').length,offers:filtered.filter(a=>a.result.includes('Angebot')).length,orders:filtered.filter(a=>a.result==='Auftrag erhalten').length,followups:open.length};
  const kpis=[['Aktivitäten',results.activities,'↻','im gewählten Zeitraum'],['Vor-Ort-Termine',results.visits,'⌖','durchgeführte Besuche'],['Termine vereinbart',results.appointments,'□','aus Kontakten entstanden'],['Angebote',results.offers,'€','Angebotsaktivitäten'],['Aufträge',results.orders,'✓','erfolgreiche Abschlüsse'],['Offene Wiedervorlagen',results.followups,'!','nächste Schritte']];
  $('#kpiGrid').innerHTML=kpis.map(k=>`<article class="card kpi-card"><div class="kpi-top"><span>${k[0]}</span><span class="kpi-icon">${k[2]}</span></div><div class="kpi-value">${k[1]}</div><div class="kpi-note">${k[3]}</div></article>`).join('');
  const weeks=[...Array(6)].map((_,i)=>{const d=new Date();d.setDate(d.getDate()-(5-i)*7);return {week:getWeek(d),year:d.getFullYear()};});
  const counts=weeks.map(w=>data.activities.filter(a=>{const d=new Date(a.date+'T12:00:00');return getWeek(d)===w.week&&d.getFullYear()===w.year&&(owner==='all'||a.owner===owner)}).length); const max=Math.max(...counts,1);
  $('#activityChart').innerHTML=weeks.map((w,i)=>`<div class="bar-item"><div class="bar" style="height:${Math.max(4,counts[i]/max*180)}px"><span>${counts[i]}</span></div><div class="bar-label">KW ${w.week}</div></div>`).join('');
  const stageCounts=pipelineStages.map(s=>({stage:s,count:data.customers.filter(c=>c.pipeline===s&&(owner==='all'||c.owner===owner)).length})); const maxStage=Math.max(...stageCounts.map(s=>s.count),1);
  $('#pipelineList').innerHTML=stageCounts.map(s=>`<div class="pipeline-row"><span>${s.stage.replace(/^\d+ /,'')}</span><div class="progress"><span style="width:${s.count/maxStage*100}%"></span></div><strong>${s.count}</strong></div>`).join('');
  const upcoming=[...appointments].filter(a=>a.date>=iso(new Date())).sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time)).slice(0,4);
  $('#upcomingAppointments').innerHTML=upcoming.length?upcoming.map(appointmentCompact).join(''):'<p class="muted">Keine Termine vorhanden.</p>';
  const overdue=open.filter(w=>w.due<iso(new Date())).slice(0,3).map(w=>({title:w.task,sub:customerById(w.customerId)?.name||'',label:`${Math.abs(daysBetween(w.due))} Tage überfällig`,cls:'red'}));
  const stale=data.customers.filter(c=>daysBetween(c.lastContact)>180).slice(0,2).map(c=>({title:c.name,sub:'Lange ohne Kontakt',label:`${daysBetween(c.lastContact)} Tage`,cls:'orange'}));
  $('#attentionList').innerHTML=[...overdue,...stale].map(x=>`<div class="compact-item"><div class="compact-date">!</div><div><h3>${x.title}</h3><p>${x.sub}</p></div><span class="status-pill ${x.cls}">${x.label}</span></div>`).join('')||'<p>Kein akuter Handlungsbedarf.</p>';
}
function appointmentCompact(a){const c=customerById(a.customerId);const d=new Date(a.date+'T12:00:00');return `<div class="compact-item"><div class="compact-date"><strong>${d.getDate()}</strong><span>${d.toLocaleDateString('de-DE',{month:'short'})}</span></div><div><h3>${a.time} · ${c?.name||'Unbekannt'}</h3><p>${a.subject} · ${a.owner}</p></div><button class="text-button map-link" data-customer="${a.customerId}">Maps</button></div>`;}

function renderCustomers(){
  const type=$('#customerTypeFilter .active')?.dataset.value||'all', owner=$('#customerOwnerFilter').value||'all', q=$('#customerSearch').value.toLowerCase();
  const list=data.customers.filter(c=>(type==='all'||c.type===type)&&(owner==='all'||c.owner===owner)&&[c.name,c.city,c.contact,c.zip].join(' ').toLowerCase().includes(q));
  $('#customerCount').textContent=`${list.length} Kunden`;
  $('#customerList').innerHTML=list.map(c=>`<div class="customer-row ${c.id===currentCustomerId?'active':''}" data-id="${c.id}"><div class="avatar">${initials(c.name)}</div><div><h3>${c.name}</h3><p>${c.zip} ${c.city} · ${c.owner}</p></div><span class="status-pill ${c.type==='Bestandskunde'?'green':c.type==='Kaltakquise'?'orange':''}">${c.type}</span></div>`).join('')||'<div class="empty-state"><p>Keine passenden Kunden gefunden.</p></div>';
  if(currentCustomerId) renderCustomerDetail(currentCustomerId);
}
function renderCustomerDetail(id){
  const c=customerById(id); if(!c)return; currentCustomerId=id;
  const hist=data.activities.filter(a=>a.customerId===id).sort((a,b)=>b.date.localeCompare(a.date));
  $('#customerDetail').innerHTML=`<div class="detail-header"><div><div class="tag-row"><span class="status-pill green">${c.type}</span><span class="status-pill">${c.pipeline.replace(/^\d+ /,'')}</span></div><h2>${c.name}</h2><p>${c.street}, ${c.zip} ${c.city}</p></div><div class="detail-actions"><button class="secondary-button map-link" data-customer="${c.id}">⌖ Google Maps</button><button class="secondary-button" data-action="appointment" data-id="${c.id}">+ Termin</button><button class="primary-button" data-action="activity" data-id="${c.id}">+ Kontakt bearbeiten</button></div></div><div class="detail-body"><div class="info-grid"><div class="info-cell"><small>Ansprechpartner</small><strong>${c.contact||'–'}</strong></div><div class="info-cell"><small>Telefon</small><strong>${c.phone||c.mobile||'–'}</strong></div><div class="info-cell"><small>E-Mail</small><strong>${c.email||'–'}</strong></div><div class="info-cell"><small>Außendienst</small><strong>${c.owner}</strong></div><div class="info-cell"><small>Potenzial</small><strong>${c.potential}</strong></div><div class="info-cell"><small>Letzter Kontakt</small><strong>${formatDate(c.lastContact)}</strong></div></div><section><h3 class="section-title">Relevante Gewerke</h3><div class="tag-row">${c.trades.map(t=>`<span class="tag">${t}</span>`).join('')||'–'}</div></section><section><h3 class="section-title">Kurznotiz</h3><p>${c.note||'Keine Notiz vorhanden.'}</p></section><section><h3 class="section-title">Kontaktverlauf</h3>${hist.length?hist.map(a=>`<div class="history-item"><time>${formatDate(a.date)}</time><div><h4>${a.type} · ${a.result}</h4><p>${a.note||'Keine Notiz'}${a.next?` · Nächster Schritt: ${a.next}`:''}</p></div></div>`).join(''):'<p>Noch keine Aktivitäten vorhanden.</p>'}</section></div>`;
  $$('.customer-row').forEach(row=>row.classList.toggle('active',row.dataset.id===id));
}

function renderAppointments(){
  const start=new Date(); start.setDate(start.getDate()-((start.getDay()+6)%7)+calendarOffset*7); start.setHours(12,0,0,0); const end=new Date(start);end.setDate(end.getDate()+4);
  $('#calendarRange').textContent=`${formatDate(iso(start))} – ${formatDate(iso(end))}`;
  $('#weekGrid').innerHTML=[...Array(5)].map((_,i)=>{const d=new Date(start);d.setDate(start.getDate()+i);const date=iso(d);const appts=data.appointments.filter(a=>a.date===date).sort((a,b)=>a.time.localeCompare(b.time));return `<div class="day-column"><div class="day-heading">${d.toLocaleDateString('de-DE',{weekday:'short'})}<strong>${d.getDate()}</strong></div>${appts.map(a=>`<div class="appointment-card"><strong>${a.time} · ${customerById(a.customerId)?.name||''}</strong><span>${a.subject}</span></div>`).join('')}</div>`}).join('');
  $('#appointmentList').innerHTML=[...data.appointments].sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time)).map(appointmentCompact).join('');
}
function renderActivities(){
  $('#activityTableBody').innerHTML=[...data.activities].sort((a,b)=>b.date.localeCompare(a.date)).map(a=>`<tr><td>${formatDate(a.date)}</td><td><strong>${customerById(a.customerId)?.name||'–'}</strong></td><td>${a.owner}</td><td>${a.type}</td><td><span class="status-pill">${a.result}</span></td><td>${a.next||'–'}${a.due?`<br><small>${formatDate(a.due)}</small>`:''}</td><td>${a.note||'–'}${a.handNote?'<br><span class="tag">Handnotiz vorhanden</span>':''}</td></tr>`).join('');
}
function renderFollowups(){
  const groups=[['Offen','Offen'],['In Bearbeitung','In Bearbeitung'],['Erledigt','Erledigt']];
  $('#followupBoard').innerHTML=groups.map(([title,status])=>{const items=data.followups.filter(w=>w.status===status).sort((a,b)=>a.due.localeCompare(b.due));return `<section class="board-column"><div class="board-heading"><strong>${title}</strong><span class="status-pill">${items.length}</span></div>${items.map(w=>{const over=w.status!=='Erledigt'&&w.due<iso(new Date());return `<article class="followup-card"><div class="tag-row"><span class="status-pill ${over?'red':w.priority==='Hoch'?'orange':''}">${over?'Überfällig':w.priority}</span></div><h3>${w.task}</h3><p>${customerById(w.customerId)?.name||''} · ${w.owner}</p><div class="followup-meta"><span>Fällig: ${formatDate(w.due)}</span>${w.status!=='Erledigt'?`<button class="text-button complete-followup" data-id="${w.id}">Erledigen</button>`:''}</div></article>`}).join('')}</section>`}).join('');
}
function renderAll(){renderDashboard();renderCustomers();renderAppointments();renderActivities();renderFollowups();}

const formConfigs={
  customer:{title:'Kunde anlegen',subtitle:'Stammdaten und Vertriebszuordnung',fields:[['name','Firma / Kundenname','text',true],['type','Kundengruppe','select',['Bestandskunde','Interessent','Kaltakquise']],['street','Straße','text'],['zip','PLZ','text'],['city','Ort','text'],['contact','Ansprechpartner','text'],['phone','Telefon','tel'],['email','E-Mail','email'],['owner','Außendienst','select',owners],['potential','Potenzial','select',['A – sehr hoch','B – hoch','C – mittel','D – gering']],['pipeline','Pipeline','select',pipelineStages],['trades','Gewerke (kommagetrennt)','text'],['note','Kurznotiz','textarea']]},
  activity:{title:'Kontakt erfassen',subtitle:'Telefonat, E-Mail, Besuch oder Akquise dokumentieren',fields:[['customerId','Kunde','customer',true],['date','Datum','date',true],['owner','Außendienst','select',owners],['type','Kontaktart','select',['Kaltakquise Telefon','Telefon','E-Mail','Vor-Ort-Besuch','Video/Teams','Messe/Veranstaltung','Angebot','Sonstiges']],['goal','Besuchsziel','select',['Neukundengewinnung','Bestandskundenpflege','Bedarfsanalyse','Produktvorstellung','Angebot nachfassen','Reklamation','Baustellenbesuch','Jahresgespräch']],['result','Ergebnis','select',['Nicht erreicht','Information gesendet','Wiedervorlage','Termin vereinbart','Termin durchgeführt','Bedarf erkannt','Angebot angefragt','Angebot erstellt','Auftrag erhalten','Kein Interesse','Verloren']],['next','Nächster Schritt','text'],['due','Fällig am','date'],['note','Kurznotiz','textarea'],['handNote','Handschriftliche Notiz','hand']]},
  appointment:{title:'Termin anlegen',subtitle:'Kundentermin für Innen- und Außendienst planen',fields:[['customerId','Kunde','customer',true],['date','Datum','date',true],['time','Uhrzeit','time',true],['owner','Außendienst','select',owners],['subject','Terminart / Betreff','text',true],['note','Vorbereitung / Notiz','textarea']]},
  followup:{title:'Wiedervorlage anlegen',subtitle:'Konkreten nächsten Schritt terminieren',fields:[['customerId','Kunde','customer',true],['owner','Verantwortlich','select',owners],['due','Fällig am','date',true],['priority','Priorität','select',['Hoch','Mittel','Niedrig']],['task','Aufgabe / nächster Schritt','textarea',true],['status','Status','select',['Offen','In Bearbeitung','Erledigt']]]}
};
function openForm(type,preset={}){
  const cfg=formConfigs[type]; $('#dialogTitle').textContent=cfg.title;$('#dialogSubtitle').textContent=cfg.subtitle; $('#dynamicForm').dataset.type=type;
  $('#dialogFields').innerHTML=cfg.fields.map(([name,label,input,opts])=>{const val=preset[name]??(name==='date'?iso(new Date()):name==='owner'?owners[0]:name==='status'?'Offen':''); const required=opts===true?'required':''; let control=''; if(input==='select')control=`<select name="${name}" ${required}>${opts.map(o=>`<option ${o===val?'selected':''}>${o}</option>`).join('')}</select>`; else if(input==='customer')control=`<select name="${name}" ${required}>${data.customers.map(c=>`<option value="${c.id}" ${c.id===val?'selected':''}>${c.name} · ${c.city}</option>`).join('')}</select>`; else if(input==='textarea')control=`<textarea name="${name}" ${required}>${val}</textarea>`; else if(input==='hand')control=`<input type="hidden" name="${name}" value="${val}"><button type="button" class="secondary-button open-note">✎ Mit Stift schreiben</button><span class="hand-status">${val?'Notiz vorhanden':'Noch keine Handnotiz'}</span>`; else control=`<input name="${name}" type="${input}" value="${val}" ${required}>`; return `<div class="field ${input==='textarea'||input==='hand'?'full':''}"><label>${label}</label>${control}</div>`}).join('');
  $('#formDialog').showModal();
}
function saveForm(type,values){
  const idPrefix={customer:'K',activity:'A',appointment:'T',followup:'W'}[type]; values.id=`${idPrefix}-${Date.now()}`;
  if(type==='customer'){values.trades=(values.trades||'').split(',').map(x=>x.trim()).filter(Boolean);values.lastContact='';values.nextAppointment='';data.customers.push(values);}
  if(type==='activity'){data.activities.push(values);const c=customerById(values.customerId);if(c){c.lastContact=values.date;if(values.result==='Termin vereinbart')c.pipeline='04 Termin vereinbart';if(values.result==='Bedarf erkannt')c.pipeline='05 Bedarf qualifiziert';if(values.result==='Angebot erstellt')c.pipeline='06 Angebot';if(values.result==='Auftrag erhalten')c.pipeline='08 Gewonnen';}if(values.next&&values.due)data.followups.push({id:`W-${Date.now()+1}`,customerId:values.customerId,owner:values.owner,due:values.due,priority:'Mittel',task:values.next,status:'Offen'});}
  if(type==='appointment'){data.appointments.push(values);const c=customerById(values.customerId);if(c)c.nextAppointment=values.date;}
  if(type==='followup')data.followups.push(values);
  saveData(); toast('Eintrag wurde gespeichert.');
}

function openMaps(customerId){const c=customerById(customerId);if(!c)return;window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${c.street}, ${c.zip} ${c.city}`)}`,'_blank','noopener');}

function parseCSV(text){
  const lines=text.replace(/^\uFEFF/,'').split(/\r?\n/).filter(Boolean); if(!lines.length)return [];
  const delimiter=(lines[0].match(/;/g)||[]).length>=(lines[0].match(/,/g)||[]).length?';':',';
  const parseLine=line=>{const out=[];let cur='',quote=false;for(let i=0;i<line.length;i++){const ch=line[i];if(ch==='"'){if(quote&&line[i+1]==='"'){cur+='"';i++;}else quote=!quote;}else if(ch===delimiter&&!quote){out.push(cur.trim());cur='';}else cur+=ch;}out.push(cur.trim());return out;};
  const headers=parseLine(lines[0]); return lines.slice(1).map(l=>Object.fromEntries(headers.map((h,i)=>[h,parseLine(l)[i]||''])));
}
function mapImport(rows,type){
  const find=(r,names)=>{const key=Object.keys(r).find(k=>names.some(n=>k.toLowerCase().includes(n)));return key?r[key]:''};
  return rows.map((r,i)=>({id:`K-IMP-${Date.now()}-${i}`,type,name:find(r,['firma','kundenname','kunde','name'])||`Importierter Kunde ${i+1}`,street:find(r,['straße','strasse']),zip:find(r,['plz']),city:find(r,['ort','stadt']),contact:find(r,['ansprechpartner','kontakt']),phone:find(r,['telefon','tel']),mobile:find(r,['mobil','handy']),email:find(r,['mail']),owner:find(r,['außendienst','aussendienst','betreuer'])||owners[0],pipeline:'01 Lead',potential:'C – mittel',trades:[],lastContact:'',nextAppointment:'',note:''}));
}

function setupCanvas(){
  const canvas=$('#noteCanvas'),ctx=canvas.getContext('2d');ctx.lineCap='round';ctx.lineJoin='round';let drawing=false;
  const point=e=>{const r=canvas.getBoundingClientRect(),p=e.touches?.[0]||e;return{x:(p.clientX-r.left)*canvas.width/r.width,y:(p.clientY-r.top)*canvas.height/r.height}};
  const start=e=>{drawing=true;const p=point(e);ctx.beginPath();ctx.moveTo(p.x,p.y);e.preventDefault()}; const move=e=>{if(!drawing)return;const p=point(e);ctx.lineWidth=+$('#penWidth').value;ctx.strokeStyle='#12354a';ctx.lineTo(p.x,p.y);ctx.stroke();e.preventDefault()}; const end=()=>drawing=false;
  ['pointerdown'].forEach(x=>canvas.addEventListener(x,start));canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerup',end);canvas.addEventListener('pointerleave',end);
  $('#clearCanvasButton').onclick=()=>ctx.clearRect(0,0,canvas.width,canvas.height);
  $('#saveNoteButton').onclick=()=>{if(activeNoteTarget){activeNoteTarget.value=canvas.toDataURL('image/png');activeNoteTarget.parentElement.querySelector('.hand-status').textContent='Notiz vorhanden';}$('#noteDialog').close();};
  $('#cancelNoteButton').onclick=$('#closeNoteButton').onclick=()=>$('#noteDialog').close();
}

function bindEvents(){
  $$('.nav-button').forEach(b=>b.onclick=()=>showView(b.dataset.view));$$('[data-go]').forEach(b=>b.onclick=()=>showView(b.dataset.go));$('#menuButton').onclick=()=>$('#sidebar').classList.toggle('open');
  $('#dashboardOwner').onchange=renderDashboard;$('#dashboardPeriod').onchange=renderDashboard;$('#customerOwnerFilter').onchange=renderCustomers;$('#customerSearch').oninput=renderCustomers;
  $('#customerTypeFilter').onclick=e=>{if(e.target.tagName==='BUTTON'){$$('#customerTypeFilter button').forEach(b=>b.classList.remove('active'));e.target.classList.add('active');renderCustomers();}};
  $('#customerList').onclick=e=>{const row=e.target.closest('.customer-row');if(row){currentCustomerId=row.dataset.id;renderCustomerDetail(currentCustomerId);}};
  document.addEventListener('click',e=>{const map=e.target.closest('.map-link');if(map)openMaps(map.dataset.customer);const action=e.target.closest('[data-action]');if(action)openForm(action.dataset.action,{customerId:action.dataset.id});const complete=e.target.closest('.complete-followup');if(complete){const w=data.followups.find(x=>x.id===complete.dataset.id);w.status='Erledigt';saveData();toast('Wiedervorlage erledigt.');}});
  $('#quickActivityButton').onclick=$('#newActivityButton').onclick=()=>openForm('activity');$('#newCustomerButton').onclick=()=>openForm('customer');$('#newAppointmentButton').onclick=()=>openForm('appointment');$('#newFollowupButton').onclick=()=>openForm('followup');
  $('#prevWeek').onclick=()=>{calendarOffset--;renderAppointments()};$('#nextWeek').onclick=()=>{calendarOffset++;renderAppointments()};
  $('#dynamicForm').addEventListener('click',e=>{if(e.target.classList.contains('open-note')){activeNoteTarget=e.target.parentElement.querySelector('input[type=hidden]');const canvas=$('#noteCanvas'),ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);if(activeNoteTarget.value){const img=new Image();img.onload=()=>ctx.drawImage(img,0,0);img.src=activeNoteTarget.value;}$('#noteDialog').showModal();}});
  $('#dynamicForm').addEventListener('submit',e=>{if(e.submitter?.value==='cancel')return;e.preventDefault();const values=Object.fromEntries(new FormData(e.currentTarget).entries());saveForm(e.currentTarget.dataset.type,values);$('#formDialog').close();});
  $('#resetDemoButton').onclick=()=>{data=structuredClone(seedData);saveData();toast('Demodaten wurden zurückgesetzt.');};
  $('#globalSearch').onkeydown=e=>{if(e.key==='Enter'){showView('customers');$('#customerSearch').value=e.target.value;renderCustomers();}};
  $('#csvFile').onchange=e=>{const file=e.target.files[0];$('#fileName').textContent=file?file.name:'oder hier ablegen';$('#importButton').disabled=!file;};
  $('#importButton').onclick=()=>{const file=$('#csvFile').files[0];if(!file)return;const reader=new FileReader();reader.onload=()=>{const raw=parseCSV(reader.result);pendingImport=mapImport(raw,$('#importType').value);const cols=['name','street','zip','city','contact','phone','email'];$('#importPreview thead').innerHTML='<tr>'+cols.map(c=>`<th>${c}</th>`).join('')+'</tr>';$('#importPreview tbody').innerHTML=pendingImport.slice(0,8).map(r=>'<tr>'+cols.map(c=>`<td>${r[c]||''}</td>`).join('')+'</tr>').join('');$('#importSummary').textContent=`${pendingImport.length} Datensätze erkannt`;$('#confirmImportButton').classList.remove('hidden');};reader.readAsText(file,'utf-8');};
  $('#confirmImportButton').onclick=()=>{data.customers.push(...pendingImport);pendingImport=[];saveData();toast('CSV-Datensätze wurden übernommen.');showView('customers');};
}

fillOwnerSelects();bindEvents();setupCanvas();renderAll();
