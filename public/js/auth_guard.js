(function () {
  const token = localStorage.getItem('token');
  const role = localStorage.getItem('role');
  const currentPath = window.location.pathname;

  const roleRoutes = {
    '/user/manage-users': ['HO', 'ERP_TEAM', 'DEVELOPER'],
    '/site/manage-sites': ['HO', 'ERP_TEAM', 'DEVELOPER', 'SITE_MANAGER'],
    '/supplier/manage-suppliers': ['HO', 'ERP_TEAM', 'DEVELOPER'],
    '/designation/manage-designations': ['HO', 'ERP_TEAM', 'DEVELOPER', 'SITE_MANAGER'],
    '/mobilization/portal': ['SUPPLIER'],
    '/user/medic-dashboard': ['SITE_MEDIC', 'SITE_HSE', 'HO', 'ERP_TEAM', 'DEVELOPER'],
    '/user/hse-dashboard': ['SITE_HSE', 'HO', 'ERP_TEAM', 'DEVELOPER']
  };

  const redirectByRole = () => {
    if (!role) return '/user/login-page';
    if (role === 'SUPPLIER') return '/mobilization/portal';
    if (['SITE_MEDIC', 'SITE_HSE'].includes(role)) return '/user/medic-dashboard';
    return '/user/dashboard-view';
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
})();
