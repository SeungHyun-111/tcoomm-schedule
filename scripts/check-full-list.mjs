import { createRequire } from 'node:module'
import { readFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'
const require = createRequire(new URL('../../../PGMDR/draft-schedule/package.json', import.meta.url))
const { chromium } = require('playwright')
const browser = await chromium.launch({ channel: 'msedge', headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
  page.setDefaultTimeout(10000)
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/*', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><body><div id="root"></div></body></html>' }))
  await page.goto('https://full-list.test/')
  await page.evaluate(() => {
    const email = 'viewer@skstoa.com'
    window.listCalls = 0
    const base = { date: '2026-10-10', hour: 10, minute: 5, simpleMin: 60, mdCategory: '뷰티', brand: 'Alpha', productName: '알파 상품', dataProductName: '원본 알파', company: 'SSG', org: '팀A', weightedMin: 30, brandWeightedMin: 12, revenue: 100000, price: 10000, salesQty: 10 }
    const data = month => ({ updatedAt: 'v1', data: month === '202610' ? { SSG: [base, { ...base, brand: 'Beta', productName: '베타 상품', dataProductName: '원본 베타', price: 5000, date: '2026-10-15' }, { ...base, brand: 'Gamma', org: '팀B', date: '2026-10-20' }], K: [{ ...base, company: 'K', brand: 'K브랜드', org: '팀C' }], SK: [] } : { SSG: [], K: [], SK: [] } })
    window.google = { script: { run: { withSuccessHandler(success) { return {
      withFailureHandler(failure) { return new Proxy({}, { get: (_, name) => (...args) => setTimeout(() => {
        if (name === 'getDashboardBootstrap') success({ email, months: ['202610'], currentMonth: '202611', canManageAccess: false })
        else if (name === 'getDashboardData') success({ email, month: '202610', current: data('202610'), previous: null })
        else if (name === 'getCompetitorMonths') { window.listCalls++; success({ email, months: Object.fromEntries(args[0].map(month => [month, args[1]?.[month] === 'v1' ? { unchanged: true, updatedAt: 'v1' } : data(month)])) }) }
        else failure({ message: '알 수 없는 API' })
      }, 5) }) }
    } } } } }
  })
  const content = name => readFileSync(new URL('../gas/' + name, import.meta.url), 'utf8').replace(/^<(?:script|style)>\s*/, '').replace(/\s*<\/(?:script|style)>\s*$/, '')
  for (const name of ['Styles.html', 'Styles5.html']) await page.addStyleTag({ content: content(name) })
  for (const name of ['Diagnostics.html', 'Scripts.html', 'Scripts5.html']) await page.addScriptTag({ content: content(name) })
  await page.locator('.company-card').first().waitFor()
  assert.equal(await page.getByRole('button', { name: '권한 관리', exact: true }).count(), 0)
  await page.getByRole('button', { name: '전체 목록', exact: true }).click()
  await page.locator('.full-list-page').waitFor()
  await page.getByLabel('전체 목록 시작일').fill('10/1')
  await page.getByLabel('전체 목록 시작일').press('Tab')
  assert.equal(await page.getByLabel('전체 목록 시작일').inputValue(), '2026/10/01')
  await page.getByLabel('전체 목록 종료일').fill('2026/10/31')
  await page.getByRole('button', { name: '조회', exact: true }).click()
  await page.waitForFunction(() => document.querySelectorAll('.list-table-scroll tbody tr').length === 3)
  assert.equal(await page.locator('.list-table-scroll th').count(), 13)
  assert.equal(await page.locator('.list-table-scroll tbody tr').first().locator('td').nth(10).innerText(), '12', '가중분은 원본 N열 brandWeightedMin')
  assert.equal(await page.locator('.full-list-page input[type=date]').count(), 0)
  await page.getByRole('button', { name: '조직 필터', exact: true }).click()
  await page.getByRole('button', { name: '모두 해제', exact: true }).click()
  await page.getByRole('checkbox', { name: '팀A', exact: true }).check()
  await page.getByRole('button', { name: '적용', exact: true }).click()
  await page.waitForFunction(() => document.querySelectorAll('.list-table-scroll tbody tr').length === 2)
  const calls = await page.evaluate(() => window.listCalls)
  await page.getByLabel('전체 목록 검색', { exact: true }).fill('Alpha')
  await page.waitForFunction(() => document.querySelectorAll('.list-table-scroll tbody tr').length === 1)
  assert.ok((await page.locator('.list-table-scroll tbody').innerText()).includes('Alpha'))
  await page.getByLabel('전체 목록 검색', { exact: true }).fill('')
  await page.locator('.list-company-tabs').getByRole('button', { name: 'K', exact: true }).click()
  await page.waitForFunction(() => document.querySelector('.list-table-scroll tbody')?.textContent.includes('K브랜드'))
  assert.equal(await page.locator('.list-table-scroll tbody tr').count(), 1)
  await page.locator('.list-company-tabs').getByRole('button', { name: 'SSG', exact: true }).click()
  await page.waitForFunction(() => document.querySelectorAll('.list-table-scroll tbody tr').length === 2)
  assert.equal(await page.evaluate(() => window.listCalls), calls, '검색·열 필터·회사 변경은 서버 요청 없음')
  await page.getByRole('button', { name: '판매가격(대표)', exact: true }).click()
  assert.ok((await page.locator('.list-table-scroll tbody tr').first().innerText()).includes('Beta'))
  mkdirSync(new URL('../artifacts/', import.meta.url), { recursive: true })
  await page.screenshot({ path: fileURLToPath(new URL('../artifacts/full-list.png', import.meta.url)) })
  assert.deepEqual(errors, [])
  console.log('전체 목록 확인: 일반 조회자 접근, 14개 헤더, SSG/K 분리, 날짜 직접 입력, 열 필터·정렬, 검색, 공통 캐시')
} finally { await browser.close() }
