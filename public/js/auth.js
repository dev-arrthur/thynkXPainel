const AUTH_KEY = 'thynkxp_admin';

function saveSession(admin) {
  localStorage.setItem(AUTH_KEY, JSON.stringify(admin));
}

function getSession() {
  const raw = localStorage.getItem(AUTH_KEY);
  return raw ? JSON.parse(raw) : null;
}

function clearSession() {
  localStorage.removeItem(AUTH_KEY);
}

function protectPage() {
  const session = getSession();
  if (!session) {
    window.location.href = '/index.html';
  }
}
