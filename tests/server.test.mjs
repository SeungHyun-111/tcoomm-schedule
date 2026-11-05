import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'

function server({ email = 'user@skstoa.com', properties = {}, response = () => null, status = 200, ifMatchStatus = 200 } = {}) {
  const calls = []
  const cache = new Map()
  const context = vm.createContext({
    CacheService: { getScriptCache: () => ({ get: key => cache.get(key) || null, put: (key, value) => cache.set(key, value) }) },
    Session: { getActiveUser: () => ({ getEmail: () => email }), getEffectiveUser: () => ({ getEmail: () => 'user@skstoa.com' }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: key => properties[key] || null, getProperties: () => ({ ...properties }), setProperty: (key, value) => { properties[key] = value }, deleteProperty: key => { delete properties[key] } }) },
    ScriptApp: { getOAuthToken: () => 'server-only-token' },
    Utilities: { formatDate: (_, __, pattern) => pattern === 'yyyy-MM-dd' ? '2026-11-05' : '202611', Charset: { UTF_8: 'utf8' }, base64EncodeWebSafe: value => Buffer.from(value).toString('base64url'), getUuid: () => 'fixture-uuid' },
    HtmlService: { createHtmlOutputFromFile: name => ({ getContent: () => name }), createTemplateFromFile: () => ({ evaluate: () => { const output = { setTitle: () => output, addMetaTag: () => output }; return output } }) },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) },
    UrlFetchApp: { fetchAll(requests) { return requests.map(({url, ...options}) => this.fetch(url, options)) }, fetch: (url, options) => {
      calls.push({ url, options })
      return { getResponseCode: () => options.headers?.['If-Match'] ? ifMatchStatus : status, getContentText: () => JSON.stringify(response(url)), getAllHeaders: () => ({ ETag: '"fixture-version"' }) }
    } },
  })
  for (const name of ['Config', 'Auth', 'Firebase', 'Dashboard', 'Competitor', 'CompetitorSource', 'CompetitorIndex', 'CompetitorPreferences', 'Access', 'AccessLogs', 'Code', 'RevenueAccess', 'SaveProgress', 'UserProfile', 'EditSearchIndex', 'DataEdits']) {
    vm.runInContext(readFileSync(new URL(`../gas/${name}.gs`, import.meta.url), 'utf8'), context)
  }
  return { context, calls }
}

test('외부 계정과 이메일 미확인 사용자는 DB 요청 전에 차단', () => {
  for (const email of ['', 'user@gmail.com', 'user@skstoa.com.attacker.test']) {
    const { context, calls } = server({ email })
    assert.throws(() => context.getDashboardData('202611'), /회사 계정/)
    assert.equal(calls.length, 0)
  }
})
test('허용 사용자 목록과 월 입력 검사', () => {
  const restricted = server({ properties: { ALLOWED_EMAILS: 'other@skstoa.com' } })
  assert.throws(() => restricted.context.getDashboardBootstrap(), /권한/)
  const { context, calls } = server()
  for (const month of ['202613', '../secrets', 202611, '202600']) assert.throws(() => context.getDashboardData(month), /YYYYMM/)
  assert.equal(calls.length, 0)
})
test('연도 경계 전월 조회와 누락 데이터 처리, 토큰은 서버 요청에만 사용', () => {
  const { context, calls } = server({ response: url => url.includes('/202601.json') ? { data: { SSG: [{ brand: '예시' }] } } : null })
  const result = context.getDashboardData('202601')
  assert.equal(result.previous, null)
  assert.equal(result.current.data.SSG[0].brand, '예시')
  assert.ok(calls.some(call => call.url.endsWith('/202512.json')))
  assert.equal(calls[0].options.headers.Authorization, 'Bearer server-only-token')
  assert.ok(!JSON.stringify(result).includes('server-only-token'))
})
test('RTDB 인증 오류를 데이터 없음으로 숨기지 않음', () => {
  const { context } = server({ status: 403 })
  assert.throws(() => context.getDashboardData('202611'), /HTTP 403/)
})

