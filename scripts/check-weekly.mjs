// 같은 DB를 모킹하여 월간→주간 캐시 공유와 Urban 편성표의 핵심 동작 확인.
import { createRequire } from 'node:module'
import { readFileSync, mkdirSync } from 'node:fs'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
const require = createRequire(new URL('../../../PGMDR/draft-schedule/package.json', import.meta.url))
const { chromium } = require('playwright')
const browser = await chromium.launch({ channel: 'msedge', headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
  page.setDefaultTimeout(10000)
  const errors = [], network = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/*', route => { network.push(route.request().url()); return route.abort() })
  await page.route('https://weekly.test/', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><body><div id="root"></div></body></html>' }))
  await page.goto('https://weekly.test/')
  await page.evaluate(() => {
    const email = 'fixture@skstoa.com'
    window.fixture = { downloaded: 0, weeklyDownloaded: 0, saves: [], calls: {}, delay: 5, version: 'v1' }
    const row = { date: '2026-10-26', hour: 10, minute: 0, brand: '예시브랜드', productName: '예시 상품', org: '팀A', mdCategory: '레포츠', simpleMin: 60, weightedMin: 10, revenue: 100000 }
    const data = month => ({ updatedAt: window.fixture.version, data: {
      SSG: month === '202610' ? [row, { ...row, weightedMin: 20 }, { ...row, date: '2026-10-31', hour: 23, minute: 30, weightedMin: 30 }, { ...row, date: '2026-10-19', weightedMin: 40 }]
        : month === '202611' ? [{ ...row, date: '2026-11-01', weightedMin: 30 }] : [],
      K: month === '202610' ? [{ ...row, org: '팀B' }] : [], SK: []
    } })
    window.google = { script: { run: { withSuccessHandler(success) { return {
      withFailureHandler(failure) { return new Proxy({}, { get: (_, name) => (...args) => { window.fixture.calls[name] = (window.fixture.calls[name] || 0) + 1; return setTimeout(() => {
        if (name === 'getDashboardBootstrap') success({ email, months: ['202610', '202611'], currentMonth: '202611', competitorWeek: '2026-10-26', canRefresh: false })
        else if (name === 'getDashboardData') {
          const current = args[0], previous = current === '202611' ? '202610' : '202609'
          const read = month => {
            if (args[1]?.[month] === window.fixture.version) return { unchanged: true, updatedAt: window.fixture.version }
            window.fixture.downloaded++
            return data(month)
          }
          success({ email, month: current, current: read(current), previous: read(previous) })
        } else if (name === 'getCompetitorMonths') {
          const months = Object.fromEntries(args[0].map(month => {
            if (args[1]?.[month] === window.fixture.version) return [month, { unchanged: true, updatedAt: window.fixture.version }]
            window.fixture.weeklyDownloaded++
            return [month, data(month)]
          }))
          success({ email, months })
        } else if (name === 'saveCompetitorWeek') { window.fixture.saves.push(args[0]); success({ week: args[0] }) }
        else failure({ message: '지원하지 않는 모킹 API: ' + name })
      }, window.fixture.delay) } }) }
    } } } } }
  })
  const content = name => readFileSync(new URL('../gas/' + name, import.meta.url), 'utf8').replace(/^<(?:script|style)>\s*/, '').replace(/\s*<\/(?:script|style)>\s*$/, '')
  for (const name of ['Styles.html', 'Styles2.html']) await page.addStyleTag({ content: content(name) })
  for (const name of ['Diagnostics.html', 'Scripts.html', 'Scripts2.html']) await page.addScriptTag({ content: content(name) })
  await page.locator('.company-card').first().waitFor()
  assert.equal(await page.locator('.selector-values select').count(), 1, '대시보드에는 MD분류만 표시')
  assert.equal(await page.getByLabel('조회 가능한 월').count(), 1, '월 선택은 우상단 하나만 표시')
  const companyColors = await page.locator('.card-company-title').evaluateAll(elements => elements.map(element => getComputedStyle(element).color))
  assert.deepEqual(companyColors, ['rgb(255, 107, 0)', 'rgb(47, 111, 214)', 'rgb(225, 45, 57)'])
  const palette = await page.evaluate(() => ({
    kpis: [...document.querySelectorAll('.share-strip>strong')].map(element => getComputedStyle(element).color),
    bars: [...document.querySelectorAll('.share-progress-segment.is-selected')].map(element => getComputedStyle(element).backgroundColor),
    marker: getComputedStyle(document.querySelector('.card-company-title'), '::before').backgroundColor,
    tableHeader: getComputedStyle(document.querySelector('.brand-rank th')).color,
  }))
  assert.deepEqual(palette.kpis, companyColors, '회사명과 핵심 KPI만 회사 컬러 유지')
  assert.ok(palette.bars.every(color => color === 'rgb(66, 106, 140)'), '비중 막대는 Steel Blue')
  assert.equal(palette.marker, 'rgb(120, 144, 165)')
  assert.equal(palette.tableHeader, 'rgb(38, 52, 66)')
  await page.getByLabel('MD분류', { exact: true }).selectOption('레포츠')
  mkdirSync(new URL('../artifacts/', import.meta.url), { recursive: true })
  await page.screenshot({ path: fileURLToPath(new URL('../artifacts/corporate-monthly.png', import.meta.url)) })
  assert.equal(await page.getByRole('button', { name: '글래시', exact: true }).count(), 0)
  assert.equal(await page.evaluate(() => document.documentElement.dataset.glass), 'on')
  assert.equal(await page.evaluate(() => window.fixture.downloaded), 2)
  await page.evaluate(() => { window.fixture.monthlyNode = document.querySelector('.dashboard') })
  await page.getByRole('button', { name: '주간 편성표', exact: true }).click()
  await page.locator('.competitor-program').first().waitFor()
  assert.equal(await page.locator('.competitor-page.is-urban').count(), 1)
  assert.equal(await page.locator('.competitor-day-track').first().evaluate(element => getComputedStyle(element).backgroundImage), 'none', '블록 뒤 가로 눈금선 제거')
  assert.equal(await page.getByRole('button', { name: '새로고침', exact: true }).count(), 0)
  assert.equal(await page.getByRole('button', { name: 'RTDB 갱신', exact: true }).count(), 0)
  assert.equal(await page.getByText('Urban', { exact: true }).count(), 0)
  const appearance = await page.evaluate(() => ({
    background: getComputedStyle(document.querySelector('.competitor-page')).backgroundImage,
    headerColor: getComputedStyle(document.querySelector('.gas-header')).color,
    bottom: document.querySelector('.gas-weekly-root').getBoundingClientRect().bottom,
    viewport: innerHeight,
  }))
  assert.ok(!appearance.background.includes('url('), '배경 이미지 미사용')
  assert.equal(appearance.headerColor, 'rgb(231, 238, 245)')
  assert.ok(Math.abs(appearance.bottom - appearance.viewport) < 1, '편성표가 화면 아래까지 채워 흰 여백 없음')
  assert.equal(await page.locator('.competitor-program').count(), 5, '자정 넘김은 다음 날 연속 박스로 표시')
  assert.equal(await page.locator('.competitor-program[data-channel="CA"]').count(), 1)
  assert.equal(await page.locator('.competitor-program[data-channel="IP"]').count(), 1)
  assert.equal(await page.evaluate(() => window.fixture.weeklyDownloaded), 0, '월간에서 받은 동일 월 캐시를 주간에서 재사용')
  assert.equal(await page.evaluate(() => window.fixture.calls.getCompetitorMonths || 0), 0, '30초 이내에는 주간 버전 확인도 대기하지 않음')
  assert.equal(await page.getByText('회의자료 입력', { exact: true }).count(), 0)
  await page.getByLabel('편성표 하이라이트 검색어').fill('예시브랜드')
  assert.ok((await page.locator('.competitor-highlight-summary').innerText()).includes('PGM 4건'), '자정 연속 박스 검색 중복 제외')
  const block = page.locator('.competitor-program').first()
  const height = await block.evaluate(element => element.getBoundingClientRect().height)
  await page.getByLabel('편성표 세로 배율').fill('150')
  await page.getByLabel('편성표 세로 배율').press('Tab')
  assert.ok(Math.abs(await block.evaluate(element => element.getBoundingClientRect().height) - height * 1.5) < 1)
  await page.locator('.competitor-org-filter summary').click()
  await page.getByLabel('조직명 다중 선택').selectOption(['팀A'])
  assert.equal(await page.locator('.competitor-program.organization-hit').count(), 5)
  await page.locator('.competitor-org-filter summary').click()
  await block.hover()
  await page.getByRole('tooltip').waitFor()
  assert.ok((await page.getByRole('tooltip').innerText()).includes('방송 상세'))
  await page.getByRole('button', { name: '요약', exact: true }).click()
  await page.getByRole('dialog', { name: '조직별 브랜드 요약' }).waitFor()
  await page.waitForFunction(() => document.querySelector('.competitor-brand-summary-total')?.textContent.includes('+50'))
  assert.equal(await page.evaluate(() => window.fixture.weeklyDownloaded), 0, '전주 비교도 이미 받은 월 캐시 사용')
  await page.locator('.competitor-brand-name').hover()
  await page.locator('.competitor-brand-broadcast-tooltip').waitFor()
  mkdirSync(new URL('../artifacts/', import.meta.url), { recursive: true })
  await page.screenshot({ path: fileURLToPath(new URL('../artifacts/urban-weekly.png', import.meta.url)) })
  await page.getByRole('button', { name: '브랜드 요약 닫기' }).click()
  await page.getByRole('button', { name: 'K', exact: true }).click()
  await page.waitForFunction(() => document.querySelectorAll('.competitor-program').length === 1)
  await page.getByRole('button', { name: '다음 주', exact: true }).click()
  await page.getByText('선택한 주에 저장된 방송이 없습니다.', { exact: true }).waitFor()
  await page.waitForFunction(() => window.fixture.saves.at(-1) === '2026-11-02')
  const callsBeforeReturn = await page.evaluate(() => window.fixture.calls.getDashboardData)
  await page.getByRole('button', { name: '월간 대시보드', exact: true }).click()
  await page.locator('.company-card').first().waitFor()
  assert.equal(await page.evaluate(() => document.querySelector('.dashboard') === window.fixture.monthlyNode), true, '월간 컴포넌트 유지')
  assert.equal(await page.evaluate(() => window.fixture.calls.getDashboardData), callsBeforeReturn, '화면 전환에 GAS 데이터 요청 없음')
  // 버전 유효 기간이 지나도 느린 서버 응답 전에 캐시 화면을 먼저 표시.
  await page.getByRole('button', { name: '주간 편성표', exact: true }).click()
  await page.locator('.competitor-timeline').waitFor()
  await page.evaluate(() => { window.__MSM_MONTH_CACHE__.checked.clear(); window.fixture.delay = 1200 })
  const switchStarted = Date.now()
  await page.getByRole('button', { name: '월간 대시보드', exact: true }).click()
  await page.locator('.company-card').first().waitFor({ timeout: 600 })
  assert.ok(Date.now() - switchStarted < 1000, '캐시 화면은 1.2초 서버 대기를 하지 않음')
  await page.waitForFunction(() => window.fixture.calls.getDashboardData > 1)
  await page.waitForFunction(() => !document.querySelector('.gas-cache-status'))
  await page.evaluate(() => { window.fixture.delay = 5; window.fixture.version = 'v2'; window.__MSM_MONTH_CACHE__.checked.clear(); window.dispatchEvent(new Event('focus')) })
  await page.waitForFunction(() => window.fixture.downloaded === 4)
  assert.equal(await page.getByRole('button', { name: '다시 조회', exact: true }).count(), 0)
  assert.equal(await page.locator('body.gas-urban').count(), 0)
  assert.deepEqual(errors, [])
  assert.deepEqual(network, [])
  console.log('Urban 편성표 확인: 캐시 공유, SSG CA/IP, 자정 넘김, 검색 중복 제외, 배율, 조직 강조, 상세 툴팁, 전주 요약, 채널·주차 전환')
} finally { await browser.close() }
