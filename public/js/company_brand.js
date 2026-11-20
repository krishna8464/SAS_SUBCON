(function () {
  function injectBrand() {
    if (document.querySelector('[data-company-brand]')) return;

    const path = window.location.pathname || '';
    if (path === '/user/login-page' || path === '/') return;

    const logo = document.createElement('img');
    logo.src = '/images/sas-subcon-logo.svg';
    logo.alt = 'SEEH AL SARYA Engineering LLC';
    logo.setAttribute('data-company-brand', 'true');
    logo.className = 'sas-company-logo';

    const header = document.querySelector('header') || document.querySelector('.dashboard-header');
    if (header) {
      header.prepend(logo);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectBrand);
  } else {
    injectBrand();
  }
})();
