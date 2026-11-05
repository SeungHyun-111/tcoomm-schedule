var ACCESS_LOG_PATH = 'accessLogs/tcoomm/days';

// 웹앱 최초 요청/새로고침에서만 호출. 조회 API와 메뉴 이동에는 기록하지 않습니다.
function recordAccessVisit_(email, result) {
  try {
    var now = new Date();
    var date = Utilities.formatDate(now, DASHBOARD_CONFIG.timeZone, 'yyyy-MM-dd');
    var response = UrlFetchApp.fetch(DASHBOARD_CONFIG.databaseUrl + '/' + ACCESS_LOG_PATH + '/' + date + '/' + Utilities.getUuid() + '.json', {
      method: 'put', contentType: 'application/json',
      payload: JSON.stringify({ email: String(email || '').trim().toLowerCase(), accessedAt: now.toISOString(), result: result }),
      headers: { Authorization: 'Bearer ' + dashboardFirebaseToken_() }, muteHttpExceptions: true
    });
    if (response.getResponseCode() !== 200) console.warn('[ACCESS LOG] 저장 실패 HTTP ' + response.getResponseCode());
  } catch (error) { console.warn('[ACCESS LOG] 저장 실패. GAS 실행 기록 및 Firebase 서버 인증 설정을 확인하세요.'); }
}

function getAccessLogReport(query) {
  requireAppAdmin_();
  query = query || {};
  var start = accessLogDate_(query.start);
  var end = accessLogDate_(query.end);
  var days = Math.round((Date.parse(end) - Date.parse(start)) / 86400000) + 1;
  if (days < 1 || days > 93) throw new Error('조회 기간은 시작일 이후 최대 93일로 지정하세요.');
  var email = String(query.email || '').trim().toLowerCase();
  if (email.length > 128) throw new Error('이메일 검색어가 너무 깁니다.');
  var result = query.result || 'all';
  if (['all', 'allowed', 'denied'].indexOf(result) === -1) throw new Error('접속 결과 필터가 올바르지 않습니다.');
  var page = Number(query.page || 1);
  if (!Number.isInteger(page) || page < 1 || page > 10000) throw new Error('페이지 번호가 올바르지 않습니다.');
  var url = DASHBOARD_CONFIG.databaseUrl + '/' + ACCESS_LOG_PATH + '.json?orderBy=' + encodeURIComponent('"$key"') + '&startAt=' + encodeURIComponent(JSON.stringify(start)) + '&endAt=' + encodeURIComponent(JSON.stringify(end));
  var response = UrlFetchApp.fetch(url, { method: 'get', headers: { Authorization: 'Bearer ' + dashboardFirebaseToken_() }, muteHttpExceptions: true });
  if (response.getResponseCode() !== 200) throw new Error('접속 로그 조회 실패 (HTTP ' + response.getResponseCode() + '). ' + dashboardFirebaseError_(response.getContentText()));
  var data = JSON.parse(response.getContentText()) || {};
  var rows = [];
  var scanned = 0;
  Object.keys(data).forEach(function(date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date || date < start || date > end) return;
    Object.keys(data[date] || {}).forEach(function(id) {
      scanned++;
      if (scanned > 20000) throw new Error('로그가 20,000건을 초과합니다. 조회 기간을 줄여주세요.');
      var record = data[date][id];
      if (!record || typeof record.accessedAt !== 'string' || isNaN(Date.parse(record.accessedAt)) || ['allowed', 'denied'].indexOf(record.result) === -1) return;
      var user = String(record.email || '').toLowerCase();
      if (email && user.indexOf(email) === -1) return;
      if (result !== 'all' && record.result !== result) return;
      rows.push({ id: date + '/' + id, date: date, email: user, accessedAt: record.accessedAt, result: record.result });
    });
  });
  rows.sort(function(a, b) { return b.accessedAt.localeCompare(a.accessedAt) || b.id.localeCompare(a.id); });
  var daily = Object.create(null);
  for (var i = 0; i < days; i++) {
    var date = new Date(Date.parse(start) + i * 86400000).toISOString().slice(0, 10);
    daily[date] = { date: date, total: 0, allowed: 0, denied: 0 };
  }
  var users = Object.create(null);
  var allowed = 0, denied = 0;
  rows.forEach(function(row) {
    daily[row.date].total++;
    daily[row.date][row.result]++;
    if (row.result === 'allowed') allowed++; else denied++;
    if (!row.email) return;
    if (!users[row.email]) users[row.email] = { email: row.email, total: 0, allowed: 0, denied: 0, lastAccessedAt: row.accessedAt };
    users[row.email].total++;
    users[row.email][row.result]++;
  });
  var byUser = Object.keys(users).map(function(email) { return users[email]; }).sort(function(a, b) { return b.total - a.total || a.email.localeCompare(b.email); });
  var pageSize = 50;
  var pages = Math.max(1, Math.ceil(rows.length / pageSize));
  page = Math.min(page, pages);
  return {
    range: { start: start, end: end, email: email, result: result },
    stats: { total: rows.length, uniqueUsers: byUser.length, allowed: allowed, denied: denied, dailyAverage: Math.round(rows.length / days * 10) / 10 },
    daily: Object.keys(daily).sort().map(function(date) { return daily[date]; }), users: byUser,
    rows: rows.slice((page - 1) * pageSize, page * pageSize), page: page, pages: pages, pageSize: pageSize
  };
}

function accessLogDate_(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || isNaN(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) throw new Error('조회 날짜를 YYYY-MM-DD 형식으로 입력하세요.');
  return value;
}
