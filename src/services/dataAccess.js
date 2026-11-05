export function configureDataAccess(session) {
  const previous = globalThis.__MSM_DATA_ACCESS__
  if (previous && (previous.email !== session.email || previous.key !== (session.dataAccessKey || 'viewer:v2'))) {
    const shared = globalThis.__MSM_MONTH_CACHE__
    shared?.memory.clear(); shared?.checked.clear(); shared?.missing.clear(); shared?.storedKeys?.clear()
  }
  globalThis.__MSM_DATA_ACCESS__ = { email: session.email, key: session.dataAccessKey || 'viewer:v2', canViewRevenue: session.canViewRevenue === true }
  const shared = globalThis.__MSM_MONTH_CACHE__
  if (previous && previous.key !== dataAccessKey() && shared?.databasePromise) {
    const email = session.email, scope = dataAccessKey()
    shared.persistence = (shared.persistence || Promise.resolve()).then(async () => {
      const db = await shared.databasePromise
      if (!db) return
      await new Promise(resolve => {
        try {
          const tx = db.transaction('months','readwrite')
          const request = tx.objectStore('months').index('user').openKeyCursor(email)
          request.onsuccess = () => { const cursor = request.result; if (cursor) { if (!String(cursor.primaryKey).startsWith(`${email}|${scope}|`)) tx.objectStore('months').delete(cursor.primaryKey); cursor.continue() } }
          tx.oncomplete = tx.onerror = tx.onabort = resolve
        } catch { resolve() }
      })
    }).catch(() => {})
  }
}
export function dataAccessKey() { return globalThis.__MSM_DATA_ACCESS__?.key || 'viewer:v2' }
export function checkDataAccess(result) {
  if (result.dataAccessKey && result.dataAccessKey !== dataAccessKey()) {
    window.dispatchEvent(new Event('msm-permissions-changed'))
    throw new Error('권한이 변경되어 화면을 다시 불러옵니다.')
  }
}
