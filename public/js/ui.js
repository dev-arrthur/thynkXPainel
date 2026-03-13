function initRevealAnimations() {
  const items = document.querySelectorAll('.reveal');
  if (!items.length) return;
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) entry.target.classList.add('show');
    });
  }, { threshold: 0.16 });
  items.forEach((item) => observer.observe(item));
}

document.addEventListener('DOMContentLoaded', initRevealAnimations);
