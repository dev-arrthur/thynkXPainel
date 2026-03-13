let captureMap;
let captureMapMarker;
let heatMap;
let timelineChart;
let selectedLocation = null;
let captureItems = [];
let locationSuggestions = [];
let statusModal;
let similarCompaniesModal;

const STATUS_OPTIONS = ['Pendente Captação', 'Aguardando Reunião', 'Pendente Proposta', 'Pendente Cliente', 'Captação Concluida', 'Captação Falhou'];

function showCaptureFeedback(message, type = 'danger') {
  const el = document.getElementById('captureFeedback');
  if (!el) return;
  el.className = `alert alert-${type}`;
  el.textContent = message;
  el.classList.remove('d-none');
}

function debounce(fn, wait = 300) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); };
}

function toggleCaptureLoading(show, message = 'Buscando LEADS, aguarde...') {
  const overlay = document.getElementById('captureLoadingOverlay');
  const text = document.getElementById('captureLoadingText');
  const submitBtn = document.querySelector('#captureForm button[type="submit"], #captureForm button.btn-xp');
  if (overlay) overlay.classList.toggle('d-none', !show);
  if (text) text.textContent = message;
  if (submitBtn) {
    submitBtn.disabled = show;
    submitBtn.textContent = show ? 'Buscando LEADS...' : 'Fazer a Captação';
  }
}

function initLocationMap() {
  captureMap = L.map('captureLocationMap').setView([-14.235, -51.9253], 4);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(captureMap);
}

function initHeatMap() {
  heatMap = L.map('captureHeatMap').setView([-14.235, -51.9253], 4);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(heatMap);
}

function colorToHex(color) {
  return ({ red: '#ef4444', yellow: '#f59e0b', green: '#16a34a', blue: '#2563eb' }[color] || '#64748b');
}

async function loadCategories(q = '') {
  const r = await fetch(`/api/captacao/categories?q=${encodeURIComponent(q)}`);
  const list = await r.json();
  const dl = document.getElementById('captureCategoryList');
  dl.innerHTML = (list || []).map((c) => `<option value="${c}">`).join('');
  return list || [];
}

async function validateCategory(category) {
  if (!category || !category.trim()) return;
  try {
    const r = await fetch(`/api/captacao/categories/check?q=${encodeURIComponent(category)}`);
    const data = await r.json();
    const hint = document.getElementById('captureCategoryHint');
    if (!hint) return;
    if (!data.exists) {
      hint.className = 'text-warning';
      hint.textContent = 'Categoria não encontrada na lista padrão. A busca continuará com tentativa aproximada.';
    } else {
      hint.className = 'text-success';
      hint.textContent = 'Categoria reconhecida.';
    }
  } catch {
    // sem bloqueio de fluxo
  }
}

async function loadLocations(q = '') {
  const r = await fetch(`/api/captacao/locations?q=${encodeURIComponent(q)}`);
  const list = await r.json();
  locationSuggestions = list || [];
  const dl = document.getElementById('captureLocationList');
  dl.innerHTML = locationSuggestions.map((l) => `<option value="${l.display_name}">`).join('');
  return locationSuggestions;
}

function applyLocationSelection() {
  const locationInput = document.getElementById('captureLocation');
  const found = locationSuggestions.find((l) => l.display_name === locationInput.value) || locationSuggestions[0] || null;
  selectedLocation = found;
  if (selectedLocation) {
    captureMap.setView([selectedLocation.lat, selectedLocation.lon], 13);
    if (captureMapMarker) captureMap.removeLayer(captureMapMarker);
    captureMapMarker = L.marker([selectedLocation.lat, selectedLocation.lon]).addTo(captureMap);
  }
}

