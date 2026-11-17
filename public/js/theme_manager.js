(function () {
  const STORAGE_KEY = 'sas_subcon_theme';

  function preferredTheme() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
    return 'dark';
  }

  function applyTheme(theme) {
    const resolved = theme === 'light' ? 'light' : 'dark';
    document.documentElement.dataset.theme = resolved;
    document.body && document.body.setAttribute('data-theme', resolved);
    localStorage.setItem(STORAGE_KEY, resolved);

    const buttons = document.querySelectorAll('[data-theme-toggle]');
    buttons.forEach((button) => {
      const isLight = resolved === 'light';
      button.setAttribute('aria-label', isLight ? 'Switch to dark mode' : 'Switch to light mode');
      button.setAttribute('title', isLight ? 'Dark mode' : 'Light mode');
      button.innerHTML = isLight
        ? '<span aria-hidden="true">🌙</span><span>Dark</span>'
        : '<span aria-hidden="true">☀️</span><span>Light</span>';
    });
  }

  function injectThemeButton() {
    if (document.querySelector('[data-theme-toggle]')) return;

    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('data-theme-toggle', 'true');
    button.className = 'sas-theme-toggle';
    button.addEventListener('click', () => {
      applyTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light');
    });

    const headerNav = document.querySelector('header nav') || document.querySelector('header .flex.flex-wrap') || document.querySelector('header');
    if (headerNav) {
      headerNav.appendChild(button);
    } else {
      document.body.appendChild(button);
    }

    applyTheme(preferredTheme());
  }

  applyTheme(preferredTheme());
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectThemeButton);
  } else {
    injectThemeButton();
  }

  window.SASTheme = { applyTheme, preferredTheme };
})();
