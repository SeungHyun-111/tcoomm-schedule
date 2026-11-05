// 경로는 기존 MSM/PGMDR과 동일합니다. 브라우저에는 서버 인증 정보를 보내지 않습니다.
var DASHBOARD_CONFIG = Object.freeze({
  databaseUrl: 'https://schedule-7ec7a-default-rtdb.asia-southeast1.firebasedatabase.app',
  monthlyPath: 'competitorInfo/monthly',
  defaultDomain: 'skstoa.com',
  timeZone: 'Asia/Seoul'
});

function dashboardProperties_() {
  return PropertiesService.getScriptProperties();
}