test('서비스 계정 미등록을 구분하고 응답의 비밀값은 출력하지 않음', () => {
  const { context } = server({ status: 401, response: () => ({ error: 'Permission denied' }) })
  assert.throws(() => context.getDashboardData('202611'), /서비스 계정 속성 없음.*Permission denied.*FIREBASE_SERVICE_ACCOUNT_JSON/)
  assert.equal(context.dashboardFirebaseError_('{"error":"secret-token-example"}'), '인증 서버의 요청 거부')
})

test('캐시 버전 일치 시 원본 없이 updatedAt만 조회하고 사용자 인증 유지', () => {
  const { context, calls } = server({ response: url => url.includes('/updatedAt.json') ? 'v1' : { data: {} } })
  const result = context.getDashboardData('202611', { '202611': 'v1', '202610': 'v1' }, 'viewer:v2')
  assert.equal(result.email, 'user@skstoa.com')
  assert.equal(result.current.unchanged, true)
  assert.equal(result.previous.unchanged, true)
  assert.equal(calls.length, 2)
  assert.ok(calls.every(call => call.url.endsWith('/updatedAt.json')))
  const denied = server({ email: '' })
  assert.throws(() => denied.context.getDashboardData('202611', { '202611': 'v1' }), /회사 계정/)
  assert.equal(denied.calls.length, 0)
})

test('변경된 월만 원본을 다시 읽고 타임스탬프가 없으면 재사용하지 않음', () => {
  const { context, calls } = server({ response: url => {
    if (url.endsWith('/202611/updatedAt.json')) return 'v2'
    if (url.endsWith('/202610/updatedAt.json')) return 'v1'
    return { updatedAt: 'v2', data: { SSG: [] } }
  } })
  const result = context.getDashboardData('202611', { '202611': 'v1', '202610': 'v1' }, 'viewer:v2')
  assert.equal(result.current.updatedAt, 'v2')
  assert.equal(result.previous.unchanged, true)
  assert.equal(calls.length, 3)
  const missing = server({ response: url => url.includes('/updatedAt.json') ? null : { data: {} } })
  const old = missing.context.getDashboardData('202611', { '202611': 'v1', '202610': 'v1' }, 'viewer:v2')
  assert.equal(old.current.unchanged, undefined)
  assert.equal(missing.calls.length, 4)
})

test('주간 편성표도 같은 월 원본과 버전 캐시 사용, 임의 경로 거부', () => {
  const { context, calls } = server({ response: url => url.endsWith('/updatedAt.json') ? 'v1' : { data: { SSG: [] } } })
  const result = context.getCompetitorMonths(['202610', '202611'], { '202610': 'v1' }, 'viewer:v2')
  assert.equal(result.months['202610'].unchanged, true)
  assert.ok(result.months['202611'].data.SSG)
  assert.ok(calls.every(call => call.url.includes('/competitorInfo/monthly/')))
  assert.throws(() => context.getCompetitorMonths(['../secrets'], {}), /형식/)
  assert.throws(() => context.refreshCompetitorData('202611'), /권한/)
})

test('원본 갱신은 관리자만 원본·v2 인덱스·메타데이터를 한 요청으로 갱신', () => {
  const { context, calls } = server({ email:'l.sh@skstoa.com', properties: { COMPETITOR_SOURCE_SPREADSHEET_ID: 'fixture-sheet', COMPETITOR_ADMIN_EMAILS:'l.sh@skstoa.com' } })
  context.buildMonthlyPayload_ = month => ({ month, data: { SSG: [{ brand: '브랜드', productName: '상품' }], K: [], SK: [] } })
  const result = context.refreshCompetitorData('202611')
  assert.equal(result.SSG, 1)
  const patch = calls.find(call => call.options.method === 'patch')
  const updates = JSON.parse(patch.options.payload)
  assert.equal(updates['competitorInfo/searchIndex/202611'].version, 2)
  assert.equal(updates['metadata/competitorInfo/monthly/202611'].rowCount, 1)
  assert.equal(updates['competitorInfo/monthly/202611'].updatedAt, updates['competitorInfo/searchIndex/202611'].updatedAt)
})

