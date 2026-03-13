const loginForm = document.getElementById('loginForm');
const loginAlert = document.getElementById('loginAlert');

if (getSession()) {
  window.location.href = '/pages/dashboard.html';
}

function showAlert(message, type = 'danger') {
  loginAlert.className = `alert alert-${type}`;
  loginAlert.textContent = message;
  loginAlert.classList.remove('d-none');
}

loginForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  loginAlert.classList.add('d-none');

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value.trim();

  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const payload = await response.json();

    if (!response.ok) {
      showAlert(payload.message || 'Falha ao autenticar.');
      return;
    }

    saveSession(payload.admin);
    showAlert('Login efetuado! Redirecionando...', 'success');

    setTimeout(() => {
      window.location.href = '/pages/dashboard.html';
    }, 800);
  } catch (error) {
    showAlert('Erro de conexão com o servidor.');
  }
});
