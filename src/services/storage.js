// iframe 브라우저 정책으로 저장이 차단되어도 조회 화면은 계속 동작합니다.
export const safeStorage = {
  getItem(key) { try { return localStorage.getItem(key) } catch { return null } },
  setItem(key, value) { try { localStorage.setItem(key, value) } catch { /* 선택 상태만 저장하지 않음 */ } },
  removeItem(key) { try { localStorage.removeItem(key) } catch { /* 선택 상태만 저장하지 않음 */ } },
}
