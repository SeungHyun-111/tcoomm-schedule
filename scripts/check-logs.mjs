import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
const require = createRequire(new URL('../../../PGMDR/draft-schedule/package.json', import.meta.url))
const { chromium } = require('playwright')
const browser = await chromium.launch({ channel: 'msedge', headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 1550, height: 1000 } })
  page.setDefaultTimeout(10000)
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/*', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><body><div id="root"></div></body></html>' }))
  await page.goto('https://logs.test/')
  await page.evaluate(() => {
    window.logQueries = []
    const email = 'l.sh@skstoa.com'
    window.google = { script: { run: { withSuccessHandler(success) { return {
      withFailureHandler(failure) { return new Proxy({}, { get: (_, name) => (...args) => setTimeout(() => {
        if (name === 'getDashboardBootstrap') success({ email, canManageAccess: true, months: ['202611'], currentMonth: '202611' })
        else if (name === 'getDashboardData') success({ email, month: '202611', current: { updatedAt: 'v1', data: { SSG: [], K: [], SK: [] } }, previous: null })
        else if (name === 'getDataChangeLogs') success({rows:[],total:0,page:1,pages:1})
        else if (name === 'getAccessLogReport') {
          const query = args[0]
          window.logQueries.push(query)
          const result = query.result === 'denied' ? 'denied' : 'allowed'
          const stamp = query.end + 'T01:00:00.000Z'
          success({ range: query, stats: { total: 51, uniqueUsers: 1, allowed: result === 'allowed' ? 51 : 0, denied: result === 'denied' ? 51 : 0, dailyAverage: 1.7 }, daily: [{ date: query.end, total: 51, allowed: 51, denied: 0 }], users: [{ email, total: 51, allowed: 51, denied: 0, lastAccessedAt: stamp }], rows: [{ id: String(query.page), email, accessedAt: stamp, result }], page: query.page, pages: 2, pageSize: 50 })
        } else failure({ message: '알 수 없는 API' })
      }, 5) }) }
    } } } } }
  })
  const content = name => readFileSync(new URL('../gas/' + name, import.meta.url), 'utf8').replace(/^<(?:script|style)>\s*/, '').replace(/\s*<\/(?:script|style)>\s*$/, '')
  for (const name of ['Styles.html', 'Styles4.html']) await page.addStyleTag({ content: content(name) })
  for (const name of ['Diagnostics.html', 'Scripts.html', 'Scripts4.html']) await page.addScriptTag({ content: content(name) })
  await page.getByRole('button', { name: '접속 로그', exact: true }).click()
  await page.locator('.logs-stats').waitFor()
  assert.equal(await page.locator('.logs-stats article').count(), 5)
  await page.getByLabel('로그 이메일 검색').fill('l.sh')
  await page.getByLabel('로그 시작일').fill('2026-10-01')
  await page.getByLabel('로그 종료일').fill('2026-10-31')
  await page.getByLabel('로그 접속 결과').selectOption('denied')
  await page.getByRole('button', { name: '조회', exact: true }).click()
  await page.waitForFunction(() => window.logQueries.at(-1)?.email === 'l.sh' && document.querySelector('.logs-badge.denied'))
  const query = await page.evaluate(() => window.logQueries.at(-1))
  assert.equal(query.start, '2026-10-01')
  assert.equal(query.end, '2026-10-31')
  await page.getByRole('button', { name: '다음', exact: true }).click()
  await page.waitForFunction(() => window.logQueries.at(-1)?.page === 2)
  assert.ok((await page.locator('.logs-pagination').innerText()).includes('2 / 2'))
  assert.deepEqual(errors, [])
  console.log('접속 로그 화면 확인: 관리자 메뉴, 이메일·기간·결과 검색, 통계·차트, 페이지 이동')
} finally { await browser.close() }
