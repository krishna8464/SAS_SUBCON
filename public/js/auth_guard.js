(function () {
  const token = localStorage.getItem('token');
  const role = localStorage.getItem('role');
  const currentPath = window.location.pathname;

  const roleRoutes = {
    '/user/manage-users': ['HO', 'ERP_TEAM', 'DEVELOPER'],
    '/site/manage-sites': ['HO', 'ERP_TEAM', 'DEVELOPER', 'SITE_MANAGER'],
    '/supplier/manage-suppliers': ['HO', 'ERP_TEAM', 'DEVELOPER'],
    '/designation/manage-designations': ['HO', 'ERP_TEAM', 'DEVELOPER', 'SITE_MANAGER'],
    '/mobilization/portal': ['SUPPLIER', 'HO', 'ERP_TEAM', 'DEVELOPER'],
    '/user/medic-dashboard': ['SITE_MEDIC', 'SITE_HSE', 'HO', 'ERP_TEAM', 'DEVELOPER'],
    '/user/hse-dashboard': ['SITE_HSE', 'HO', 'ERP_TEAM', 'DEVELOPER']
  };

  const redirectByRole = () => {
    if (!role) return '/user/login-page';
    if (role === 'SUPPLIER') return '/mobilization/portal';
    if (['SITE_MEDIC', 'SITE_HSE'].includes(role)) return '/user/medic-dashboard';
    return '/user/dashboard-view';
  };

  const injectDashboardButton = () => {
    if (!['/user/dashboard-view', '/user/login-page'].includes(currentPath)) {
      const existing = document.querySelector('[data-sas-dashboard-link]');
      if (!existing) {
        const button = document.createElement('a');
        button.href = '/user/dashboard-view';
        button.setAttribute('data-sas-dashboard-link', 'true');
        button.className = 'bg-violet-600/20 hover:bg-violet-600/30 text-violet-200 text-xs font-bold px-3 py-2 rounded-xl border border-violet-500/30 transition';
        button.innerHTML = 'Dashboard';

        const nav = document.querySelector('header nav') || document.querySelector('header .flex.flex-wrap') || document.querySelector('header');
        if (nav) {
          nav.appendChild(button);
        } else {
          const fallback = document.createElement('div');
          fallback.style.cssText = 'position:fixed;top:12px;right:12px;z-index:10000';
          fallback.appendChild(button);
          document.body.appendChild(fallback);
        }
      }
    }
  };

  if (!token) {
    if (currentPath !== '/user/login-page') {
      window.location.replace('/user/login-page');
    }
    return;
  }

  if (currentPath === '/user/login-page') {
    window.location.replace('/user/dashboard-view');
    return;
  }

  const allowedRoles = roleRoutes[currentPath];
  if (allowedRoles && role && !allowedRoles.includes(role)) {
    window.location.replace('/user/dashboard-view');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectDashboardButton);
  } else {
    injectDashboardButton();
  }
})();
