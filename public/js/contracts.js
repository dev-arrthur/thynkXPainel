function showContractFeedback(message, type = 'danger') {
  const f = document.getElementById('contractFeedback');
  if (!f) return;
  f.className = `alert alert-${type}`;
  f.textContent = message;
  f.classList.remove('d-none');
}

async function loadClientsForContracts() {
  const select = document.getElementById('contractClientId');
  if (!select) return;
  const response = await fetch('/api/clients');
  const clients = await response.json();
  select.innerHTML = '<option value="">Selecione o cliente</option>' + clients.map((c) => `<option value="${c._id}" data-doc="${c.companyDocument}" data-email="${c.companyEmail}" data-phone="${c.companyPhone}" data-value="${c.contractValue}">${c.code} - ${c.companyName}</option>`).join('');
  select.addEventListener('change', () => {
    const opt = select.selectedOptions[0];
    document.getElementById('contractClientDoc').value = opt?.dataset?.doc || '';
    document.getElementById('contractClientEmail').value = opt?.dataset?.email || '';
    document.getElementById('contractClientPhone').value = opt?.dataset?.phone || '';
    document.getElementById('contractClientValue').value = `R$ ${Number(opt?.dataset?.value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  });

  const descriptionModel = document.getElementById('descriptionModel');
  descriptionModel?.addEventListener('change', () => {
    if (descriptionModel.value) document.getElementById('descriptionText').value = descriptionModel.value;
  });
}

function contractActions(id) {
  return `<button class="btn btn-sm btn-outline-danger" onclick="deleteContract('${id}')">Excluir</button>`;
}

async function loadContracts() {
  const table = document.getElementById('contractsTableBody');
  if (!table) return;
  const response = await fetch('/api/contracts');
  const contracts = await response.json();
  table.innerHTML = contracts.map((c) => `
    <tr>
      <td>${c.code}</td><td>${c.clientName}</td><td>${c.clientDocument}</td><td class="text-success fw-semibold">R$ ${Number(c.contractValue||0).toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
      <td><a class="btn btn-sm btn-outline-primary" href="${c.pdfPath}" target="_blank" rel="noopener">Visualizar PDF</a></td>
      <td><a href="/pages/assinatura/contrato.html?token=${c.signatureToken}" target="_blank">${c.signed ? 'Assinado' : 'Aguardando assinatura'}</a></td>
      <td>${contractActions(c._id)}</td>
    </tr>`).join('');
}

function bindContractForm() {
  const form = document.getElementById('contractForm');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const clauses = document.getElementById('clausesText').value.split('\n').map((v) => v.trim()).filter(Boolean);
    const body = {
      clientId: document.getElementById('contractClientId').value,
      descriptionText: document.getElementById('descriptionText').value,
      clauseTheme: document.getElementById('clauseTheme').value,
      clauses,
    };
    const response = await fetch('/api/contracts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const payload = await response.json();
    if (!response.ok) return showContractFeedback(payload.message || 'Erro ao criar contrato');
    showContractFeedback('Contrato criado com sucesso.', 'success');
    form.reset();
    await loadContracts();
  });
}

async function deleteContract(id) {
  if (!confirm('Excluir contrato?')) return;
  await fetch(`/api/contracts/${id}`, { method: 'DELETE' });
  await loadContracts();
}
