const roleAccess = {
  '/user/manage-users': ['HO', 'ERP_TEAM', 'DEVELOPER'],
  '/site/manage-sites': ['HO', 'ERP_TEAM', 'DEVELOPER', 'SITE_MANAGER'],
  '/supplier/manage-suppliers': ['HO', 'ERP_TEAM', 'DEVELOPER'],
  '/designation/manage-designations': ['HO', 'ERP_TEAM', 'DEVELOPER', 'SITE_MANAGER'],
  '/mobilization/portal': ['SUPPLIER', 'DEVELOPER'],
  '/user/medic-dashboard': ['SITE_MEDIC', 'HO', 'ERP_TEAM', 'DEVELOPER', 'SITE_HSE'],
  '/user/hse-dashboard': ['SITE_HSE', 'HO', 'ERP_TEAM', 'DEVELOPER']
};

const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(401).json({ message: 'Unauthorized: user role not found.' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        message: 'Access denied for this role.',
        requiredRoles: allowedRoles,
        yourRole: req.user.role
      });
    }

    next();
  };
};

const authorizeRoute = (req, res, next) => {
  if (!req.user || !req.user.role) {
    return res.status(401).json({ message: 'Unauthorized: user role not found.' });
  }

  const requestedPath = req.path || req.originalUrl || '';
  const allowedRoles = roleAccess[requestedPath] || roleAccess[req.baseUrl + req.path] || null;

  if (!allowedRoles) {
    return next();
  }

  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({
      message: 'You do not have access to this page.',
      requiredRoles: allowedRoles,
      yourRole: req.user.role
    });
  }

  next();
};

module.exports = { authorizeRoles, authorizeRoute, roleAccess };
