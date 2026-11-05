// 생성된 GAS 번들을 모킹된 google.script.run으로 렌더링합니다. 네트워크 요청은 차단합니다.
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
const require = createRequire(new URL('../../../PGMDR/draft-schedule/package.json', import.meta.url))
const { chromium } = require('playwright')
const browser = await chromium.launch({ channel: 'msedge', headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  page.setDefaultTimeout(10000)
  const errors = []
  const requests = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/*', route => { requests.push(route.request().url()); return route.abort() })
  await page.route('https://msm-cache.test/', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><body><div id="root"></div></body></html>' }))
  await page.goto('https://msm-cache.test/')
  const installMock = (options = {}) => {
    window.mockEmail = options.email || 'sample@skstoa.com'
    window.mockVersion = options.version || 'v1'
    window.mockDownloads = 0
    const row = { date: '2026-11-01', hour: 10, minute: 0, time: '10:00', brand: '예시브랜드', productName: '예시상품', dataProductName: '예시상품', org: '예시조직', mdCategory: '레포츠', weightedMin: 30, simpleMin: 30, revenue: 100000, channel: 'IP' }
    window.google = { script: { run: {
      withSuccessHandler(success) { return {
        withFailureHandler(failure) { return new Proxy({}, { get: (_, name) => (...args) => {
          setTimeout(() => {
            if (name === 'getDashboardBootstrap') success({ email: window.mockEmail, months: ['202605', '202606', '202607', '202608', '202609', '202610', '202611'], currentMonth: '202611' })
            else if (name === 'getDashboardData') {
              const unchanged = args[1]?.[args[0]] === window.mockVersion
              if (!unchanged) window.mockDownloads++
              success({ email: window.mockEmail, month: args[0], current: unchanged ? { unchanged: true, updatedAt: window.mockVersion } : { updatedAt: window.mockVersion, data: { SSG: [row], K: [row], SK: [row] } }, previous: null })
            }
            else failure({ message: '알 수 없는 API' })
          }, 5)
        } }) }
      } }
    } } }
  }
  await page.evaluate(installMock)
  const css = readFileSync(new URL('../gas/Styles.html', import.meta.url), 'utf8').replace(/^<style>\s*/, '').replace(/\s*<\/style>\s*$/, '')
  const diagnostics = readFileSync(new URL('../gas/Diagnostics.html', import.meta.url), 'utf8').replace(/^<script>\s*/, '').replace(/\s*<\/script>\s*$/, '')
  const js = readFileSync(new URL('../gas/Scripts.html', import.meta.url), 'utf8').replace(/^<script>\s*/, '').replace(/\s*<\/script>\s*$/, '')
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: diagnostics })
  await page.addScriptTag({ content: js })
  await page.locator('.company-card').first().waitFor()
  assert.equal(await page.locator('.company-card').count(), 3)
  await page.getByLabel('MD분류', { exact: true }).selectOption('레포츠')
  assert.equal(await page.locator('.brand-row').count(), 3)
  await page.locator('.brand-row').first().click()
  assert.ok(await page.locator('.broadcast-section').isVisible())
  await page.getByLabel('조회 가능한 월').selectOption('202610')
  await page.waitForFunction(() => document.querySelector('.dashboard')?.dataset.month === '202610')
  await page.waitForFunction(() => window.mockDownloads === 2)
  assert.equal(await page.locator('.delta-trigger:visible').count(), 0)
  assert.deepEqual(errors, [])
  assert.deepEqual(requests, [])
  assert.equal(await page.evaluate(() => window.mockDownloads), 2)
  await page.getByLabel('조회 가능한 월').selectOption('202611')
  await page.locator('.company-card').first().waitFor()
  assert.equal(await page.evaluate(() => window.mockDownloads), 2, '같은 접속 중 재조회 시 원본 재다운로드 금지')
  await page.reload()
  await page.evaluate(installMock)
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: diagnostics })
  await page.addScriptTag({ content: js })
  await page.locator('.company-card').first().waitFor()
  assert.equal(await page.evaluate(() => window.mockDownloads), 0, '새로고침 후 IndexedDB 재사용')
  assert.equal(await page.getByRole('button', { name: '다시 조회', exact: true }).count(), 0)
  await page.evaluate(() => { window.mockVersion = 'v2'; window.__MSM_MONTH_CACHE__.checked.clear(); window.dispatchEvent(new Event('focus')) })
  await page.waitForFunction(() => window.mockDownloads === 1)
  await page.locator('.company-card').first().waitFor()
  assert.equal(await page.evaluate(() => window.mockDownloads), 1, '갱신 버전 변경 시 원본 재다운로드')
  await page.reload()
  await page.evaluate(installMock, { email: 'other@skstoa.com', version: 'v2' })
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: diagnostics })
  await page.addScriptTag({ content: js })
  await page.waitForFunction(() => window.mockDownloads === 1)
  await page.locator('.company-card').first().waitFor()
  assert.equal(await page.evaluate(() => window.mockDownloads), 1, '사용자 간 캐시 분리')
  for (const month of ['202605', '202606', '202607', '202608', '202609', '202610', '202611']) {
    await page.getByLabel('조회 가능한 월').selectOption(month)
    await page.waitForFunction(value => document.querySelector('.dashboard')?.dataset.month === value, month)
  }
  await page.evaluate(() => window.__MSM_MONTH_CACHE__.persistence)
  const kept = await page.evaluate(() => new Promise(resolve => {
    const request = indexedDB.open('msm-gas-months-v2-scoped', 1)
    request.onsuccess = () => {
      const db = request.result
      const query = db.transaction('months').objectStore('months').index('user').getAll('other@skstoa.com')
      query.onsuccess = () => { resolve(query.result.map(record => record.month)); db.close() }
    }
  }))
  assert.equal(kept.length, 6, '사용자별 최근 6개월만 보관')
  assert.ok(!kept.includes('202605'), '가장 오래 조회한 월 제거: ' + kept.join(','))
  await page.reload()
  await page.evaluate(installMock)
  await page.evaluate(() => { Object.defineProperty(window, 'indexedDB', { configurable: true, get() { throw new DOMException('Blocked', 'SecurityError') } }) })
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: diagnostics })
  await page.addScriptTag({ content: js })
  await page.locator('.company-card').first().waitFor()
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await page.waitForFunction(() => document.querySelectorAll('.company-card').length === 3 && document.querySelector('.gas-header button')?.disabled === false)
  assert.equal(await page.evaluate(() => window.mockDownloads), 1, 'IndexedDB 차단 시 메모리 캐시로 재사용')
  // 문법 오류도 별도 진단 스크립트에서 위치와 주변 코드까지 잡히는지 확인.
  await page.evaluate(() => {
    var source = 'var example = 1;\nvar broken = );\n';
    window.__MSM_DIAGNOSTICS__.setSource('diagnostic-fixture.js', source);
    var script = document.createElement('script');
    script.textContent = source + '\n//# sourceURL=diagnostic-fixture.js';
    document.body.appendChild(script);
  })
  const report = await page.evaluate(() => window.__MSM_DIAGNOSTICS__.reports.at(-1))
  assert.equal(report.filename, 'diagnostic-fixture.js')
  assert.equal(report.line, 2)
  assert.ok(report.context.includes('> 2: var broken = );'))
  assert.ok(await page.locator('#msm-diagnostic-error').isVisible())
  console.log('화면·캐시 확인 완료: 새로고침 재사용, 갱신 감지, 사용자 분리, 6개월 제한, 저장 차단 시 메모리 재사용, 오류 진단')
} finally { await browser.close() }
