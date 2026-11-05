import { dataAccessKey } from './dataAccess'
const LIMIT = 6
// 두 개의 독립 번들이 같은 메모리·버전 확인 시각·IndexedDB 연결을 공유합니다.
const shared = globalThis.__MSM_MONTH_CACHE__ ||= { memory: new Map(), checked: new Map(), missing: new Set(), databasePromise: null, blocked: false, accessClock: 0 }
const memory = shared.memory
const storedKeys = shared.storedKeys ||= new Set()
const FRESH_MS = 30000
function accessedNow() { shared.accessClock = Math.max(Date.now(), shared.accessClock + 1); return shared.accessClock }

function disableDisk(error) {
  if (!shared.blocked) console.warn('[MSM CACHE] 브라우저 저장 불가: 메모리 캐시 사용', error?.name || '')
  shared.blocked = true
}

function database() {
  if (shared.blocked) return Promise.resolve(null)
  if (!shared.databasePromise) shared.databasePromise = new Promise(resolve => {
    let finished = false
    const finish = value => { if (!finished) { finished = true; clearTimeout(timer); resolve(value) } }
    const timer = setTimeout(() => { disableDisk(); finish(null) }, 2000)
    try {
      const request = indexedDB.open('msm-gas-months-v2-scoped', 1)
      request.onupgradeneeded = () => {
        const store = request.result.createObjectStore('months', { keyPath: 'key' })
        store.createIndex('user', 'email')
      }
      request.onsuccess = () => {
        if (finished) { request.result.close(); return }
        request.result.onversionchange = () => { request.result.close(); shared.blocked = true }
        const db = request.result
        finish(db)
        const email = globalThis.__MSM_DATA_ACCESS__?.email
        const scope = dataAccessKey()
        if (email) setTimeout(() => {
          if (globalThis.__MSM_DATA_ACCESS__?.email !== email || dataAccessKey() !== scope) return
          try {
            const tx = db.transaction('months', 'readwrite')
            const request = tx.objectStore('months').index('user').openKeyCursor(email)
            request.onsuccess = () => {
              const cursor = request.result
              if (!cursor) return
              if (!String(cursor.primaryKey).startsWith(`${email}|${scope}|`)) tx.objectStore('months').delete(cursor.primaryKey)
              cursor.continue()
            }
          } catch {}
        }, 1000)
      }
      request.onerror = () => { disableDisk(request.error); finish(null) }
      request.onblocked = () => { disableDisk(); finish(null) }
    } catch (error) { disableDisk(error); finish(null) }
  })
  return shared.databasePromise
}

async function transaction(mode, action) {
  const db = await database()
  if (!db || shared.blocked) return null
  return new Promise(resolve => {
    let result = null
    let finished = false
    let tx
    const finish = value => { if (!finished) { finished = true; clearTimeout(timer); resolve(value) } }
    const timer = setTimeout(() => { disableDisk(); try { tx?.abort() } catch {} finish(null) }, 2500)
    try {
      tx = db.transaction('months', mode)
      tx.oncomplete = () => finish(result)
      tx.onerror = tx.onabort = () => { disableDisk(tx.error); finish(null) }
      action(tx.objectStore('months'), value => { result = value })
    } catch (error) { disableDisk(error); finish(null) }
  })
}

const keyFor = (email, month) => `${email}|${dataAccessKey()}|${month}`

function remember(record) {
  memory.set(record.key, record)
  const records = [...memory.values()].filter(item => item.email === record.email).sort((a, b) => b.accessed - a.accessed)
  for (const stale of records.slice(LIMIT)) { memory.delete(stale.key); shared.checked.delete(stale.key) }
}

