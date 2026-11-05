function getDashboardBootstrap() {
  var email = requireDashboardUser_();
  var months = readDashboardFirebase_(DASHBOARD_CONFIG.monthlyPath, true) || {};
  var competitorWeek = readDashboardFirebase_(competitorPreferencePath_(email), false);
  var access = appUserAccess_(email);
  return {
    email: email,
    canManageAccess: isAppAdmin_(email),
    role: access.role,
    canViewRevenue: access.canViewRevenue,
    dataAccessKey: access.dataAccessKey,
    canRefresh: canRefreshCompetitor_(email),
    competitorWeek: typeof competitorWeek === 'string' ? competitorWeek : '',
    currentMonth: Utilities.formatDate(new Date(), DASHBOARD_CONFIG.timeZone, 'yyyyMM'),
    months: Object.keys(months).filter(function(month) { return /^\d{4}(0[1-9]|1[0-2])$/.test(month); }).sort()
  };
}

function getDashboardData(month, knownVersions, clientScope) {
  var email = requireDashboardUser_();
  var access = appUserAccess_(email);
  if (typeof month !== 'string' || !/^\d{4}(0[1-9]|1[0-2])$/.test(month)) throw new Error('조회 월은 YYYYMM 형식이어야 합니다.');
  var year = Number(month.slice(0, 4));
  var number = Number(month.slice(4));
  var previousMonth = number === 1 ? String(year - 1) + '12' : String(year) + ('0' + (number - 1)).slice(-2);
  knownVersions = knownVersions && typeof knownVersions === 'object' ? knownVersions : {};
  var batch = dashboardReadMonths_([month, previousMonth], knownVersions, access, clientScope);
  var current = batch[month];
  if (!current) throw new Error(month + ' 경쟁사 데이터가 없습니다. 다른 월을 선택하세요.');
  var previous = batch[previousMonth];
  return { email: email, month: month, current: current, previous: previous, canViewRevenue: access.canViewRevenue, dataAccessKey: access.dataAccessKey };
}

function dashboardReadMonth_(month, knownVersion, access, clientScope) {
  var known = {}; known[month] = knownVersion;
  return dashboardReadMonths_([month], known, access, clientScope)[month];
}

// 캐시가 없는 월은 원본을 바로 읽고, 월별 통신은 병렬 실행합니다.
function dashboardReadMonths_(months, knownVersions, access, clientScope) {
  var reusable = clientScope === access.dataAccessKey;
  var plans = months.map(function(month) {
    return { month: month, check: reusable && typeof knownVersions[month] === 'string' && !!knownVersions[month] };
  });
  var first = dashboardFetchPaths_(plans.map(function(plan) {
    return DASHBOARD_CONFIG.monthlyPath + '/' + plan.month + (plan.check ? '/updatedAt' : '');
  }));
  var result = {}, changed = [];
  plans.forEach(function(plan, index) {
    var value = first[index];
    if (plan.check && typeof value === 'string' && value && value === knownVersions[plan.month]) {
      result[plan.month] = { unchanged: true, updatedAt: value };
    } else if (plan.check) changed.push(plan.month);
    else result[plan.month] = value && value.data ? revenueSafePayload_(dashboardPayload_(value), access) : null;
  });
  if (changed.length) {
    var raw = dashboardFetchPaths_(changed.map(function(month) { return DASHBOARD_CONFIG.monthlyPath + '/' + month; }));
    changed.forEach(function(month, index) {
      result[month] = raw[index] && raw[index].data ? revenueSafePayload_(dashboardPayload_(raw[index]), access) : null;
    });
  }
  return result;
}

function dashboardFetchPaths_(paths) {
  var token = dashboardFirebaseToken_();
  return UrlFetchApp.fetchAll(paths.map(function(path) {
    return { url: DASHBOARD_CONFIG.databaseUrl + '/' + path + '.json', method: 'get', headers: { Authorization: 'Bearer ' + token }, muteHttpExceptions: true };
  })).map(function(response) {
    var status = response.getResponseCode();
    if (status !== 200) {
      var service = !!dashboardProperties_().getProperty('FIREBASE_SERVICE_ACCOUNT_JSON');
      throw new Error('RTDB 조회 실패 (HTTP ' + status + '). 인증 방식: ' + (service ? '서비스 계정' : 'GAS 사용자 OAuth (서비스 계정 속성 없음)') + '. ' + dashboardFirebaseError_(response.getContentText()) + '. ' +
        (service ? '서비스 계정의 Firebase 프로젝트 및 권한을 확인하세요.' : 'FIREBASE_SERVICE_ACCOUNT_JSON에 키 파일 내용 전체를 등록하세요.'));
    }
    try { return JSON.parse(response.getContentText()); }
    catch (error) { throw new Error('RTDB 응답이 올바른 JSON 형식이 아닙니다.'); }
  });
}

function dashboardPayload_(payload) {
  var data = {};
  ['SSG', 'K', 'SK'].forEach(function(company) {
    if (payload.data[company] != null && !Array.isArray(payload.data[company])) throw new Error(company + ' 데이터 형식이 배열이 아닙니다.');
    data[company] = payload.data[company] || [];
  });
  return { updatedAt: payload.updatedAt || null, data: data };
}
