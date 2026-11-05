var DATA_CHANGE_PATH = 'changeLogs/tcoomm/days';
var DATA_EDIT_FIELDS = ['org','date','hour','minute','simpleMin','mdCategory','brand','productName','price','company','brandWeightedMin','dataProductName','salesQty','revenue'];

function saveCompetitorEdits(request) {
  var actor = requireAppAdmin_();
  if (request) request.saveStartedAt = Date.now();
  saveProgress_(actor, request, 'server-start');
  try {
    var result = saveCompetitorEditsInternal_(request);
    saveProgress_(actor, request, result.errors.length ? 'completed-with-errors' : 'completed', 'applied=' + result.applied);
    return result;
  } catch (error) { saveProgress_(actor, request, 'failed', error.message); throw error; }
}
function saveCompetitorEditsInternal_(request) {
  var actor = requireAppAdmin_();
  if (!request || !Array.isArray(request.changes) || !request.changes.length || request.changes.length > 5000) throw new Error('변경 대상은 1~5,000건이어야 합니다.');
  var groups = {};
  request.changes.forEach(function(change) {
    if (!change || !/^\d{4}(0[1-9]|1[0-2])$/.test(change.month) || ['SSG','K','SK'].indexOf(change.company) === -1 || !Number.isInteger(change.index) || change.index < 0 || typeof change.version !== 'string') throw new Error('변경 대상 식별 정보가 올바르지 않습니다.');
    if (!change.fields || !Object.keys(change.fields).length || Object.keys(change.fields).some(function(key) { return DATA_EDIT_FIELDS.indexOf(key) === -1; })) throw new Error('수정할 수 없는 필드가 포함되었습니다.');
    if (!groups[change.month]) groups[change.month] = [];
    groups[change.month].push(change);
  });
  saveProgress_(actor, request, 'lock-wait');
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) throw new Error('다른 변경 작업이 진행 중입니다. 잠시 후 다시 시도하세요.');
  var applied = 0, errors = [], warnings = [], committedMonths = [];
  try {
    Object.keys(groups).sort().forEach(function(month) {
      requireAppAdmin_();
      var changes = groups[month];
      var journalPath = '', committed = false;
      try {
        var url = DASHBOARD_CONFIG.databaseUrl + '/' + DASHBOARD_CONFIG.monthlyPath + '/' + month + '.json';
        saveProgress_(actor, request, 'token', month);
        var token = dashboardFirebaseToken_();
        saveProgress_(actor, request, 'source-read', month);
        var read = UrlFetchApp.fetch(url, { headers: { Authorization: 'Bearer ' + token, 'X-Firebase-ETag': 'true' }, muteHttpExceptions: true });
        if (read.getResponseCode() !== 200) throw new Error('원본 읽기 실패 HTTP ' + read.getResponseCode());
        var headers = read.getAllHeaders();
        var etagKey = Object.keys(headers).filter(function(key) { return key.toLowerCase() === 'etag'; })[0];
        var etag = headers[etagKey];
        if (!etag) throw new Error('원본 버전 잠금 정보를 받지 못했습니다.');
        var payload = JSON.parse(read.getContentText());
        if (!payload || !payload.data || changes.some(function(change) { return change.version !== payload.updatedAt; })) throw new Error('조회 후 원본이 변경되었습니다. 목록을 새로 불러온 뒤 수정하세요.');
        saveProgress_(actor, request, 'validate-rows', month);
        var details = [], seen = {};
        changes.forEach(function(change) {
          var identity = change.company + ':' + change.index;
          if (seen[identity]) throw new Error('변경 대상이 중복되었습니다.');
          seen[identity] = true;
          var row = (payload.data[change.company] || [])[change.index];
          if (!row) throw new Error('변경 대상 방송이 없습니다.');
          var before = {}, after = {};
          Object.keys(change.fields).forEach(function(key) {
            var value = change.fields[key];
            if (['hour','minute','simpleMin','price','brandWeightedMin','salesQty','revenue'].indexOf(key) !== -1) {
              if (['hour','minute'].indexOf(key) !== -1 && value === null) throw new Error('방송 시각은 비워둘 수 없습니다.');
              if (value !== null && (typeof value !== 'number' || !isFinite(value))) throw new Error('숫자 입력을 확인하세요: ' + key);
              if (value !== null && ['hour','minute','salesQty'].indexOf(key) !== -1 && !Number.isInteger(value)) throw new Error('정수로 입력하세요: ' + key);
              if (key === 'hour' && (value < 0 || value > 23) || key === 'minute' && (value < 0 || value > 59)) throw new Error('방송 시각 범위를 확인하세요.');
              if (['simpleMin','price','brandWeightedMin'].indexOf(key) !== -1 && value < 0) throw new Error('음수를 입력할 수 없습니다: ' + key);
            } else {
              if (typeof value !== 'string' || value.length > 2000) throw new Error('문자 입력을 확인하세요: ' + key);
              value = value.trim();
              if (key === 'brand' && !value) throw new Error('브랜드명은 비워둘 수 없습니다.');
              if (key === 'date' && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || isNaN(Date.parse(value)) || new Date(value).toISOString().slice(0,10) !== value || value.slice(0,7).replace('-','') !== month)) throw new Error('방송일은 원본과 같은 월의 유효한 날짜여야 합니다.');
            }
            if (JSON.stringify(row[key] == null ? null : row[key]) === JSON.stringify(value)) return;
            before[key] = row[key] == null ? null : row[key]; after[key] = value; row[key] = value;
          });
          if (Object.keys(after).length) {
            if ('hour' in after || 'minute' in after) row.time = ('0' + row.hour).slice(-2) + ':' + ('0' + row.minute).slice(-2);
            details.push({ company: change.company, index: change.index, date: row.date, before: before, after: after });
          }
        });
        if (!details.length) return;
        var previousVersion = payload.updatedAt;
        var now = new Date().toISOString();
        payload.updatedAt = now;
        var journal = { actor: actor, createdAt: now, month: month, kind: request.kind === 'brand' ? 'brand' : 'row', count: details.length, status: 'pending', changes: details };
        journalPath = DATA_CHANGE_PATH + '/' + Utilities.formatDate(new Date(now), DASHBOARD_CONFIG.timeZone, 'yyyy-MM-dd') + '/' + Utilities.getUuid();
        saveProgress_(actor, request, 'journal-write', month);
        editWrite_(journalPath, journal, 'put', token);
        saveProgress_(actor, request, 'source-write', month);
        var saved = UrlFetchApp.fetch(url, { method: 'put', contentType: 'application/json', payload: JSON.stringify(payload), headers: { Authorization: 'Bearer ' + token, 'If-Match': etag }, muteHttpExceptions: true });
        if (saved.getResponseCode() === 412) throw new Error('다른 작업이 원본을 갱신했습니다. 이번 변경은 적용하지 않았습니다.');
        if (saved.getResponseCode() !== 200) throw new Error('원본 저장 실패 HTTP ' + saved.getResponseCode());
        committed = true; applied += details.length;
        committedMonths.push({ month: month, previousVersion: previousVersion, updatedAt: now, changes: details });
        saveProgress_(actor, request, 'index-build', month);
        payload.month = month;
        var counts = countRowsBySheet_(payload.data);
        var updates = editSearchIndexUpdates_(payload, details, previousVersion, actor, request);
        updates['metadata/' + DASHBOARD_CONFIG.monthlyPath + '/' + month] = { month: month, updatedAt: now, counts: counts, rowCount: Object.keys(counts).reduce(function(sum, key) { return sum + counts[key]; }, 0), meta: 'broadcasts' };
        updates[journalPath + '/status'] = 'applied';
        saveProgress_(actor, request, 'index-sync', month);
        editWrite_('', updates, 'patch', token);
      } catch (error) {
        var status = committed ? 'sync_pending' : 'failed';
        if (journalPath) { try { editWrite_(journalPath, { status: status, message: error.message }, 'patch', dashboardFirebaseToken_()); } catch (ignored) {} }
        if (committed) warnings.push(month + ': 원본 저장 완료, 검색 인덱스 동기화 확인 필요');
        else errors.push(month + ': ' + error.message);
      }
    });
  } finally { lock.releaseLock(); }
  return { applied: applied, errors: errors, warnings: warnings, committedMonths: committedMonths };
}

