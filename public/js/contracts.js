const CLAUSE_LIBRARY = {
  Marketing: [
    'A thynkXP Sistemas & Soluções executará plano de marketing com calendário mensal aprovado pelo cliente.',
    'O cliente fornecerá materiais e aprovações em até 3 dias úteis para não impactar cronograma.',
    'Resultados serão apresentados em relatório mensal com KPIs de tráfego, leads e conversão.',
  ],
  'Criação de Sites': [
    'A thynkXP Sistemas & Soluções entregará layout responsivo e otimizado para SEO técnico.',
    'Alterações fora do escopo inicial serão orçadas à parte mediante aprovação do cliente.',
    'Publicação ocorrerá após validação final em ambiente de homologação.',
  ],
  'Criação de Sistemas': [
    'O desenvolvimento seguirá metodologia incremental com entregas por sprint.',
    'O cliente indicará um responsável para validação funcional das entregas.',
    'Correções de bugs críticos serão tratadas com prioridade conforme SLA acordado.',
  ],
  Parcerias: [
    'As partes atuarão em cooperação comercial e técnica para execução dos serviços pactuados.',
    'Informações estratégicas compartilhadas entre as partes são confidenciais.',
    'Receitas e responsabilidades seguirão o plano comercial firmado entre as partes.',
  ],
  'Suporte Técnico': [
    'Atendimentos serão realizados nos horários comerciais definidos em contrato.',
    'Incidentes críticos terão tratamento prioritário conforme SLA vigente.',
    'Solicitações de melhoria evolutiva serão analisadas e planejadas em backlog.',
  ],
  'Gestão de Tráfego': [
    'A thynkXP Sistemas & Soluções gerenciará campanhas com otimizações semanais.',
    'O investimento em mídia será de responsabilidade do cliente junto às plataformas.',
    'A performance será acompanhada por métricas de CPA, CPL e ROAS.',
  ],
  'Consultoria TI': [
    'Serão realizadas reuniões periódicas para diagnóstico e plano de evolução tecnológica.',
    'Recomendações técnicas serão formalizadas em relatório com plano de ação.',
    'A execução das recomendações dependerá de aprovação do cliente.',
  ],
};

const state = {
  currentContractDraft: null,
  previewModal: null,
  contractsCache: [],
};

function showContractFeedback(message, type = 'danger') {
  const f = document.getElementById('contractFeedback');
  if (!f) return;
  f.className = `alert alert-${type}`;
  f.textContent = message;
  f.classList.remove('d-none');
}

function createClauseInput(value = '') {
  const wrap = document.createElement('div');
  wrap.className = 'input-group';
  wrap.innerHTML = `<span class="input-group-text">Cláusula</span><input class="form-control clause-input" value="${value.replace(/"/g, '&quot;')}" placeholder="Digite a cláusula..."><button class="btn btn-outline-danger" type="button">Remover</button>`;
  wrap.querySelector('button').addEventListener('click', () => wrap.remove());
  return wrap;
}

function ensureMinimumClauses() {
  const container = document.getElementById('clausesContainer');
  if (!container) return;
  if (!container.querySelector('.clause-input')) {
    container.appendChild(createClauseInput('A thynkXP Sistemas & Soluções executará os serviços conforme escopo contratado.'));
    container.appendChild(createClauseInput('O cliente deverá validar entregas e aprovar etapas em prazo hábil.'));
    container.appendChild(createClauseInput('Pagamentos seguirão o cronograma financeiro acordado entre as partes.'));
  }
}

function getClausesFromInputs() {
  return [...document.querySelectorAll('#clausesContainer .clause-input')].map((i) => i.value.trim()).filter(Boolean);
}

