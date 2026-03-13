let captureMap;
let captureMapMarker;
let heatMap;
let timelineChart;
let selectedLocation = null;
const STATUS_OPTIONS = ['Pendente Captação','Aguardando Reunião','Pendente Proposta','Pendente Cliente','Captação Concluida','Captação Falhou'];

function showCaptureFeedback(message, type='danger') {
  const el=document.getElementById('captureFeedback');
  if(!el) return;
  el.className=`alert alert-${type}`;
  el.textContent=message;
  el.classList.remove('d-none');
}

function debounce(fn, wait=300) {
  let t;
  return (...args)=>{ clearTimeout(t); t=setTimeout(()=>fn(...args),wait); };
}

async function loadCategories(q='') {
  const r=await fetch(`/api/captacao/categories?q=${encodeURIComponent(q)}`);
  const list=await r.json();
  const dl=document.getElementById('captureCategoryList');
  dl.innerHTML=(list||[]).map((c)=>`<option value="${c}">`).join('');
}

async function loadLocations(q='') {
  const r=await fetch(`/api/captacao/locations?q=${encodeURIComponent(q)}`);
  const list=await r.json();
  const dl=document.getElementById('captureLocationList');
  dl.innerHTML=(list||[]).map((l)=>`<option value="${l.display_name}" data-lat="${l.lat}" data-lon="${l.lon}">`).join('');
  return list;
}

function initLocationMap() {
  captureMap=L.map('captureLocationMap').setView([-14.235, -51.9253], 4);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom:19 }).addTo(captureMap);
}

function initHeatMap() {
  heatMap=L.map('captureHeatMap').setView([-14.235, -51.9253], 4);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom:19 }).addTo(heatMap);
}

function colorToHex(color){ return ({red:'#ef4444',yellow:'#f59e0b',green:'#16a34a',blue:'#2563eb'}[color]||'#64748b'); }

async function refreshCaptacaoList() {
  const r=await fetch('/api/captacao');
  const items=await r.json();
  const tbody=document.getElementById('captureTableBody');
  tbody.innerHTML=(items||[]).map((i)=>`<tr><td>${i.name}</td><td class="d-flex gap-1"><button class="btn btn-sm btn-outline-dark" onclick="viewCaptacao('${i._id}')">Visualizar Dados</button><button class="btn btn-sm btn-outline-secondary" onclick="changeCaptacaoStatus('${i._id}')">Alterar Status</button><button class="btn btn-sm btn-outline-danger" onclick="deleteCaptacao('${i._id}')">Excluir</button></td></tr>`).join('');
}

async function viewCaptacao(id) {
  const r=await fetch('/api/captacao');
  const items=await r.json();
  const i=items.find((x)=>x._id===id);
  if(!i) return;
  const body=document.getElementById('captureDetailsBody');
  body.innerHTML=`<h6>${i.name}</h6><p><strong>Status:</strong> ${i.status}<br><strong>Categoria:</strong> ${i.category}<br><strong>Endereço:</strong> ${i.address}<br><strong>Email:</strong> ${i.email}<br><strong>Telefone:</strong> ${i.phone}<br><strong>Site:</strong> ${i.site}<br><strong>Redes:</strong> ${i.social}<br><strong>Fonte:</strong> ${i.source}</p><pre class="small">${JSON.stringify(i.metadata||{},null,2)}</pre>`;
  new bootstrap.Offcanvas('#captureDetailsPanel').show();
}

async function changeCaptacaoStatus(id) {
  const status=prompt(`Novo status:\n${STATUS_OPTIONS.join('\n')}`,'Pendente Captação');
  if(!status) return;
  await fetch(`/api/captacao/${id}/status`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status})});
  await refreshCaptacaoList();
  await refreshCaptacaoStats();
}

async function deleteCaptacao(id) {
  if(!confirm('Excluir captação?')) return;
  await fetch(`/api/captacao/${id}`,{method:'DELETE'});
  await refreshCaptacaoList();
  await refreshCaptacaoStats();
}

async function refreshCaptacaoStats() {
  const r=await fetch('/api/captacao/stats');
  const data=await r.json();
  if(!r.ok) return;

  heatMap.eachLayer((layer)=>{ if(layer instanceof L.CircleMarker) heatMap.removeLayer(layer); });
  (data.points||[]).forEach((p)=>{
    L.circleMarker([p.lat,p.lon],{radius:8,color:colorToHex(p.color),fillColor:colorToHex(p.color),fillOpacity:.7}).addTo(heatMap).bindPopup(`Captações bem sucedidas: ${p.count}`);
  });

  const ctx=document.getElementById('captureTimelineChart');
  if(ctx){
    timelineChart?.destroy();
    timelineChart=new Chart(ctx,{type:'line',data:{labels:(data.timeline||[]).map(t=>t.date),datasets:[{label:'Empresas buscadas',data:(data.timeline||[]).map(t=>t.total),borderColor:'#ff7a18',backgroundColor:'rgba(255,122,24,.15)',fill:true,tension:.35}]},options:{responsive:true}});
  }
}

async function runCaptacao(payload){
  const r=await fetch('/api/captacao/run',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
  const p=await r.json();
  if(!r.ok) throw new Error(p.message||'Falha na captação');
  return p;
}

function bindCaptureForm() {
  const scheduledSwitch=document.getElementById('scheduledSwitch');
  scheduledSwitch.addEventListener('change',()=>document.getElementById('scheduledFields').classList.toggle('d-none',!scheduledSwitch.checked));

  document.getElementById('captureCategory').addEventListener('input',debounce((e)=>loadCategories(e.target.value),250));

  document.getElementById('captureLocation').addEventListener('input',debounce(async (e)=>{
    const list=await loadLocations(e.target.value);
    selectedLocation=list[0]||null;
    if(selectedLocation){
      captureMap.setView([selectedLocation.lat, selectedLocation.lon], 13);
      if(captureMapMarker) captureMap.removeLayer(captureMapMarker);
      captureMapMarker=L.marker([selectedLocation.lat, selectedLocation.lon]).addTo(captureMap);
    }
  },350));

  document.getElementById('captureForm').addEventListener('submit', async (e)=>{
    e.preventDefault();
    try{
      const payload={
        scheduled: document.getElementById('scheduledSwitch').checked,
        scheduledAt: document.getElementById('scheduledAt').value || null,
        category: document.getElementById('captureCategory').value,
        location: document.getElementById('captureLocation').value,
        lat: selectedLocation?.lat,
        lon: selectedLocation?.lon,
        radius: Number(document.getElementById('captureRadius').value||3000),
        collectInfo: document.getElementById('collectInfo').checked,
        quantity: Number(document.getElementById('captureQuantity').value||5),
      };
      if(!payload.lat || !payload.lon) return showCaptureFeedback('Informe uma localização válida.');
      const result=await runCaptacao(payload);
      showCaptureFeedback(`Captação finalizada. ${result.created} registros criados.`, 'success');
      document.getElementById('captureForm').reset();
      await refreshCaptacaoList();
      await refreshCaptacaoStats();
    }catch(err){
      showCaptureFeedback(err.message || 'Falha ao executar captação.');
    }
  });
}

async function initCaptacaoPage() {
  initLocationMap();
  initHeatMap();
  await loadCategories('');
  bindCaptureForm();
  await refreshCaptacaoList();
  await refreshCaptacaoStats();
}