function editWrite_(path, body, method, token) {
  var response = UrlFetchApp.fetch(DASHBOARD_CONFIG.databaseUrl + '/' + path + '.json?print=silent', { method: method, contentType: 'application/json', payload: JSON.stringify(body), headers: { Authorization: 'Bearer ' + token }, muteHttpExceptions: true });
  if ([200,204].indexOf(response.getResponseCode()) === -1) throw new Error('변경 기록/인덱스 저장 실패 HTTP ' + response.getResponseCode());
}

function getDataChangeLogs(query) {
  requireAppAdmin_();
  var start = accessLogDate_(query.start), end = accessLogDate_(query.end);
  var days = (Date.parse(end) - Date.parse(start)) / 86400000 + 1;
  if (days < 1 || days > 93) throw new Error('변경 로그 조회는 최대 93일입니다.');
  var url = DASHBOARD_CONFIG.databaseUrl + '/' + DATA_CHANGE_PATH + '.json?orderBy=' + encodeURIComponent('"$key"') + '&startAt=' + encodeURIComponent(JSON.stringify(start)) + '&endAt=' + encodeURIComponent(JSON.stringify(end));
  var response = UrlFetchApp.fetch(url, { headers: { Authorization: 'Bearer ' + dashboardFirebaseToken_() }, muteHttpExceptions: true });
  if (response.getResponseCode() !== 200) throw new Error('변경 로그 조회 실패 HTTP ' + response.getResponseCode());
  var data = JSON.parse(response.getContentText()) || {}, rows = [], email = String(query.email || '').trim().toLowerCase();
  Object.keys(data).forEach(function(date) { if (date < start || date > end) return; Object.keys(data[date] || {}).forEach(function(id) {
    var item = data[date][id];
    if (item && (!email || String(item.actor).toLowerCase().indexOf(email) !== -1)) rows.push(Object.assign({ id: date + '/' + id }, item));
  }); });
  rows.sort(function(a,b) { return String(b.createdAt).localeCompare(String(a.createdAt)); });
  var page = Number(query.page || 1), pages = Math.max(1, Math.ceil(rows.length / 25));
  if (!Number.isInteger(page) || page < 1 || page > 10000) throw new Error('페이지 번호가 올바르지 않습니다.');
  page = Math.min(page,pages);
  return { rows: rows.slice((page-1)*25,page*25), total: rows.length, page: page, pages: pages };
}