test('조회 주차는 서버가 확인한 사용자 경로에만 저장', () => {
  const { context, calls } = server()
  context.saveCompetitorWeek('2026-11-02')
  assert.ok(calls[0].url.includes('/userPreferences/'))
  assert.ok(calls[0].url.endsWith('/competitorSchedule/77-65-65-6b-6c-79/lastViewedDate.json'))
  assert.throws(() => context.saveCompetitorWeek('2026-02-31'), /형식/)
})

test('초기 관리자만 기본 관리 권한, 일반 뷰어의 직접 API 호출 차단', () => {
  const root = server({ email: 'l.sh@skstoa.com' })
  const state = root.context.getAccessManagement()
  assert.equal(state.admins[0].email, 'l.sh@skstoa.com')
  assert.equal(state.admins[0].initialAdmin, true)
  assert.equal(state.admins[0].viewer, true)
  const viewer = server()
  assert.equal(viewer.context.isAppAdmin_('user@skstoa.com'), false)
  assert.throws(() => viewer.context.getAccessManagement(), /관리자만/)
  assert.throws(() => viewer.context.grantAppAdmin('attacker@skstoa.com', 'l.sh@skstoa.com'), /관리자만/)
  assert.throws(() => viewer.context.revokeAppAdmin('l.sh@skstoa.com'), /관리자만/)
  assert.ok(viewer.calls.every(call => call.options.method === 'get'))
})

test('회사 이메일만 추가하고 관리자 레코드와 변경 이력을 함께 저장', () => {
  const { context, calls } = server({ email: 'l.sh@skstoa.com' })
  context.grantAppAdmin(' Added@SKSTOA.COM ')
  const patch = calls.find(call => call.options.method === 'patch')
  const updates = JSON.parse(patch.options.payload)
  const key = 'appAccess/tcoomm/admins/' + context.appAccessEmailKey_('added@skstoa.com')
  assert.equal(updates[key].email, 'added@skstoa.com')
  assert.equal(updates[key].role, 'admin')
  assert.equal(updates[key].updatedBy, 'l.sh@skstoa.com')
  assert.equal(context.isAppAdmin_('added@skstoa.com'), true)
  assert.equal(updates['appAccess/tcoomm/adminChanges/fixture-uuid'].action, 'grant')
  assert.throws(() => context.grantAppAdmin('outside@gmail.com'), /회사 이메일/)
  assert.throws(() => context.revokeAppAdmin('l.sh@skstoa.com'), /초기 관리자/)
})

test('등록 관리자 권한 확인·회수, 자신의 권한 회수 차단', () => {
  const actor = 'manager@skstoa.com'
  const propertyKey = 'TCOOMM_APP_ADMIN_' + Array.from(actor, character => character.codePointAt(0).toString(16)).join('-')
  const properties = { [propertyKey]: JSON.stringify({ email: actor, role: 'admin' }) }
  const { context, calls } = server({ email: actor, properties })
  assert.equal(context.isAppAdmin_(actor), true)
  assert.throws(() => context.revokeAppAdmin(actor), /자신의/)
  context.revokeAppAdmin('other@skstoa.com')
  const patch = calls.find(call => call.options.method === 'patch')
  const updates = JSON.parse(patch.options.payload)
  assert.equal(updates['appAccess/tcoomm/admins/' + context.appAccessEmailKey_('other@skstoa.com')], null)
  delete properties[propertyKey]
  assert.throws(() => context.grantAppAdmin('new@skstoa.com'), /관리자만/)
})

test('RTDB에 관리자 레코드를 위조해도 서버 관리 권한이 생기지 않음', () => {
  const { context } = server({ email: 'viewer@skstoa.com', response: () => ({ email: 'viewer@skstoa.com', role: 'admin' }) })
  assert.equal(context.isAppAdmin_('viewer@skstoa.com'), false)
  assert.throws(() => context.grantAppAdmin('another@skstoa.com'), /관리자만/)
})

