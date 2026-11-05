// 읽기 전용. 임의 RTDB 경로를 받는 공개 함수는 제공하지 않습니다.
function readDashboardFirebase_(relativePath, shallow) {
  var url = DASHBOARD_CONFIG.databaseUrl + '/' + relativePath + '.json' + (shallow ? '?shallow=true' : '');
  var response = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: { Authorization: 'Bearer ' + dashboardFirebaseToken_() },
    muteHttpExceptions: true
  });
  var status = response.getResponseCode();
  if (status !== 200) {
    var usesServiceAccount = !!dashboardProperties_().getProperty('FIREBASE_SERVICE_ACCOUNT_JSON');
    var mode = usesServiceAccount ? '서비스 계정' : 'GAS 사용자 OAuth (서비스 계정 속성 없음)';
    var detail = dashboardFirebaseError_(response.getContentText());
    var next = usesServiceAccount
      ? '등록한 서비스 계정의 Firebase 프로젝트 및 RTDB IAM 권한을 확인하세요.'
      : '이 GAS 프로젝트의 스크립트 속성에 FIREBASE_SERVICE_ACCOUNT_JSON을 추가하고, 값에 키 파일의 내용 전체를 넣으세요. 파일명이나 경로를 넣으면 안 됩니다.';
    throw new Error('RTDB 조회 실패 (HTTP ' + status + '). 인증 방식: ' + mode + '. Firebase 응답: ' + detail + '. ' + next);
  }
  try { return JSON.parse(response.getContentText()); }
  catch (error) { throw new Error('RTDB 응답이 올바른 JSON 형식이 아닙니다.'); }
}

function dashboardFirebaseToken_() {
  var json = dashboardProperties_().getProperty('FIREBASE_SERVICE_ACCOUNT_JSON');
  if (!json) return ScriptApp.getOAuthToken();
  // 선택 사항: 다른 프로젝트 서비스 계정으로 접근할 때 서버에서만 JWT 서명합니다.
  var account;
  try { account = JSON.parse(json); }
  catch (error) { throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON 설정이 올바르지 않습니다.'); }
  if (!account.client_email || !account.private_key) throw new Error('서비스 계정 이메일 또는 비밀키가 없습니다.');
  var cache = CacheService.getScriptCache();
  var key = 'firebase-access:' + account.client_email + ':' + (account.private_key_id || 'default');
  var cached = cache.get(key);
  if (cached) return cached;
  var now = Math.floor(Date.now() / 1000);
  var header = dashboardBase64Url_(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  var claims = dashboardBase64Url_(JSON.stringify({
    iss: account.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.database https://www.googleapis.com/auth/userinfo.email',
    aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600
  }));
  var unsigned = header + '.' + claims;
  var signature = Utilities.computeRsaSha256Signature(unsigned, account.private_key);
  var assertion = unsigned + '.' + Utilities.base64EncodeWebSafe(signature).replace(/=+$/, '');
  var response = UrlFetchApp.fetch('https://oauth2.googleapis.com/token', {
    method: 'post',
    payload: { grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: assertion },
    muteHttpExceptions: true
  });
  if (response.getResponseCode() !== 200) throw new Error('서비스 계정 토큰 발급 실패 (HTTP ' + response.getResponseCode() + '). ' + dashboardFirebaseError_(response.getContentText()));
  var token = JSON.parse(response.getContentText());
  if (!token.access_token) throw new Error('Firebase 인증 토큰을 받지 못했습니다.');
  cache.put(key, token.access_token, Math.max(1, Math.min(3300, Number(token.expires_in || 3600) - 60)));
  return token.access_token;
}

function dashboardBase64Url_(value) {
  return Utilities.base64EncodeWebSafe(value, Utilities.Charset.UTF_8).replace(/=+$/, '');
}

function dashboardFirebaseError_(body) {
  // 응답 원문에는 자격 증명이 섞일 가능성을 배제하기 위해 알려진 사유만 표시.
  var message = '';
  try {
    var parsed = JSON.parse(body);
    message = String(parsed.error_description || (parsed.error && parsed.error.message) || parsed.error || '');
  } catch (error) { return 'JSON 오류 응답이 아님'; }
  if (/permission.denied/i.test(message)) return 'Permission denied';
  if (/expired/i.test(message)) return '인증 토큰 또는 인증 정보 만료';
  if (/signature/i.test(message)) return '서명 검증 실패';
  if (/invalid.grant/i.test(message)) return 'invalid_grant';
  if (/invalid.client/i.test(message)) return 'invalid_client';
  if (/invalid.*token|token.*invalid/i.test(message)) return '유효하지 않은 인증 토큰';
  if (/unauthorized/i.test(message)) return 'Unauthorized';
  if (/disabled/i.test(message)) return '계정 또는 API 비활성화';
  return message ? '인증 서버의 요청 거부' : '상세 사유 없음';
}
