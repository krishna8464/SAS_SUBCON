const mongoose = require('mongoose');
const User = require('./models/user');

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URL || process.env.Mongo_url || 'mongodb://127.0.0.1:27017/sas_subcon');

    const email = 'rolecheck@example.com';
    await User.deleteOne({ email });

    const created = await User.create({
      name: 'RoleCheck',
      email,
      password: 'Test1234!',
      role: 'HO',
      cell_number: '1234567890',
      status: 'Active'
    });

    const loginRes = await fetch('http://localhost:9002/user/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'Test1234!' })
    });

    const loginData = await loginRes.json();
    console.log('LOGIN_STATUS', loginRes.status);
    console.log('LOGIN_MESSAGE', loginData.message);
    console.log('TOKEN_PRESENT', Boolean(loginData.token));

    const dashRes = await fetch('http://localhost:9002/user/dashboard-view', {
      headers: {
        Authorization: `Bearer ${loginData.token}`
      }
    });

    const dashBody = await dashRes.text();
    console.log('DASHBOARD_STATUS', dashRes.status);
    console.log('DASHBOARD_LOCATION', dashRes.headers.get('location'));
    console.log('DASHBOARD_SNIPPET', dashBody.slice(0, 180));

    const siteRes = await fetch('http://localhost:9002/site/manage-sites', {
      headers: {
        Authorization: `Bearer ${loginData.token}`
      }
    });

    const siteText = await siteRes.text();
    console.log('SITE_STATUS', siteRes.status);
    console.log('SITE_SNIPPET', siteText.slice(0, 180));

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('VERIFY_ERROR', error);
    process.exit(1);
  }
})();