test('허용 접속 로그는 HTML 응답 후 별도 호출, 거부는 서버에서 바로 기록', () => {
  const { context, calls } = server()
  context.doGet()
  assert.equal(calls.length, 0)
  context.recordDashboardVisit()
  assert.equal(calls.length, 1)
  assert.ok(calls[0].url.includes('/accessLogs/tcoomm/days/2026-11-05/'))
  assert.equal(JSON.parse(calls[0].options.payload).email, 'user@skstoa.com')
  assert.equal(JSON.parse(calls[0].options.payload).result, 'allowed')
  assert.throws(() => context.getDashboardData('202611'), /데이터가 없습니다/)
  assert.equal(calls.filter(call => call.options.method === 'put').length, 1)
  const denied = server({ email: 'outside@gmail.com' })
  assert.throws(() => denied.context.doGet(), /회사 계정/)
  assert.equal(JSON.parse(denied.calls[0].options.payload).result, 'denied')
})

test('접속 로그 이메일·날짜 필터와 통계, 기간 전체 집계 및 관리자 제한', () => {
  const data = {
    '2026-11-01': { a: { email: 'one@skstoa.com', accessedAt: '2026-11-01T01:00:00.000Z', result: 'allowed' }, b: { email: 'two@skstoa.com', accessedAt: '2026-11-01T02:00:00.000Z', result: 'denied' } },
    '2026-11-03': { c: { email: 'one@skstoa.com', accessedAt: '2026-11-03T01:00:00.000Z', result: 'allowed' } },
    '2026-10-31': { d: { email: 'outside@skstoa.com', accessedAt: '2026-10-31T01:00:00.000Z', result: 'allowed' } }
  }
  const { context } = server({ email: 'l.sh@skstoa.com', response: () => data })
  const all = context.getAccessLogReport({ start: '2026-11-01', end: '2026-11-03' })
  assert.equal(all.stats.total, 3)
  assert.equal(all.stats.uniqueUsers, 2)
  assert.equal(all.stats.allowed, 2)
  assert.equal(all.stats.denied, 1)
  assert.equal(all.daily[1].total, 0)
  assert.equal(all.rows[0].email, 'one@skstoa.com')
  const filtered = context.getAccessLogReport({ start: '2026-11-01', end: '2026-11-03', email: 'ONE@', result: 'allowed' })
  assert.equal(filtered.stats.total, 2)
  assert.equal(filtered.stats.uniqueUsers, 1)
  assert.equal(filtered.users[0].total, 2)
  assert.throws(() => context.getAccessLogReport({ start: '2026-02-31', end: '2026-03-03' }), /날짜/)
  assert.throws(() => context.getAccessLogReport({ start: '2026-01-01', end: '2026-11-03' }), /93일/)
  const viewer = server()
  assert.throws(() => viewer.context.getAccessLogReport({ start: '2026-11-01', end: '2026-11-03' }), /관리자만/)
  assert.equal(viewer.calls.length, 0)
})

test('접속 통계는 페이지와 무관하게 전체 검색 결과를 집계', () => {
  const records = Object.fromEntries(Array.from({ length: 61 }, (_, index) => [String(index), { email: 'one@skstoa.com', accessedAt: '2026-11-01T01:00:00.000Z', result: 'allowed' }]))
  const { context } = server({ email: 'l.sh@skstoa.com', response: () => ({ '2026-11-01': records }) })
  const result = context.getAccessLogReport({ start: '2026-11-01', end: '2026-11-01', page: 2 })
  assert.equal(result.stats.total, 61)
  assert.equal(result.rows.length, 11)
  assert.equal(result.pages, 2)
})

test('일반 뷰어 응답은 매출·알 수 없는 금액 필드를 제거하고 가격/수량 유지', () => {
  const payload = { updatedAt:'v1', data:{ SSG:[{ brand:'A',price:3000,salesQty:7,revenue:987654321,profit:123456789,weightedMin:10 }],K:[],SK:[] } }
  const {context} = server({response:url=>url.endsWith('/updatedAt.json')?'v1':payload})
  const value = context.getCompetitorMonths(['202611'], {'202611':'v1'}, 'admin:root-v2')
  assert.equal(value.canViewRevenue,false)
  assert.equal(value.months['202611'].unchanged,undefined, '다른 권한 캐시는 재사용하지 않음')
  const row = value.months['202611'].data.SSG[0]
  assert.equal(row.revenue,undefined); assert.equal(row.profit,undefined)
  assert.equal(row.price,3000); assert.equal(row.salesQty,7)
  assert.ok(!JSON.stringify(value).includes('987654321'))
})

