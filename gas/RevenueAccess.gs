// 권한은 서버 속성을 기준으로 판정하며, 관리자는 매출 조회 권한을 포함합니다.
function appUserAccess_(email) {
  if (email === APP_ACCESS.rootEmail) return { role: 'admin', canViewRevenue: true, dataAccessKey: 'admin:root-v2' };
  var record = null;
  try { record = JSON.parse(dashboardProperties_().getProperty(APP_ACCESS.propertyPrefix + appAccessEmailKey_(email)) || 'null'); } catch (error) {}
  var role = record && record.email === email && ['admin', 'revenue'].indexOf(record.role) !== -1 ? record.role : 'viewer';
  return { role: role, canViewRevenue: role !== 'viewer', dataAccessKey: role + ':' + (role === 'viewer' ? 'v2' : record.updatedAt || 'legacy-v2') };
}

function setAppRole(value, role) {
  var actor = requireAppAdmin_();
  var email = appAccessTargetEmail_(value);
  if (['viewer', 'revenue', 'admin'].indexOf(role) === -1) throw new Error('권한 값이 올바르지 않습니다.');
  if (email === APP_ACCESS.rootEmail) {
    if (role !== 'admin') throw new Error('초기 관리자의 권한은 변경할 수 없습니다.');
    return { email: email, role: 'admin' };
  }
  if (email === actor && role !== 'admin') throw new Error('자신의 관리자 권한은 다른 관리자에게 변경을 요청하세요.');
  var now = new Date().toISOString();
  var record = role === 'viewer' ? null : { email: email, role: role, updatedAt: now, updatedBy: actor };
  appAccessWrite_(actor, email, record, role === 'viewer' ? 'revoke' : 'grant-' + role, now);
  return { email: email, role: role };
}

function revenueSafePayload_(payload, access) {
  if (access.canViewRevenue) return payload;
  var allowed = ['month','week','weightedMin','org','date','hour','minute','time','originalHour','originalTime','simpleMin','mdCategory','brand','productName','price','company','brandWeightedMin','dataProductName','salesQty','errorCode','channel'];
  var data = {};
  ['SSG', 'K', 'SK'].forEach(function(company) {
    data[company] = (payload.data[company] || []).map(function(row) {
      var safe = {};
      allowed.forEach(function(key) { if (Object.prototype.hasOwnProperty.call(row, key)) safe[key] = row[key]; });
      return safe;
    });
  });
  return { updatedAt: payload.updatedAt, data: data };
}
