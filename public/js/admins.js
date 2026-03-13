function showAdminFeedback(message, type = 'danger', targetId = 'adminFeedback') {
  const feedback = document.getElementById(targetId);
  if (!feedback) return;
  feedback.className = `alert alert-${type}`;
  feedback.textContent = message;
  feedback.classList.remove('d-none');
}

async function loadAdmins() {
  const tableBody = document.getElementById('adminsTableBody');
  if (!tableBody) return;

  try {
    const response = await fetch('/api/admins');
    const admins = await response.json();

    if (!response.ok) {
      showAdminFeedback(admins.message || 'Erro ao listar administradores.');
      return;
    }

    tableBody.innerHTML = admins.map((admin) => `
      <tr>
        <td>${admin.name}</td>
        <td>${admin.email}</td>
        <td>${admin.mustResetPassword ? '<span class="badge text-bg-warning">Redefinir no 1º acesso</span>' : '<span class="badge text-bg-success">OK</span>'}</td>
      </tr>
    `).join('');
  } catch {
    showAdminFeedback('Erro de conexão ao listar administradores.');
  }
}

function bindAddAdminForm() {
  const form = document.getElementById('addAdminForm');
  if (!form) return;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const panelFeedback = document.getElementById('addAdminFeedback');
    panelFeedback.classList.add('d-none');

    const name = document.getElementById('adminName').value.trim();
    const email = document.getElementById('adminEmail').value.trim();
    const password = document.getElementById('adminPassword').value.trim();

    try {
      const response = await fetch('/api/admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });

      const payload = await response.json();
      if (!response.ok) {
        showAdminFeedback(payload.message || 'Erro ao criar administrador.', 'danger', 'addAdminFeedback');
        return;
      }

      showAdminFeedback('Administrador criado com sucesso.', 'success', 'addAdminFeedback');
      form.reset();
      await loadAdmins();
    } catch {
      showAdminFeedback('Erro de conexão ao criar administrador.', 'danger', 'addAdminFeedback');
    }
  });
}