test('매출 권한은 금액 조회만 허용하고 관리·수정 API는 차단', () => {
  const email='sales@skstoa.com', key='TCOOMM_APP_ADMIN_'+Array.from(email,c=>c.codePointAt(0).toString(16)).join('-')
  const {context}=server({email,properties:{[key]:JSON.stringify({email,role:'revenue',updatedAt:'role-v1'})},response:()=>({updatedAt:'v1',data:{SSG:[{revenue:100}],K:[],SK:[]}})})
  assert.equal(context.appUserAccess_(email).canViewRevenue,true)
  assert.equal(context.isAppAdmin_(email),false)
  assert.equal(context.getDashboardData('202611').current.data.SSG[0].revenue,100)
  assert.throws(()=>context.getAccessManagement(),/관리자만/)
  assert.throws(()=>context.saveCompetitorEdits({changes:[]}),/관리자만/)
})

test('관리자가 매출 권한을 부여·회수하고 기본 뷰어로 복귀', () => {
  const {context}=server({email:'l.sh@skstoa.com'})
  context.setAppRole('sales@skstoa.com','revenue')
  assert.equal(context.appUserAccess_('sales@skstoa.com').role,'revenue')
  assert.equal(context.getAccessManagement().admins[1].role,'revenue')
  context.setAppRole('sales@skstoa.com','viewer')
  assert.equal(context.appUserAccess_('sales@skstoa.com').canViewRevenue,false)
  assert.throws(()=>context.setAppRole('l.sh@skstoa.com','viewer'),/초기 관리자/)
})

test('행 수정은 관리자만 ETag 조건부 저장하고 인덱스·메타데이터·변경 이력 생성', () => {
  const payload={month:'202611',updatedAt:'v1',data:{SSG:[{brand:'old',date:'2026-11-01',hour:10,minute:0}],K:[],SK:[]}}
  const {context,calls}=server({email:'l.sh@skstoa.com',response:()=>payload})
  const value=context.saveCompetitorEdits({kind:'brand',changes:[{month:'202611',company:'SSG',index:0,version:'v1',fields:{brand:'new'}}]})
  assert.equal(value.applied,1)
  assert.equal(value.committedMonths[0].previousVersion,'v1')
  assert.equal(value.committedMonths[0].changes[0].after.brand,'new')
  const source=calls.find(call=>call.options.headers?.['If-Match'])
  assert.equal(source.options.headers['If-Match'],'"fixture-version"')
  assert.equal(JSON.parse(source.options.payload).data.SSG[0].brand,'new')
  const journal=calls.find(call=>call.url.includes('/changeLogs/') && call.options.method==='put')
  assert.equal(JSON.parse(journal.options.payload).changes[0].before.brand,'old')
  const sync=calls.find(call=>call.options.method==='patch' && call.url.includes('/.json'))
  assert.ok(JSON.parse(sync.options.payload)['competitorInfo/searchIndex/202611'])
})

test('동시 갱신 충돌은 412로 차단하고 적용 건수를 늘리지 않음', () => {
  const {context}=server({email:'l.sh@skstoa.com',ifMatchStatus:412,response:()=>({updatedAt:'v1',data:{SSG:[{brand:'old',date:'2026-11-01'}],K:[],SK:[]}})})
  const result=context.saveCompetitorEdits({changes:[{month:'202611',company:'SSG',index:0,version:'v1',fields:{brand:'new'}}]})
  assert.equal(result.applied,0)
  assert.equal(result.committedMonths.length,0)
  assert.ok(result.errors[0].includes('다른 작업'))
})

