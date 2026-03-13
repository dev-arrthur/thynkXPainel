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
    if (initial) initial.textContent = session.name?.[0]?.toUpperCase() || 'A';
  }

  const currentPath = window.location.pathname;
  let hasDocChildActive = false;
  document.querySelectorAll('.sidebar .nav-link[href]').forEach((link) => {
    if (link.getAttribute('href') === currentPath) {
      link.classList.add('active');
      if (currentPath.includes('/pages/documentacao-')) hasDocChildActive = true;
    }
  });

  if (hasDocChildActive) {
    const docMenu = document.getElementById('docMenu');
    docMenu?.classList.add('show');
  }

  document.getElementById('logoutButton')?.addEventListener('click', () => {
    clearSession();
    window.location.href = '/index.html';
  });
}