export function monthRecentlyChecked(email, month) {
  return Date.now() - (shared.checked.get(keyFor(email, month)) || 0) < FRESH_MS
}
export function monthKnownMissing(email, month) {
  return shared.missing.has(keyFor(email, month)) && monthRecentlyChecked(email, month)
}
export function markMonthChecked(email, month, exists) {
  const key = keyFor(email, month)
  shared.checked.set(key, Date.now())
  if (exists) shared.missing.delete(key)
  else { shared.missing.add(key); memory.delete(key) }
  // 없는 월을 무한히 순회해도 부가 메타데이터가 무한 증가하지 않게 제한.
  if (shared.checked.size > 100) {
    const oldest = [...shared.checked].sort((a, b) => a[1] - b[1]).slice(0, shared.checked.size - 100)
    for (const [key] of oldest) { shared.checked.delete(key); shared.missing.delete(key) }
  }
}
export function invalidateMonthChecks(email) {
  for (const key of shared.checked.keys()) if (key.startsWith(`${email}|`)) shared.checked.delete(key)
}

export async function readMonthCache(email, month) {
  const key = keyFor(email, month)
  let record = memory.get(key)
  const memoryHit = !!record
  if (!record) record = await transaction('readonly', (store, done) => {
    const request = store.get(key)
    request.onsuccess = () => done(request.result || null)
  })
  if (!record || record.email !== email || record.month !== month || record.scope !== dataAccessKey() || !record.payload?.data || !record.payload.updatedAt) return null
  record.accessed = accessedNow()
  remember(record)
  // 메모리 조회 시 대용량 원본을 디스크에 다시 쓰면서 기다리지 않습니다.
  if (!memoryHit) storedKeys.add(key)
  if (!storedKeys.has(key)) void persistRecord(record)
  return record.payload
}

export async function writeMonthCache(email, month, payload) {
  if (!payload?.data || !payload.updatedAt) return
  const record = { key: keyFor(email, month), email, month, scope: dataAccessKey(), payload, accessed: accessedNow() }
  remember(record)
  await persistRecord(record)
}

function persistRecord(record) {
  storedKeys.add(record.key)
  // 원본 저장·정리는 직렬화하되 화면 렌더링은 이 작업을 기다리지 않습니다.
  const write = (shared.persistence || Promise.resolve()).then(() => record.scope !== dataAccessKey() ? null : transaction('readwrite', store => {
    store.put(record)
    const keys = []
    const request = store.index('user').openKeyCursor(record.email)
    request.onsuccess = () => {
      const cursor = request.result
      if (cursor) { keys.push(cursor.primaryKey); cursor.continue(); return }
      keys.sort((a, b) => (memory.get(b)?.accessed || 0) - (memory.get(a)?.accessed || 0))
      for (const key of keys.slice(LIMIT)) { store.delete(key); storedKeys.delete(key) }
    }
  }))
  shared.persistence = write.catch(() => {})
  return shared.persistence
}

// 저장이 확인된 행만 불변 복사해 즉시 공유 캐시에 반영합니다.
export async function applyCommittedEdits(committedMonths) {
  const email = globalThis.__MSM_DATA_ACCESS__?.email
  const scope = dataAccessKey()
  if (!email) return
  for (const committed of committedMonths || []) {
    const payload = await readMonthCache(email, committed.month)
    if (dataAccessKey() !== scope || globalThis.__MSM_DATA_ACCESS__?.email !== email) return
    if (!payload || payload.updatedAt === committed.updatedAt || payload.updatedAt !== committed.previousVersion) continue
    const data = { ...payload.data }
    const copied = new Set()
    for (const change of committed.changes) {
      if (!data[change.company]?.[change.index]) continue
      if (!copied.has(change.company)) { data[change.company] = [...data[change.company]]; copied.add(change.company) }
      const row = { ...data[change.company][change.index], ...change.after }
      if ('hour' in change.after || 'minute' in change.after) row.time = `${String(row.hour).padStart(2, '0')}:${String(row.minute).padStart(2, '0')}`
      data[change.company][change.index] = row
    }
    void writeMonthCache(email, committed.month, { ...payload, data, updatedAt: committed.updatedAt })
  }
  invalidateMonthChecks(email)
}