test('cold months skip version reads and use one parallel request batch', () => {
  const { context, calls } = server({ response: () => ({ updatedAt: 'v1', data: { SSG: [] } }) })
  const sizes = []
  const fetchAll = context.UrlFetchApp.fetchAll
  context.UrlFetchApp.fetchAll = function(requests) { sizes.push(requests.length); return fetchAll.call(this, requests) }
  context.getDashboardData('202611', {}, 'viewer:v2')
  assert.deepEqual(sizes, [2])
  assert.equal(calls.length, 2)
  assert.ok(calls.every(call => !call.url.includes('/updatedAt')))
})

test('screen assets are whitelisted and admin screens require server permission', () => {
  const { context, calls } = server()
  assert.equal(context.getDashboardScreenAssets('weekly').script, 'Scripts2')
  assert.equal(context.getDashboardScreenAssets('list').css, 'Styles5')
  for (const name of ['access', 'logs']) assert.throws(() => context.getDashboardScreenAssets(name))
  for (const name of ['__proto__', '../Firebase', 'constructor']) assert.throws(() => context.getDashboardScreenAssets(name))
  assert.equal(calls.length, 0)
  const admin = server({ email: 'l.sh@skstoa.com' })
  assert.equal(admin.context.getDashboardScreenAssets('access').script, 'Scripts3')
})

test('category edit keeps search grams and changes only index version', () => {
  const { context } = server({ response: url => url.endsWith('/version.json') ? 2 : 'v1' })
  const payload = {month:'202611',updatedAt:'v2',data:{SSG:[{brand:'AB',productName:'AB',mdCategory:'new'}]}}
  context.buildCompetitorSearchIndex_ = () => { throw new Error('must not rebuild') }
  const updates = context.editSearchIndexUpdates_(payload,[{company:'SSG',index:0,before:{mdCategory:'old'},after:{mdCategory:'new'}}],'v1','admin',{})
  assert.deepEqual(Object.keys(updates), ['competitorInfo/searchIndex/202611/updatedAt'])
})

test('incremental product search preserves grams contributed by other product field', () => {
  const { context } = server({ response: url => url.endsWith('/version.json') ? 2 : 'v1' })
  const payload={month:'202611',updatedAt:'v2',data:{SSG:[{brand:'AB',productName:'AC',dataProductName:'B'}]}}
  const updates=context.editSearchIndexUpdates_(payload,[{company:'SSG',index:0,before:{productName:'AB'},after:{productName:'AC'}}],'v1','admin',{})
  const path=value=>'competitorInfo/searchIndex/202611/grams/product/'+Buffer.from(value.toLowerCase()).toString('base64url')+'/SSG_0'
  assert.equal(updates[path('AB')],null)
  assert.equal(updates[path('C')],true)
  assert.equal(updates[path('AC')],true)
  assert.ok(!(path('B') in updates))
  assert.ok(!(path('A') in updates))
})

test('progress is visible only to the initiating administrator', () => {
  const { context } = server({email:'l.sh@skstoa.com'})
  const request={traceId:'edit_test_123',saveStartedAt:Date.now()}
  context.saveProgress_('l.sh@skstoa.com',request,'source-write','202611')
  assert.equal(context.getEditProgress(request.traceId).stage,'source-write')
  context.saveProgress_('other@skstoa.com',{traceId:'edit_other_123',saveStartedAt:Date.now()},'token')
  assert.equal(context.getEditProgress('edit_other_123').stage,'waiting')
  assert.throws(()=>server().context.getEditProgress(request.traceId))
})

test('directory display name requires exact visitor email and is cached', () => {
  const {context,calls}=server({response:()=>({people:[{names:[{displayName:'Wrong Owner'}],emailAddresses:[{value:'owner@skstoa.com'}]},{names:[{displayName:'Visitor Name'}],emailAddresses:[{value:'user@skstoa.com'}]}]})})
  assert.equal(context.getDashboardIdentity().displayName,'Visitor Name')
  assert.equal(context.getDashboardIdentity().displayName,'Visitor Name')
  assert.equal(calls.length,1)
  assert.ok(calls[0].url.includes('searchDirectoryPeople'))
  assert.equal(server({status:403}).context.getDashboardIdentity().displayName,'')
  assert.throws(()=>server({email:'outside@gmail.com'}).context.getDashboardIdentity())
})
