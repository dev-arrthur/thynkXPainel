const loginForm = document.getElementById('loginForm');
const loginAlert = document.getElementById('loginAlert');
const togglePassword = document.getElementById('togglePassword');
const firstAccessModalElement = document.getElementById('firstAccessModal');
const firstAccessForm = document.getElementById('firstAccessForm');
const firstAccessAlert = document.getElementById('firstAccessAlert');

let pendingEmail = '';
let pendingCurrentPassword = '';
let firstAccessModal;

if (firstAccessModalElement && window.bootstrap) {
  firstAccessModal = new bootstrap.Modal(firstAccessModalElement);
}

if (getSession()) window.location.href = '/pages/dashboard.html';

function showAlert(message, type = 'danger') {
  loginAlert.className = `alert alert-${type}`;
  loginAlert.textContent = message;
  loginAlert.classList.remove('d-none');
}

function showFirstAccessAlert(message, type = 'danger') {
  firstAccessAlert.className = `alert alert-${type}`;
  firstAccessAlert.textContent = message;
  firstAccessAlert.classList.remove('d-none');
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

    if (payload.requirePasswordReset) {
      pendingEmail = payload.email;
      pendingCurrentPassword = password;
      showAlert(payload.message, 'warning');
      firstAccessAlert.classList.add('d-none');
      firstAccessForm.reset();
      firstAccessModal?.show();
      return;
    }

    saveSession(payload.admin);
    showAlert('Login efetuado! Redirecionando...', 'success');
    setTimeout(() => { window.location.href = '/pages/dashboard.html'; }, 900);
  } catch {
    showAlert('Erro de conexão com o servidor.');
  }
});

firstAccessForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  firstAccessAlert.classList.add('d-none');

  const newPassword = document.getElementById('newPassword').value.trim();
  const confirmNewPassword = document.getElementById('confirmNewPassword').value.trim();

  if (newPassword.length < 6) {
    showFirstAccessAlert('A nova senha deve ter no mínimo 6 caracteres.');
    return;
  }

  if (newPassword !== confirmNewPassword) {
    showFirstAccessAlert('A confirmação da senha não confere.');
    return;
  }

  try {
    const response = await fetch('/api/auth/reset-password-first-access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: pendingEmail,
        currentPassword: pendingCurrentPassword,
        newPassword,
      }),
    });

    const payload = await response.json();
    if (!response.ok) {
      showFirstAccessAlert(payload.message || 'Erro ao redefinir senha.');
      return;
    }

    saveSession(payload.admin);
    showFirstAccessAlert('Senha atualizada! Redirecionando...', 'success');
    setTimeout(() => {
      firstAccessModal?.hide();
      window.location.href = '/pages/dashboard.html';
    }, 900);
  } catch {
    showFirstAccessAlert('Erro de conexão com servidor.');
  }
});
