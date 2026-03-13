async function loadClients() {
  const tableBody = document.getElementById('clientsTableBody');
  const countBadge = document.getElementById('clientsCount');
  if (!tableBody) return;

  const response = await fetch('/api/clients');
  const clients = await response.json();

  countBadge.textContent = clients.length;
  tableBody.innerHTML = clients
    .map(
      (client) => `
      <tr>
        <td>${client.name}</td>
        <td>${client.email}</td>
        <td>${client.company}</td>
        <td><span class="badge text-bg-secondary">${client.status}</span></td>
      </tr>
    `
    )
    .join('');
}

async function bindClientForm() {
  const form = document.getElementById('clientForm');
  if (!form) return;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const body = {
      name: document.getElementById('clientName').value,
      email: document.getElementById('clientEmail').value,
      company: document.getElementById('clientCompany').value,
      status: document.getElementById('clientStatus').value,
      notes: document.getElementById('clientNotes').value,
    };

    const response = await fetch('/api/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const payload = await response.json();
    const feedback = document.getElementById('clientFeedback');

    if (!response.ok) {
      feedback.className = 'alert alert-danger';
      feedback.textContent = payload.message;
      feedback.classList.remove('d-none');
      return;
    }

    feedback.className = 'alert alert-success';
    feedback.textContent = 'Cliente cadastrado com sucesso!';
    feedback.classList.remove('d-none');
    form.reset();
    await loadClients();
  });
}
