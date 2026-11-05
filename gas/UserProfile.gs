// 실행 계정 자신의 이름을 쓰지 않고, 접속 이메일과 정확히 일치하는 조직 프로필만 반환합니다.
function getDashboardIdentity() {
  var email = requireDashboardUser_();
  var cache = CacheService.getScriptCache(), key = 'directory-name:' + email;
  var cached = cache.get(key);
  if (cached !== null) return { email: email, displayName: cached };
  try {
    var url = 'https://people.googleapis.com/v1/people:searchDirectoryPeople?query=' + encodeURIComponent(email) + '&readMask=names,emailAddresses&sources=DIRECTORY_SOURCE_TYPE_DOMAIN_PROFILE&pageSize=100';
    var response = UrlFetchApp.fetch(url, { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true });
    if (response.getResponseCode() !== 200) { console.warn('[MSM PROFILE] directory HTTP ' + response.getResponseCode()); return { email: email, displayName: '' }; }
    var people = JSON.parse(response.getContentText()).people || [];
    var profile = people.filter(function(person) { return (person.emailAddresses || []).some(function(item) { return String(item.value || '').toLowerCase() === email; }); })[0];
    var name = profile && profile.names && profile.names[0] && profile.names[0].displayName || '';
    cache.put(key, name, name ? 21600 : 300);
    return { email: email, displayName: name };
  } catch (error) { console.warn('[MSM PROFILE] directory unavailable'); return { email: email, displayName: '' }; }
}
