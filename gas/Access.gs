// 이 앱의 관리 권한만 관리합니다. Google Workspace 조직 권한은 변경하지 않습니다.
var APP_ACCESS = Object.freeze({
  rootEmail: 'l.sh@skstoa.com',
  propertyPrefix: 'TCOOMM_APP_ADMIN_',
  adminsPath: 'appAccess/tcoomm/admins',
  auditPath: 'appAccess/tcoomm/adminChanges'
});

function appAccessEmailKey_(email) {
  return Array.from(email).map(function(character) { return character.codePointAt(0).toString(16); }).join('-');
}

function isAppAdmin_(email) {
  if (email === APP_ACCESS.rootEmail) return true;
  var raw = dashboardProperties_().getProperty(APP_ACCESS.propertyPrefix + appAccessEmailKey_(email));
  var record = null;
  try { record = raw ? JSON.parse(raw) : null; } catch (error) { return false; }
  return !!record && record.email === email && record.role === 'admin';
}

function requireAppAdmin_() {
  var email = requireDashboardUser_();
  // 관리 작업은 브라우저 캐시를 사용하지 않고 서버에서 매번 재검사합니다.
  if (!isAppAdmin_(email)) throw new Error('관리자만 권한 관리 페이지를 사용하거나 관리 권한을 변경할 수 있습니다.');
  return email;
}

function appAccessTargetEmail_(value) {
  var email = String(value || '').trim().toLowerCase();
  var domain = String(dashboardProperties_().getProperty('ALLOWED_DOMAIN') || DASHBOARD_CONFIG.defaultDomain).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.split('@')[1] !== domain) throw new Error('회사 이메일 주소를 입력하세요.');
  return email;
}

function getAccessManagement() {
  var actor = requireAppAdmin_();
  // 권한의 기준은 GAS 서버 속성입니다. RTDB 명부를 직접 바꿔도 관리 권한은 생기지 않습니다.
  var properties = dashboardProperties_().getProperties();
  var admins = Object.keys(properties).filter(function(key) { return key.indexOf(APP_ACCESS.propertyPrefix) === 0; }).map(function(key) {
    try { return JSON.parse(properties[key]); } catch (error) { return null; }
  }).filter(function(record) {
    return record && ['admin', 'revenue'].indexOf(record.role) !== -1 && typeof record.email === 'string' && record.email !== APP_ACCESS.rootEmail;
  }).map(function(record) {
    return { email: record.email, role: record.role, viewer: true, initialAdmin: false, updatedAt: record.updatedAt || '', updatedBy: record.updatedBy || '' };
  });
  admins.sort(function(a, b) { return a.email.localeCompare(b.email); });
  admins.unshift({ email: APP_ACCESS.rootEmail, role: 'admin', viewer: true, initialAdmin: true, updatedAt: '', updatedBy: '' });
  return { email: actor, admins: admins, defaultViewer: true };
}

function grantAppAdmin(value) {
  var actor = requireAppAdmin_();
  var email = appAccessTargetEmail_(value);
  if (email === APP_ACCESS.rootEmail) return { email: email, initialAdmin: true };
  var now = new Date().toISOString();
  var record = { email: email, role: 'admin', updatedAt: now, updatedBy: actor };
  appAccessWrite_(actor, email, record, 'grant', now);
  return { email: email, updatedAt: now, updatedBy: actor };
}

function revokeAppAdmin(value) {
  var actor = requireAppAdmin_();
  var email = appAccessTargetEmail_(value);
  if (email === APP_ACCESS.rootEmail) throw new Error('초기 관리자의 권한은 회수할 수 없습니다.');
  if (email === actor) throw new Error('자신의 관리 권한은 다른 관리자에게 회수를 요청하세요.');
  appAccessWrite_(actor, email, null, 'revoke', new Date().toISOString());
  return { email: email };
}

function appAccessWrite_(actor, email, record, action, now) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) throw new Error('다른 관리자가 권한을 변경 중입니다. 잠시 후 다시 시도하세요.');
  try {
  if (requireAppAdmin_() !== actor) throw new Error('로그인 계정이 변경되었습니다.');
  var updates = {};
  updates[APP_ACCESS.adminsPath + '/' + appAccessEmailKey_(email)] = record;
  updates[APP_ACCESS.auditPath + '/' + Utilities.getUuid()] = { actor: actor, target: email, action: action, createdAt: now };
  var response = UrlFetchApp.fetch(DASHBOARD_CONFIG.databaseUrl + '/.json?print=silent', {
    method: 'patch', contentType: 'application/json', payload: JSON.stringify(updates),
    headers: { Authorization: 'Bearer ' + dashboardFirebaseToken_() }, muteHttpExceptions: true
  });
  if (response.getResponseCode() !== 200 && response.getResponseCode() !== 204) {
    throw new Error('권한 저장 실패 (HTTP ' + response.getResponseCode() + '). ' + dashboardFirebaseError_(response.getContentText()));
  }
  var key = APP_ACCESS.propertyPrefix + appAccessEmailKey_(email);
  if (record) dashboardProperties_().setProperty(key, JSON.stringify(record));
  else dashboardProperties_().deleteProperty(key);
  } finally { lock.releaseLock(); }
}