async function loadClientsForContracts() {
  const select = document.getElementById('contractClientId');
  if (!select) return;
  const response = await fetch('/api/clients');
  const clients = await response.json();
  select.innerHTML = '<option value="">Selecione o cliente</option>' + clients.map((c) => `<option value="${c._id}" data-name="${c.companyName}" data-doc="${c.companyDocument}" data-email="${c.companyEmail}" data-phone="${c.companyPhone}" data-value="${c.contractValue}">${c.code} - ${c.companyName}</option>`).join('');

  select.addEventListener('change', () => {
    const opt = select.selectedOptions[0];
    document.getElementById('contractClientDoc').value = opt?.dataset?.doc || '';
    document.getElementById('contractClientEmail').value = opt?.dataset?.email || '';
    document.getElementById('contractClientPhone').value = opt?.dataset?.phone || '';
    document.getElementById('contractClientValue').value = `R$ ${Number(opt?.dataset?.value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  });

  document.getElementById('descriptionModel')?.addEventListener('change', (e) => {
    if (e.target.value) document.getElementById('descriptionText').value = e.target.value;
  });
}

function contractActions(id) {
  return `<button class="btn btn-sm btn-outline-danger" onclick="deleteContract('${id}')">Excluir</button>`;
}

function getDateOnly(value) {
  return value ? new Date(value).toISOString().slice(0, 10) : '';
}

function filterContracts(list) {
  const search = (document.getElementById('contractsSearch')?.value || '').trim().toLowerCase();
  const theme = document.getElementById('contractsThemeFilter')?.value || '';
  const start = document.getElementById('contractsStartDate')?.value || '';
  const end = document.getElementById('contractsEndDate')?.value || '';

  return list.filter((c) => {
    const hay = `${c.code || ''} ${c.clientName || ''} ${c.clientDocument || ''}`.toLowerCase();
    const bySearch = !search || hay.includes(search);
    const byTheme = !theme || (c.clauseTheme || '') === theme;
    const created = getDateOnly(c.createdAt);
    const byStart = !start || created >= start;
    const byEnd = !end || created <= end;
    return bySearch && byTheme && byStart && byEnd;
  });
}

function renderContractsTable(contracts) {
  const table = document.getElementById('contractsTableBody');
  if (!table) return;
  table.innerHTML = contracts.map((c) => `
    <tr>
      <td>${c.code}</td>
      <td>${c.clientName}</td>
      <td>${c.clientDocument}</td>
      <td><span class="badge text-bg-light border">${c.clauseTheme || 'Geral'}</span></td>
      <td class="text-success fw-semibold">R$ ${Number(c.contractValue||0).toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
      <td><a class="btn btn-sm btn-outline-primary" href="${c.pdfPath}" target="_blank" rel="noopener">Visualizar PDF</a></td>
      <td><a href="/pages/assinatura/contrato.html?token=${c.signatureToken}" target="_blank">${c.signed ? 'Assinado' : 'Aguardando assinatura'}</a></td>
      <td>${contractActions(c._id)}</td>
    </tr>`).join('');
}

async function loadContracts() {
  const response = await fetch('/api/contracts');
  const contracts = await response.json();
  state.contractsCache = Array.isArray(contracts) ? contracts : [];
  renderContractsTable(filterContracts(state.contractsCache));
}

function bindContractsFilters() {
  const ids = ['contractsSearch', 'contractsThemeFilter', 'contractsStartDate', 'contractsEndDate'];
  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', () => renderContractsTable(filterContracts(state.contractsCache)));
    el.addEventListener('change', () => renderContractsTable(filterContracts(state.contractsCache)));
  });

  document.getElementById('clearContractsFilters')?.addEventListener('click', () => {
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    renderContractsTable(filterContracts(state.contractsCache));
  });
}

function buildDraftFromForm() {
  const select = document.getElementById('contractClientId');
  const opt = select.selectedOptions[0];
  return {
    clientId: select.value,
    clientName: opt?.dataset?.name || '',
    clientDoc: document.getElementById('contractClientDoc').value,
    clientEmail: document.getElementById('contractClientEmail').value,
    clientPhone: document.getElementById('contractClientPhone').value,
    contractValueLabel: document.getElementById('contractClientValue').value,
    descriptionText: document.getElementById('descriptionText').value.trim(),
    clauseTheme: document.getElementById('clauseTheme').value,
    clauses: getClausesFromInputs(),
  };
}

function renderPreviewEditor(draft) {
  const preview = document.getElementById('previewEditor');
  preview.innerHTML = `
    <div class="contract-preview-sheet">
      <h4 class="mb-2">thynkXP Sistemas & Soluções</h4>
      <hr>
      <h6>Dados do Contrato</h6>
      <p><strong>Cliente:</strong> ${draft.clientName}<br><strong>CNPJ/CPF:</strong> ${draft.clientDoc}<br><strong>E-mail:</strong> ${draft.clientEmail}<br><strong>Telefone:</strong> ${draft.clientPhone}<br><strong>Valor:</strong> ${draft.contractValueLabel}</p>
      <h6>Descrição (editável)</h6>
      <textarea id="previewDescriptionEdit" class="form-control mb-3" rows="4">${draft.descriptionText || ''}</textarea>
      <h6>Tema de cláusulas</h6>
      <p class="mb-2">${draft.clauseTheme}</p>
      <h6>Cláusulas (editáveis)</h6>
      <div id="previewClausesEdit" class="d-grid gap-2">${draft.clauses.map((c, i) => `<div class="input-group"><span class="input-group-text">${i + 1}</span><input class="form-control preview-clause" value="${c.replace(/"/g, '&quot;')}"></div>`).join('')}</div>
      <hr>
      <div class="form-check mt-3">
        <input class="form-check-input" type="checkbox" id="confirmPreviewCheck">
        <label class="form-check-label" for="confirmPreviewCheck">Li e revisei o contrato por completo. Confirmo a geração do PDF.</label>
      </div>
      <p class="text-muted small mt-2 mb-0">A confirmação acima (ao final do contrato) é obrigatória para liberar o botão de geração.</p>
    </div>
  `;

  document.getElementById('confirmPreviewCheck')?.addEventListener('change', (e) => {
    document.getElementById('confirmGenerateBtn').disabled = !e.target.checked;
  });
}

function syncPreviewToDraft() {
  if (!state.currentContractDraft) return;
  state.currentContractDraft.descriptionText = document.getElementById('previewDescriptionEdit')?.value?.trim() || '';
  state.currentContractDraft.clauses = [...document.querySelectorAll('.preview-clause')].map((i) => i.value.trim()).filter(Boolean);
}

function initContractBuilder() {
  const addClauseBtn = document.getElementById('addClauseBtn');
  const loadThemeClausesBtn = document.getElementById('loadThemeClausesBtn');
  const openPreviewBtn = document.getElementById('openPreviewBtn');
  const confirmGenerateBtn = document.getElementById('confirmGenerateBtn');

  state.previewModal = new bootstrap.Modal(document.getElementById('contractPreviewModal'));
  ensureMinimumClauses();
  bindContractsFilters();

  addClauseBtn?.addEventListener('click', () => document.getElementById('clausesContainer').appendChild(createClauseInput('')));

  loadThemeClausesBtn?.addEventListener('click', () => {
    const theme = document.getElementById('clauseTheme').value;
    const lib = CLAUSE_LIBRARY[theme] || CLAUSE_LIBRARY.Marketing;
    const container = document.getElementById('clausesContainer');
    container.innerHTML = '';
    lib.forEach((text) => container.appendChild(createClauseInput(text)));
  });

  openPreviewBtn?.addEventListener('click', () => {
    const draft = buildDraftFromForm();
    if (!draft.clientId) return showContractFeedback('Selecione um cliente antes de abrir o preview.');
    if (!draft.clauses.length) return showContractFeedback('Adicione ao menos 1 cláusula para gerar o contrato.');
    state.currentContractDraft = draft;
    renderPreviewEditor(draft);
    confirmGenerateBtn.disabled = true;
    state.previewModal.show();
  });

  confirmGenerateBtn?.addEventListener('click', async () => {
    syncPreviewToDraft();
    const draft = state.currentContractDraft;
    const response = await fetch('/api/contracts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: draft.clientId, descriptionText: draft.descriptionText, clauseTheme: draft.clauseTheme, clauses: draft.clauses }),
    });
    const payload = await response.json();
    if (!response.ok) return showContractFeedback(payload.message || 'Erro ao criar contrato');

    showContractFeedback('Contrato gerado com sucesso após pré-visualização e confirmação.', 'success');
    state.previewModal.hide();
    document.getElementById('contractForm').reset();
    document.getElementById('clausesContainer').innerHTML = '';
    ensureMinimumClauses();
    await loadContracts();
  });
}

async function deleteContract(id) {
  if (!confirm('Excluir contrato?')) return;
  await fetch(`/api/contracts/${id}`, { method: 'DELETE' });
  await loadContracts();
}
