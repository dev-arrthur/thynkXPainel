async function mountSidebar() {
  const holder = document.getElementById('sidebarMount');
  if (!holder) return;

  const response = await fetch('/partials/sidebar.html');
  holder.innerHTML = await response.text();

  const session = getSession();
  if (session) {
    const name = document.getElementById('sidebarName');
    const email = document.getElementById('sidebarEmail');
    const initial = document.getElementById('sidebarInitial');
    if (name) name.textContent = session.name;
    if (email) email.textContent = session.email;
    if (initial) initial.textContent = session.name[0].toUpperCase();
  }

  const logoutButton = document.getElementById('logoutButton');
  logoutButton?.addEventListener('click', () => {
    clearSession();
    window.location.href = '/index.html';
  });

  const currentPath = window.location.pathname;
  document.querySelectorAll('.sidebar .nav-link[href]').forEach((link) => {
    if (link.getAttribute('href') === currentPath) {
      link.classList.add('active');
    }
  });
}
