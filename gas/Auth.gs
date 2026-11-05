function requireDashboardUser_() {
  var email = String(Session.getActiveUser().getEmail() || '').trim().toLowerCase();
  var properties = dashboardProperties_();
  var domain = String(properties.getProperty('ALLOWED_DOMAIN') || DASHBOARD_CONFIG.defaultDomain).trim().toLowerCase();
  if (!email || email.split('@').length !== 2 || email.split('@')[1] !== domain) {
    throw new Error('회사 계정으로 접속해야 합니다. 사용자 이메일을 확인하지 못하면 접근이 차단됩니다.');
  }
  var allowed = String(properties.getProperty('ALLOWED_EMAILS') || '').toLowerCase()
    .split(',').map(function(value) { return value.trim(); }).filter(Boolean);
  if (allowed.length && allowed.indexOf(email) === -1) throw new Error('대시보드 조회 권한이 없습니다.');
  return email;
}