function getFilteredItems() {
  const q = (document.getElementById('captureSearchInput').value || '').toLowerCase().trim();
  const statusFilter = (document.getElementById('captureStatusFilter').value || '').toLowerCase();
  const categoryFilter = (document.getElementById('captureCategoryFilter').value || '').toLowerCase().trim();

  return captureItems.filter((i) => {
    const matchesQ = !q || [i.name, i.address, i.email, i.phone, i.site, i.social].join(' ').toLowerCase().includes(q);
    const matchesStatus = !statusFilter || String(i.status || '').toLowerCase() === statusFilter;
    const matchesCategory = !categoryFilter || String(i.category || '').toLowerCase().includes(categoryFilter);
    return matchesQ && matchesStatus && matchesCategory;
  });
}

function renderCaptacaoList(items) {
  const tbody = document.getElementById('captureTableBody');
  const count = document.getElementById('captureListCount');

  if (!items.length) {
    tbody.innerHTML = '<tr><td colspan="2" class="text-muted">Nenhum lead encontrado com os filtros atuais.</td></tr>';
    if (count) count.textContent = '0 registros';
    return;
  }

  tbody.innerHTML = items.map((i) => `
    <tr>
      <td>
        <div class="fw-semibold">${i.name}</div>
        <small class="text-muted">${i.category || 'Sem categoria'} • ${i.status || 'Sem status'}</small>
      </td>
      <td class="d-flex flex-wrap gap-1">
        <button class="btn btn-sm btn-outline-dark" onclick="viewCaptacao('${i._id}')">Visualizar</button>
        <button class="btn btn-sm btn-outline-secondary" onclick="openCaptacaoStatusModal('${i._id}', '${i.status || 'Pendente Captação'}')">Status</button>
        <button class="btn btn-sm btn-outline-primary" onclick="searchSimilarCompanies('${i._id}')">Empresas parecidas</button>
        <button class="btn btn-sm btn-outline-danger" onclick="deleteCaptacao('${i._id}')">Excluir</button>
      </td>
    </tr>`).join('');

  if (count) count.textContent = `${items.length} registro(s)`;
}

function applyListFilters() {
  renderCaptacaoList(getFilteredItems());
}

async function refreshCaptacaoList() {
  const r = await fetch('/api/captacao');
  captureItems = await r.json();
  applyListFilters();
}

async function viewCaptacao(id) {
  const i = captureItems.find((x) => x._id === id);
  if (!i) return;
  const body = document.getElementById('captureDetailsBody');
  body.innerHTML = `
    <h6>${i.name}</h6>
    <p>
      <strong>Status:</strong> ${i.status}<br>
      <strong>Categoria:</strong> ${i.category}<br>
      <strong>Endereço:</strong> ${i.address}<br>
      <strong>Email:</strong> ${i.email}<br>
      <strong>Telefone:</strong> ${i.phone}<br>
      <strong>Site:</strong> ${i.site}<br>
      <strong>Redes:</strong> ${i.social}
    </p>
    <pre class="small">${JSON.stringify(i.metadata || {}, null, 2)}</pre>`;
  new bootstrap.Offcanvas('#captureDetailsPanel').show();
}

function openCaptacaoStatusModal(id, currentStatus = 'Pendente Captação') {
  document.getElementById('captureStatusLeadId').value = id;
  const select = document.getElementById('captureStatusSelect');
  select.value = STATUS_OPTIONS.includes(currentStatus) ? currentStatus : 'Pendente Captação';
  statusModal.show();
}

