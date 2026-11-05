function doGet() {
  var email;
  try { email = requireDashboardUser_(); }
  catch (error) {
    var rejected = '';
    try { rejected = Session.getActiveUser().getEmail() || ''; } catch (ignored) {}
    recordAccessVisit_(rejected, 'denied');
    throw error;
  }
  return HtmlService.createTemplateFromFile('Index').evaluate()
    .setTitle('MSM 경쟁사 대시보드')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function include_(name) {
  if (['Styles', 'Styles2', 'Styles3', 'Styles4', 'Styles5', 'Diagnostics', 'Scripts', 'Scripts2', 'Scripts3', 'Scripts4', 'Scripts5'].indexOf(name) === -1) throw new Error('허용되지 않은 파일입니다.');
  return HtmlService.createHtmlOutputFromFile(name).getContent();
}

// 메뉴 자산은 최초 사용 시에만 반환합니다. 관리자 화면은 서버에서도 검사합니다.
function getDashboardScreenAssets(screen) {
  var email = requireDashboardUser_();
  var files = { weekly: ['Styles2', 'Scripts2'], access: ['Styles3', 'Scripts3'], logs: ['Styles4', 'Scripts4'], list: ['Styles5', 'Scripts5'] };
  if (!Object.prototype.hasOwnProperty.call(files, screen)) throw new Error('지원하지 않는 화면입니다.');
  if (screen === 'access' || screen === 'logs') requireAppAdmin_();
  return { css: include_(files[screen][0]), script: include_(files[screen][1]) };
}
function recordDashboardVisit() {
  recordAccessVisit_(requireDashboardUser_(), 'allowed');
  return true;
}
