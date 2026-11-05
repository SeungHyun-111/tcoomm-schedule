// 월간 분석과 같은 RTDB 원본을 사용합니다. 모든 공개 API에서 사용자 확인.
function getCompetitorMonths(months, knownVersions, clientScope) {
  var email = requireDashboardUser_();
  var access = appUserAccess_(email);
  if (!Array.isArray(months) || months.length < 1 || months.length > 3) throw new Error('한 번에 최대 3개월만 조회할 수 있습니다.');
  months.forEach(function(month) {
    if (typeof month !== 'string' || !/^\d{4}(0[1-9]|1[0-2])$/.test(month)) throw new Error('조회 월 형식이 올바르지 않습니다.');
  });
  knownVersions = knownVersions && typeof knownVersions === 'object' ? knownVersions : {};
  var unique = months.filter(function(month, index) { return months.indexOf(month) === index; });
  var result = dashboardReadMonths_(unique, knownVersions, access, clientScope);
  return { email: email, months: result, canViewRevenue: access.canViewRevenue, dataAccessKey: access.dataAccessKey };
}

function canRefreshCompetitor_(email) {
  if (!isAppAdmin_(email)) return false;
  var properties = dashboardProperties_();
  var owner = String(Session.getEffectiveUser().getEmail() || '').toLowerCase();
  var admins = String(properties.getProperty('COMPETITOR_ADMIN_EMAILS') || owner).toLowerCase()
    .split(',').map(function(value) { return value.trim(); }).filter(Boolean);
  return admins.indexOf(email) !== -1 && !!properties.getProperty('COMPETITOR_SOURCE_SPREADSHEET_ID');
}

function refreshCompetitorData(month) {
  var email = requireDashboardUser_();
  if (!canRefreshCompetitor_(email)) throw new Error('원본 갱신 권한 또는 원본 시트 설정이 없습니다.');
  if (typeof month !== 'string' || !/^\d{4}(0[1-9]|1[0-2])$/.test(month)) throw new Error('갱신 월 형식이 올바르지 않습니다.');
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) throw new Error('다른 사용자가 갱신 중입니다. 잠시 후 다시 시도하세요.');
  try {
    var payload = buildMonthlyPayload_(month);
    if (!['SSG', 'K', 'SK'].every(function(company) { return Array.isArray(payload.data[company]); })) throw new Error('원본에 SSG/K/SK 시트가 모두 있어야 합니다.');
    var counts = countRowsBySheet_(payload.data);
    if (!Object.keys(counts).some(function(company) { return counts[company] > 0; })) throw new Error('선택 월의 원본이 비어 있어 기존 데이터를 교체하지 않았습니다.');
    payload.updatedAt = new Date().toISOString();
    var updates = {};
    updates[DASHBOARD_CONFIG.monthlyPath + '/' + month] = payload;
    updates['competitorInfo/searchIndex/' + month] = buildCompetitorSearchIndex_(payload);
    updates['metadata/' + DASHBOARD_CONFIG.monthlyPath + '/' + month] = {
      month: month, updatedAt: payload.updatedAt, counts: counts,
      rowCount: Object.keys(counts).reduce(function(sum, company) { return sum + counts[company]; }, 0), meta: 'broadcasts'
    };
    var response = UrlFetchApp.fetch(DASHBOARD_CONFIG.databaseUrl + '/.json?print=silent', {
      method: 'patch', contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + dashboardFirebaseToken_() },
      payload: JSON.stringify(updates), muteHttpExceptions: true
    });
    if (response.getResponseCode() !== 200 && response.getResponseCode() !== 204) {
      throw new Error('RTDB 갱신 실패 (HTTP ' + response.getResponseCode() + '). ' + dashboardFirebaseError_(response.getContentText()));
    }
    return counts;
  } finally { lock.releaseLock(); }
}