async function saveCaptacaoStatus() {
  const id = document.getElementById('captureStatusLeadId').value;
  const status = document.getElementById('captureStatusSelect').value;
  await fetch(`/api/captacao/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  statusModal.hide();
  await refreshCaptacaoList();
  await refreshCaptacaoStats();
}

async function deleteCaptacao(id) {
  if (!confirm('Excluir captação?')) return;
  await fetch(`/api/captacao/${id}`, { method: 'DELETE' });
  await refreshCaptacaoList();
  await refreshCaptacaoStats();
}

async function refreshCaptacaoStats() {
  const r = await fetch('/api/captacao/stats');
  const data = await r.json();
  if (!r.ok) return;

  heatMap.eachLayer((layer) => { if (layer instanceof L.CircleMarker) heatMap.removeLayer(layer); });
  (data.points || []).forEach((p) => {
    L.circleMarker([p.lat, p.lon], { radius: 8, color: colorToHex(p.color), fillColor: colorToHex(p.color), fillOpacity: 0.7 })
      .addTo(heatMap)
      .bindPopup(`Captações bem sucedidas: ${p.count}`);
  });

  const ctx = document.getElementById('captureTimelineChart');
  if (ctx) {
    timelineChart?.destroy();
    timelineChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: (data.timeline || []).map((t) => t.date),
        datasets: [{
          label: 'Empresas buscadas',
          data: (data.timeline || []).map((t) => t.total),
          borderColor: '#ff7a18',
          backgroundColor: 'rgba(255,122,24,.15)',
          fill: true,
          tension: 0.35,
        }],
      },
      options: { responsive: true },
    });
  }
}

async function runCaptacao(payload) {
  const r = await fetch('/api/captacao/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const p = await r.json();
  if (!r.ok) throw new Error(p.message || 'Falha na captação');
  return p;
}


function renderRealSearchTable(items = []) {
  const tbody = document.getElementById('realSearchTableBody');
  if (!items.length) {
    tbody.innerHTML = '<tr><td colspan="3" class="text-muted">Nenhuma empresa encontrada para os filtros.</td></tr>';
    return;
  }

  tbody.innerHTML = items.map((i, idx) => `
    <tr>
      <td><div class="fw-semibold">${i.name}</div><small class="text-muted">${i.category || 'Sem categoria'} • ${i.address || 'Sem endereço'}</small></td>
      <td><small>${i.phone || 'Sem telefone'}<br>${i.email || 'Sem e-mail'}<br>${i.site || ''}</small></td>
      <td><button class="btn btn-sm btn-outline-success" type="button" data-real-index="${idx}">Usar no formulário</button></td>
    </tr>`).join('');

  tbody.querySelectorAll('[data-real-index]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const item = items[Number(btn.dataset.realIndex)];
      prefillCaptureFromRealSearch(item?.name || 'Empresa', item?.category || '');
    });
  });
}

function prefillCaptureFromRealSearch(name, category) {
  document.getElementById('captureCategory').value = category && category !== 'Não informado' ? category : document.getElementById('captureCategory').value;
  showCaptureFeedback(`Empresa selecionada: ${name}. Você pode iniciar a captação usando essa base.`, 'success');
}

async function searchRealCompanies() {
  try {
    toggleCaptureLoading(true, 'Buscando empresas reais...');
    const params = new URLSearchParams({
      q: document.getElementById('realSearchTerm').value || '',
      category: document.getElementById('realSearchCategory').value || '',
      location: document.getElementById('realSearchLocation').value || document.getElementById('captureLocation').value || '',
      radius: document.getElementById('realSearchRadius').value || '5000',
      limit: document.getElementById('realSearchLimit').value || '15',
      hasPhone: String(document.getElementById('realHasPhone').checked),
      hasEmail: String(document.getElementById('realHasEmail').checked),
      hasWebsite: String(document.getElementById('realHasWebsite').checked),
    });
    const r = await fetch(`/api/empresas/search?${params.toString()}`);
    const data = await r.json();
    if (!r.ok) throw new Error(data.message || 'Erro na busca de empresas');
    renderRealSearchTable(data.items || []);
    document.getElementById('realSearchInfo').textContent = `Fonte: ${data.source}. ${data.total} empresa(s) encontrada(s).`;
  } catch (error) {
    showCaptureFeedback(error.message || 'Falha ao buscar empresas reais.');
  } finally {
    toggleCaptureLoading(false);
  }
}

async function searchSimilarCompanies(leadId) {
  try {
    toggleCaptureLoading(true, 'Buscando empresas parecidas...');
    const r = await fetch(`/api/empresas/similares/${leadId}`);
    const data = await r.json();
    if (!r.ok) throw new Error(data.message || 'Erro ao buscar similares');

    const tbody = document.getElementById('similarCompaniesTableBody');
    const items = data.items || [];
    if (!items.length) {
      tbody.innerHTML = '<tr><td colspan="2" class="text-muted">Nenhuma empresa parecida encontrada.</td></tr>';
    } else {
      tbody.innerHTML = items.map((i) => `<tr><td><div class="fw-semibold">${i.name}</div><small class="text-muted">${i.category} • ${i.address}</small></td><td><small>${i.phone}<br>${i.email}<br>${i.site}</small></td></tr>`).join('');
    }
    similarCompaniesModal.show();
  } catch (error) {
    showCaptureFeedback(error.message || 'Falha ao buscar empresas parecidas.');
  } finally {
    toggleCaptureLoading(false);
  }
}

function bindCaptureForm() {
  const scheduledSwitch = document.getElementById('scheduledSwitch');
  scheduledSwitch.addEventListener('change', () => document.getElementById('scheduledFields').classList.toggle('d-none', !scheduledSwitch.checked));

  const categoryInput = document.getElementById('captureCategory');
  categoryInput.addEventListener('input', debounce((e) => loadCategories(e.target.value), 250));
  categoryInput.addEventListener('blur', () => validateCategory(categoryInput.value));

  const locationInput = document.getElementById('captureLocation');
  locationInput.addEventListener('input', debounce(async (e) => {
    await loadLocations(e.target.value);
    applyLocationSelection();
  }, 350));
  locationInput.addEventListener('change', applyLocationSelection);

  document.getElementById('captureForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const payload = {
        scheduled: document.getElementById('scheduledSwitch').checked,
        scheduledAt: document.getElementById('scheduledAt').value || null,
        category: document.getElementById('captureCategory').value,
        location: document.getElementById('captureLocation').value,
        lat: selectedLocation?.lat,
        lon: selectedLocation?.lon,
        radius: Number(document.getElementById('captureRadius').value || 3000),
        collectInfo: document.getElementById('collectInfo').checked,
        quantity: Number(document.getElementById('captureQuantity').value || 5),
      };

      if (!payload.category?.trim()) return showCaptureFeedback('Informe uma categoria para busca.');
      if (!payload.lat || !payload.lon) return showCaptureFeedback('Informe uma localização válida.');

      toggleCaptureLoading(true);
      const result = await runCaptacao(payload);
      showCaptureFeedback(`Captação finalizada. ${result.created} registros criados.`, 'success');
      document.getElementById('captureForm').reset();
      selectedLocation = null;
      await refreshCaptacaoList();
      await refreshCaptacaoStats();
    } catch (err) {
      showCaptureFeedback(err.message || 'Falha ao executar captação.');
    } finally {
      toggleCaptureLoading(false);
    }
  });
}

function bindFilters() {
  const ids = ['captureSearchInput', 'captureStatusFilter', 'captureCategoryFilter'];
  ids.forEach((id) => document.getElementById(id).addEventListener('input', debounce(applyListFilters, 180)));
  document.getElementById('captureClearFilters').addEventListener('click', () => {
    document.getElementById('captureSearchInput').value = '';
    document.getElementById('captureStatusFilter').value = '';
    document.getElementById('captureCategoryFilter').value = '';
    applyListFilters();
  });
}

async function initCaptacaoPage() {
  initLocationMap();
  initHeatMap();
  statusModal = new bootstrap.Modal('#captureStatusModal');
  similarCompaniesModal = new bootstrap.Modal('#similarCompaniesModal');
  document.getElementById('captureStatusSaveBtn').addEventListener('click', saveCaptacaoStatus);
  document.getElementById('realSearchBtn').addEventListener('click', searchRealCompanies);

  await loadCategories('');
  bindCaptureForm();
  bindFilters();
  await refreshCaptacaoList();
  await refreshCaptacaoStats();
}
