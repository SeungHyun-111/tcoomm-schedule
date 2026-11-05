function competitorPreferencePath_(email) {
  var key = function(value) { return Array.from(value).map(function(character) { return character.codePointAt(0).toString(16); }).join('-'); };
  return 'userPreferences/' + key(email) + '/competitorSchedule/' + key('weekly') + '/lastViewedDate';
}

function saveCompetitorWeek(week) {
  var email = requireDashboardUser_();
  if (typeof week !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(week) || isNaN(Date.parse(week)) || new Date(week).toISOString().slice(0, 10) !== week) throw new Error('조회 주차 형식이 올바르지 않습니다.');
  var response = UrlFetchApp.fetch(DASHBOARD_CONFIG.databaseUrl + '/' + competitorPreferencePath_(email) + '.json', {
    method: 'put', contentType: 'application/json', payload: JSON.stringify(week),
    headers: { Authorization: 'Bearer ' + dashboardFirebaseToken_() }, muteHttpExceptions: true
  });
  if (response.getResponseCode() !== 200) throw new Error('조회 주차 저장 실패 (HTTP ' + response.getResponseCode() + ').');
  return { week: week };
}
