// 모킹된 로그인·RTDB 응답으로 메뉴 노출과 관리자 추가·회수 화면 확인.
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
const require = createRequire(new URL('../../../PGMDR/draft-schedule/package.json', import.meta.url))
const { chromium } = require('playwright')
const browser = await chromium.launch({ channel: 'msedge', headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 1500, height: 950 } })
  page.setDefaultTimeout(10000)
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/*', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><body><div id="root"></div></body></html>' }))
  await page.goto('https://access.test/')
  const installMock = admin => {
    window.fixtureAdmin = admin
    const root = { email: 'l.sh@skstoa.com', initialAdmin: true, role: 'admin', viewer: true }
    const admins = [root]
    window.google = { script: { run: { withSuccessHandler(success) { return {
      withFailureHandler(failure) { return new Proxy({}, { get: (_, name) => (...args) => setTimeout(() => {
        const email = window.fixtureAdmin ? root.email : 'viewer@skstoa.com'
        if (name === 'getDashboardBootstrap') success({ email, canManageAccess: window.fixtureAdmin, months: ['202611'], currentMonth: '202611' })
        else if (name === 'getDashboardData') success({ email, month: '202611', current: { updatedAt: 'v1', data: { SSG: [], K: [], SK: [] } }, previous: null })
        else if (!window.fixtureAdmin) failure({ message: '관리자만 사용할 수 있습니다.' })
        else if (name === 'getAccessManagement') success({ email, admins: [...admins], defaultViewer: true })
        else if (name === 'grantAppAdmin') { admins.push({ email: args[0], role: 'admin', viewer: true, updatedBy: root.email, updatedAt: new Date().toISOString() }); success({ email: args[0] }) }
        else if (name === 'setAppRole') { const index = admins.findIndex(item => item.email === args[0]); if(index >= 0) admins.splice(index,1); if(args[1] !== 'viewer') admins.push({ email:args[0],role:args[1],updatedBy:root.email,updatedAt:new Date().toISOString() }); success({}) }
        else if (name === 'revokeAppAdmin') { admins.splice(admins.findIndex(item => item.email === args[0]), 1); success({ email: args[0] }) }
        else failure({ message: '알 수 없는 API' })
      }, 5) }) }
    } } } } }
  }
  await page.evaluate(installMock, true)
  const content = name => readFileSync(new URL('../gas/' + name, import.meta.url), 'utf8').replace(/^<(?:script|style)>\s*/, '').replace(/\s*<\/(?:script|style)>\s*$/, '')
  for (const name of ['Styles.html', 'Styles2.html', 'Styles3.html']) await page.addStyleTag({ content: content(name) })
  for (const name of ['Diagnostics.html', 'Scripts.html', 'Scripts3.html']) await page.addScriptTag({ content: content(name) })
  await page.getByRole('button', { name: '권한 관리', exact: true }).click()
  await page.locator('.access-page tbody tr').waitFor()
  assert.equal(await page.locator('.access-page tbody tr').count(), 1)
  assert.ok((await page.locator('.access-page tbody').innerText()).includes('l.sh@skstoa.com'))
  assert.equal(await page.getByText('고정', { exact: true }).count(), 1)
  await page.getByLabel('회사 이메일', { exact: true }).fill('added@skstoa.com')
  await page.getByRole('button', { name: '권한 부여', exact: true }).click()
  await page.waitForFunction(() => document.querySelectorAll('.access-page tbody tr').length === 2)
  await page.getByRole('button', { name: 'added@skstoa.com 권한 회수', exact: true }).click()
  await page.waitForFunction(() => document.querySelectorAll('.access-page tbody tr').length === 1)
  await page.reload()
  await page.evaluate(installMock, false)
  for (const name of ['Styles.html', 'Styles2.html', 'Styles3.html']) await page.addStyleTag({ content: content(name) })
  for (const name of ['Diagnostics.html', 'Scripts.html', 'Scripts3.html']) await page.addScriptTag({ content: content(name) })
  await page.getByText('viewer@skstoa.com', { exact: true }).waitFor()
  await page.waitForFunction(() => ![...document.querySelectorAll('.gas-view-nav button')].some(element => element.textContent === '권한 관리'))
  assert.deepEqual(errors, [])
  console.log('권한 화면 확인: 초기 관리자, 이메일 추가·회수, 일반 사용자 메뉴 미노출')
} finally { await browser.close() }
