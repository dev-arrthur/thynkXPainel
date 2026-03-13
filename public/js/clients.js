let growthChart;
let cityChart;

function money(v) { return `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`; }

function maskCpfCnpj(value) {
  const digits = (value || '').replace(/\D/g, '');
  if (digits.length <= 11) return digits.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  return digits.replace(/(\d{2})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1/$2').replace(/(\d{4})(\d{1,2})$/, '$1-$2');
}

['companyDocument', 'responsibleCpf', 'editCompanyDocument'].forEach((id) => {
  document.addEventListener('input', (e) => {
    if (e.target && e.target.id === id) e.target.value = maskCpfCnpj(e.target.value);
  });
});

function clientActions(id) {
  return `<button class="btn btn-sm btn-outline-secondary" onclick="openEditClient('${id}')">Editar</button> <button class="btn btn-sm btn-outline-danger" onclick="deleteClient('${id}')">Excluir</button>`;
}

async function loadClients() {
  const tableBody = document.getElementById('clientsTableBody');
  const response = await fetch('/api/clients');
  const clients = await response.json();
  const countBadge = document.getElementById('clientsCount');
  if (countBadge) countBadge.textContent = clients.length;
  if (!tableBody) return;
  tableBody.innerHTML = clients.map((c) => `
    <tr>
      <td>${c.code || '-'}</td><td>${c.companyName || c.name || '-'}</td><td>${c.companyDocument || '-'}</td><td>${c.companyEmail || c.email || '-'}</td><td>${c.companyPhone || '-'}</td><td>${c.city || '-'}</td>
      <td class="text-success fw-semibold">${money(c.contractValue)}</td>
      ${document.getElementById('clientForm') ? `<td>${clientActions(c._id)}</td>` : ''}
    </tr>`).join('');
}

async function bindClientForm() {
  const form = document.getElementById('clientForm');
  if (!form) return;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const body = {
      responsibleCpf: document.getElementById('responsibleCpf').value,
      responsibleName: document.getElementById('responsibleName').value,
      responsibleSurname: document.getElementById('responsibleSurname').value,
      responsibleEmail: document.getElementById('responsibleEmail').value,
      responsiblePhone: document.getElementById('responsiblePhone').value,
      companyName: document.getElementById('companyName').value,
      companyDocument: document.getElementById('companyDocument').value,
      companyEmail: document.getElementById('companyEmail').value,
      companyPhone: document.getElementById('companyPhone').value,
      city: document.getElementById('city').value,
      contractValue: Number(document.getElementById('contractValue').value || 0),
      accessEmail: document.getElementById('accessEmail').value,
      accessPassword: document.getElementById('accessPassword').value,
    };
    const response = await fetch('/api/clients', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const payload = await response.json();
    const feedback = document.getElementById('clientFeedback');
    if (!response.ok) {
      feedback.className = 'alert alert-danger'; feedback.textContent = payload.message || 'Erro ao cadastrar'; feedback.classList.remove('d-none'); return;
    }
    feedback.className = 'alert alert-success'; feedback.textContent = 'Cliente cadastrado com sucesso!'; feedback.classList.remove('d-none');
    form.reset();
    await loadClients();
  });
}

async function openEditClient(id) {
  const response = await fetch('/api/clients');
  const clients = await response.json();
  const c = clients.find((x) => x._id === id);
  if (!c) return;
  document.getElementById('editClientId').value = c._id;
  document.getElementById('editCompanyName').value = c.companyName || '';
  document.getElementById('editCompanyDocument').value = c.companyDocument || '';
  document.getElementById('editCompanyEmail').value = c.companyEmail || '';
  document.getElementById('editCompanyPhone').value = c.companyPhone || '';
  document.getElementById('editCity').value = c.city || '';
  document.getElementById('editContractValue').value = c.contractValue || 0;
  new bootstrap.Offcanvas('#editClientPanel').show();
}

function bindEditClientForm() {
  const form = document.getElementById('editClientForm');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('editClientId').value;
    const body = {
      companyName: document.getElementById('editCompanyName').value,
      companyDocument: document.getElementById('editCompanyDocument').value,
      companyEmail: document.getElementById('editCompanyEmail').value,
      companyPhone: document.getElementById('editCompanyPhone').value,
      city: document.getElementById('editCity').value,
      contractValue: Number(document.getElementById('editContractValue').value || 0),
    };
    await fetch(`/api/clients/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    await loadClients();
  });
}

async function deleteClient(id) {
  if (!confirm('Excluir cliente?')) return;
  await fetch(`/api/clients/${id}`, { method: 'DELETE' });
  await loadClients();
}

async function loadClientDashboardStats() {
  const response = await fetch('/api/clients/stats/dashboard');
  const data = await response.json();
  if (!response.ok) return;

  const totalEl = document.getElementById('kpiTotalClients');
  const avgEl = document.getElementById('kpiAvgContract');
  const cityEl = document.getElementById('kpiTopCity');
  if (totalEl) totalEl.textContent = data.totalClients;
  if (avgEl) avgEl.textContent = money(data.averageContract);
  if (cityEl) cityEl.textContent = data.cities[0]?.city || '-';

  const growthCtx = document.getElementById('growthChart');
  if (growthCtx) {
    growthChart?.destroy();
    growthChart = new Chart(growthCtx, {
      type: 'line',
      data: { labels: data.growth.map((g) => g.month), datasets: [{ label: 'Clientes', data: data.growth.map((g) => g.total), borderColor: '#ff7a18', backgroundColor: 'rgba(255,122,24,.2)', fill: true }] },
      options: { responsive: true, plugins: { legend: { display: false } } },
    });
  }

  const cityCtx = document.getElementById('cityChart');
  if (cityCtx) {
    cityChart?.destroy();
    const top = data.cities.slice(0, 6);
    cityChart = new Chart(cityCtx, {
      type: 'bar',
      data: { labels: top.map((c) => c.city), datasets: [{ data: top.map((c) => c.total), backgroundColor: '#ffb347' }] },
      options: { responsive: true, plugins: { legend: { display: false } } },
    });
  }
}
