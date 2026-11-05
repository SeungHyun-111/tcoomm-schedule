// 진행 상태는 짧게 서버 캐시에 보관하며 요청한 관리자만 조회할 수 있습니다.
function saveProgressKey_(actor, id) { return 'edit-progress:' + actor + ':' + id; }
function saveProgress_(actor, request, stage, extra) {
  if (!request || !/^[a-zA-Z0-9_-]{8,80}$/.test(request.traceId || '')) return;
  var state = { id: request.traceId, stage: stage, at: Date.now(), elapsedMs: Date.now() - request.saveStartedAt, detail: extra || '' };
  console.info('[MSM SAVE] ' + JSON.stringify(state));
  try { CacheService.getScriptCache().put(saveProgressKey_(actor, request.traceId), JSON.stringify(state), 600); } catch (ignored) {}
}
function getEditProgress(id) {
  var actor = requireAppAdmin_();
  if (!/^[a-zA-Z0-9_-]{8,80}$/.test(id || '')) throw new Error('잘못된 작업 번호입니다.');
  var raw = CacheService.getScriptCache().get(saveProgressKey_(actor, id));
  return raw ? JSON.parse(raw) : { stage: 'waiting', detail: '서버 실행 시작 전이거나 진행 상태를 확인할 수 없습니다.' };
}
