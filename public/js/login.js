const loginForm = document.getElementById('loginForm');
const loginAlert = document.getElementById('loginAlert');
const togglePassword = document.getElementById('togglePassword');

if (getSession()) window.location.href = '/pages/dashboard.html';

function showAlert(message, type = 'danger') {
  loginAlert.className = `alert alert-${type}`;
  loginAlert.textContent = message;
  loginAlert.classList.remove('d-none');
}

togglePassword?.addEventListener('click', () => {
  const password = document.getElementById('password');
  const icon = togglePassword.querySelector('i');
  const show = password.type === 'password';
  password.type = show ? 'text' : 'password';
  icon.className = show ? 'bi bi-eye-slash' : 'bi bi-eye';
});

loginForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  loginAlert.classList.add('d-none');

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value.trim();
  if (!email || !password || password.length < 6) {
    showAlert('Preencha email e senha válida (mínimo 6 caracteres).');
    return;
  }

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
    setTimeout(() => { window.location.href = '/pages/dashboard.html'; }, 900);
  } catch {
    showAlert('Erro de conexão com o servidor.');
  }
});
