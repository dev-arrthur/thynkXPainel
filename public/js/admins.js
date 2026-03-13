function showAdminFeedback(message, type = 'danger', targetId = 'adminFeedback') {
  const feedback = document.getElementById(targetId);
  if (!feedback) return;
  feedback.className = `alert alert-${type}`;
  feedback.textContent = message;
  feedback.classList.remove('d-none');
}

function adminActions(id) {
  return `
    <button class="btn btn-sm btn-outline-secondary" onclick="openEditAdmin('${id}')">Editar</button>
    <button class="btn btn-sm btn-outline-danger" onclick="deleteAdmin('${id}')">Excluir</button>
  `;
}

function passwordCell(admin) {
  const safe = admin.passwordPreview || '******';
  return `
    <div class="d-flex align-items-center gap-2">
      <input class="form-control form-control-sm" type="password" value="${safe}" id="pwd-${admin._id}" readonly>
      <button class="btn btn-sm btn-outline-dark" onclick="toggleAdminPassword('${admin._id}')"><i class="bi bi-eye"></i></button>
    </div>
  `;
}

function toggleAdminPassword(id) {
  const input = document.getElementById(`pwd-${id}`);
  if (!input) return;
  input.type = input.type === 'password' ? 'text' : 'password';
}

async function loadAdmins() {
  const tableBody = document.getElementById('adminsTableBody');
  if (!tableBody) return;
  const response = await fetch('/api/admins');
  const admins = await response.json();
  if (!response.ok) return showAdminFeedback(admins.message || 'Erro ao listar administradores.');

  tableBody.innerHTML = admins.map((admin) => `
    <tr>
      <td>${admin.name}</td>
      <td>${admin.email}</td>
      <td>${passwordCell(admin)}</td>
      <td class="d-flex gap-2">${adminActions(admin._id)}</td>
    </tr>
  `).join('');
}

async function deleteAdmin(id) {
  if (!confirm('Deseja excluir este administrador?')) return;
  await fetch(`/api/admins/${id}`, { method: 'DELETE' });
  await loadAdmins();
}

async function openEditAdmin(id) {
  const response = await fetch('/api/admins');
  const admins = await response.json();
  const admin = admins.find((a) => a._id === id);
  if (!admin) return;
  document.getElementById('editAdminId').value = admin._id;
  document.getElementById('editAdminName').value = admin.name;
  document.getElementById('editAdminEmail').value = admin.email;
  new bootstrap.Offcanvas('#editAdminPanel').show();
}

function bindAddAdminForm() {
  const form = document.getElementById('addAdminForm');
  if (!form) return;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const body = {
      name: document.getElementById('adminName').value.trim(),
      email: document.getElementById('adminEmail').value.trim(),
      password: document.getElementById('adminPassword').value.trim(),
    };
    const response = await fetch('/api/admins', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const payload = await response.json();
    if (!response.ok) return showAdminFeedback(payload.message || 'Erro ao criar administrador.', 'danger', 'addAdminFeedback');
    showAdminFeedback('Administrador criado com sucesso.', 'success', 'addAdminFeedback');
    form.reset();
    await loadAdmins();
  });
}

function bindEditAdminForm() {
  const form = document.getElementById('editAdminForm');
  if (!form) return;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const id = document.getElementById('editAdminId').value;
    const body = {
      name: document.getElementById('editAdminName').value.trim(),
      email: document.getElementById('editAdminEmail').value.trim(),
      password: document.getElementById('editAdminPassword').value.trim(),
    };
    const response = await fetch(`/api/admins/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const payload = await response.json();
    if (!response.ok) return showAdminFeedback(payload.message || 'Erro ao atualizar administrador.', 'danger', 'editAdminFeedback');
    showAdminFeedback('Administrador atualizado.', 'success', 'editAdminFeedback');
    await loadAdmins();
  });
}
