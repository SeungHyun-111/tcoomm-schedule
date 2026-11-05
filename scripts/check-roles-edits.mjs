import {createRequire} from 'node:module'
import {readFileSync} from 'node:fs'
import assert from 'node:assert/strict'
const require=createRequire(new URL('../../../PGMDR/draft-schedule/package.json',import.meta.url))
const {chromium}=require('playwright')
const browser=await chromium.launch({channel:'msedge',headless:true})
try {
for(const role of ['viewer','revenue','admin']) {
 const page=await browser.newPage({viewport:{width:1700,height:1000}});page.setDefaultTimeout(10000)
 const errors=[];page.on('pageerror',error=>errors.push(error.message))
 await page.route('**/*',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html><body><div id="root"></div></body></html>'}))
 await page.goto('https://roles.test/')
 await page.evaluate(assets => { window.mockAssets = assets }, Object.fromEntries([['weekly',2],['access',3],['logs',4],['list',5]].map(([key,n]) => [key, {css:readFileSync(new URL('../gas/Styles'+n+'.html',import.meta.url),'utf8'),script:readFileSync(new URL('../gas/Scripts'+n+'.html',import.meta.url),'utf8')}])))
 await page.evaluate(initialRole=>{
  window.mockRole=initialRole;window.editHistory=[];window.roleAssignments=[]
  const email=initialRole==='admin'?'l.sh@skstoa.com':initialRole+'@skstoa.com'
  let version='v1'
  const raw={SSG:[{date:'2026-10-26',hour:10,minute:0,brand:'BrandA',productName:'상품A',dataProductName:'데이터상품A',org:'팀A',mdCategory:'뷰티',simpleMin:60,weightedMin:30,brandWeightedMin:20,price:2000,salesQty:15,revenue:9876543,company:'SSG'}],K:[],SK:[]}
  raw.SSG.push({...raw.SSG[0],mdCategory:'OtherCategory',date:'2026-10-25'})
  const access=()=>({role:window.mockRole,canViewRevenue:window.mockRole!=='viewer',canManageAccess:window.mockRole==='admin',dataAccessKey:window.mockRole+':test'})
  const payload=()=>{const data=JSON.parse(JSON.stringify(raw));if(window.mockRole==='viewer')for(const rows of Object.values(data))for(const row of rows)delete row.revenue;return{updatedAt:version,data}}
  window.google={script:{run:{withSuccessHandler(success){return{withFailureHandler(failure){return new Proxy({},{get:(_,name)=>(...args)=>setTimeout(()=>{
   if(name==='getDashboardBootstrap')success({email,...access(),months:['202610'],currentMonth:'202610',competitorWeek:'2026-10-26'})
   else if(name==='getDashboardScreenAssets')success(window.mockAssets[args[0]])
   else if(name==='recordDashboardVisit')success(true)
   else if(name==='getDashboardIdentity')success({email,displayName:'Fixture User'})
   else if(name==='getEditProgress'){window.progressReads=(window.progressReads||0)+1;success({stage:'index-sync',detail:'fixture'})}
   else if(name==='getDashboardData')success({email,...access(),month:args[0],current:payload(),previous:payload()})
   else if(name==='getCompetitorMonths')success({email,...access(),months:Object.fromEntries(args[0].map(month=>[month,month==='202610'?args[1]?.[month]===version&&args[2]===access().dataAccessKey?{unchanged:true,updatedAt:version}:payload():null]))})
   else if(name==='saveCompetitorWeek')success({})
   else if(name==='saveCompetitorEdits'){
    if(window.mockRole!=='admin'){failure({message:'관리자만'});return}
    const previousVersion=version; const historyStart=window.editHistory.length
    const changes=args[0].changes
    for(const change of changes){const row=raw[change.company][change.index],before={};for(const key of Object.keys(change.fields))before[key]=row[key];Object.assign(row,change.fields);window.editHistory.push({company:change.company,index:change.index,date:row.date,before,after:change.fields})}
    version='v'+(Number(version.slice(1))+1);success({applied:changes.length,errors:[],warnings:[],committedMonths:[{month:'202610',previousVersion,updatedAt:version,changes:window.editHistory.slice(historyStart)}]})
   } else if(name==='getAccessManagement')success({admins:[{email,initialAdmin:true,role:'admin'},...window.roleAssignments]})
   else if(name==='setAppRole'){window.roleAssignments.push({email:args[0],role:args[1]});success({})}
   else if(name==='getAccessLogReport')success({range:args[0],stats:{total:0,uniqueUsers:0,allowed:0,denied:0,dailyAverage:0},daily:[],users:[],rows:[],page:1,pages:1,pageSize:50})
   else if(name==='getDataChangeLogs')success({rows:window.editHistory.length?[{id:'change1',actor:email,month:'202610',createdAt:new Date().toISOString(),kind:'brand',count:window.editHistory.length,status:'applied',changes:window.editHistory}]:[],total:window.editHistory.length,page:1,pages:1})
   else failure({message:'Unknown '+name})
  },name==='saveCompetitorEdits'&&window.mockSlowSave?4500:5)})}}}}}}
 },role)
 const content=name=>readFileSync(new URL('../gas/'+name,import.meta.url),'utf8').replace(/^<(?:script|style)>\s*/,'').replace(/\s*<\/(?:script|style)>\s*$/,'')
 for(const name of ['Styles.html'])await page.addStyleTag({content:content(name)})
 for(const name of ['Diagnostics.html','Scripts.html'])await page.addScriptTag({content:content(name)})
 await page.locator('.company-card').first().waitFor()
 assert.equal(await page.evaluate(() => !!window.__MSM_LIST__ || !!window.__MSM_WEEKLY__), false)
 async function checkGuide(expectedSteps) {
  await page.locator('.page-guide-trigger').click()
  const titles=[]
  for(let i=0;i<expectedSteps;i++) {
   await page.waitForFunction(()=>{
    const r=document.querySelector('.page-guide-card')?.getBoundingClientRect()
    return r&&r.top>=0&&r.bottom<=innerHeight&&r.left>=0&&r.right<=innerWidth
   })
   titles.push(await page.locator('.page-guide-card h2').innerText())
   await page.locator('.page-guide-card footer>div button').last().click()
  }
  assert.equal(await page.locator('.page-guide-card').count(),0)
  return titles
 }
 await checkGuide(role==='admin'?6:5)
 assert.equal(await page.locator('.gas-user-identity strong').innerText(),'Fixture User')

 if(role==='admin') {
  await page.setViewportSize({width:1100,height:520})
  await page.locator('.page-guide-trigger').click()
  await page.locator('.page-guide-card footer>div button:last-child').click()
  await page.locator('.page-guide-card footer>div button:last-child').click()
  await page.waitForFunction(() => {
   const r=document.querySelector('.page-guide-card')?.getBoundingClientRect()
   return r && r.top>=0 && r.bottom<=innerHeight && r.left>=0 && r.right<=innerWidth
  })
  await page.locator('.page-guide-card footer>button').click()
  await page.setViewportSize({width:1700,height:1000})
 }

 await page.getByLabel('MD분류',{exact:true}).selectOption('뷰티')
 await page.locator('.brand-row').first().click()
 const revenue=role!=='viewer'
 assert.equal(await page.locator('.broadcast-table th').filter({hasText:'매출액'}).count(),revenue?2:0)
 await page.locator('.brand-cell').first().hover()
 assert.equal((await page.locator('.floating-tooltip').innerText()).includes('매출액'),revenue)
 if(role==='admin') {
  await page.locator('.brand-cell').first().click({button:'right'})
  await page.locator('.monthly-edit-dialog input:not([type=checkbox])').first().fill('BrandRenamed')
  await page.locator('.monthly-edit-dialog footer button').last().click()
  await page.waitForFunction(()=>document.querySelector('.brand-cell')?.textContent.includes('BrandRenamed'))
  await page.locator('.brand-cell').first().click({button:'right'})
  await page.locator('.monthly-edit-dialog input:not([type=checkbox])').first().fill('BrandA')
  await page.locator('.monthly-edit-dialog footer button').last().click()
  await page.waitForFunction(()=>document.querySelector('.brand-cell')?.textContent.includes('BrandA'))
 }
 if(role==='admin') {
  await page.locator('.brand-cell').first().click({button:'right'})
  const dialog=page.locator('.monthly-edit-dialog')
  await dialog.waitFor()
  await dialog.locator('input:not([type=checkbox])').first().fill('BrandA')
  await dialog.locator('input[type=checkbox]').check()
  await dialog.locator('input[list]').fill('UpdatedCategory')
  await dialog.locator('button[type=submit],button:not([type])').last().click()
  await page.waitForFunction(()=>window.editHistory.some(item=>item.after.mdCategory==='UpdatedCategory'))
  assert.equal(await page.evaluate(()=>window.editHistory.filter(item=>item.after.mdCategory==='UpdatedCategory').length),1)
  assert.equal(await page.evaluate(()=>window.editHistory.find(item=>item.after.mdCategory==='UpdatedCategory').index),0)
  await page.getByLabel('MD\uBD84\uB958',{exact:true}).selectOption('UpdatedCategory')
 }
 await page.getByRole('button',{name:'주간 편성표',exact:true}).click()
 await page.locator('.competitor-program').first().waitFor()
 await checkGuide(6)
 await page.locator('.competitor-program').first().hover()
 await page.getByRole('tooltip').waitFor()
 const text=await page.getByRole('tooltip').innerText()
 assert.ok(text.includes('판매가격')&&text.includes('판매수량'))
 assert.equal(text.includes('매출액'),revenue)
 await page.getByRole('button',{name:'요약',exact:true}).click()
 await page.getByRole('dialog',{name:'조직별 브랜드 요약'}).waitFor()
 assert.equal(await page.locator('.competitor-brand-summary-panel th').filter({hasText:'매출액'}).count(),revenue?1:0)
 await page.getByRole('button',{name:'전체 목록',exact:true}).click()
 await page.getByLabel('전체 목록 시작일').fill('2026/10/01');await page.getByLabel('전체 목록 종료일').fill('2026/10/31')
 await page.getByRole('button',{name:'조회',exact:true}).click()
 await page.waitForFunction(()=>document.querySelector('.list-table-scroll tbody')?.textContent.includes('BrandA'))
 assert.equal(await page.locator('.list-table-scroll th').filter({hasText:'매출액'}).count(),revenue?1:0)
 await checkGuide(role==='admin'?6:4)
 const qty=page.locator('.list-table-scroll th').filter({hasText:'판매수량'})
 assert.equal(await qty.getAttribute('title'),'페이지 소스의 방송시작 재고수량 - 방송종료 재고수량')
 assert.equal(await page.getByRole('button',{name:'브랜드명 일괄 수정',exact:true}).count(),role==='admin'?1:0)
 if(role==='admin') {
  const cell=page.locator('.list-table-scroll tbody tr').first().locator('td').nth(7)
  await cell.dblclick()
  const editor=cell.locator('input')
  await editor.fill('InlineSaved')
  await page.evaluate(()=>{window.mockSlowSave=true})
  await editor.press('Enter')
  await page.waitForFunction(()=>document.querySelector('.list-table-scroll tbody')?.textContent.includes('InlineSaved'))
  assert.ok(await page.evaluate(()=>window.progressReads>=1))
  await page.evaluate(()=>{window.mockSlowSave=false})
  await cell.dblclick()
  await cell.locator('input').fill('Discarded')
  await cell.locator('input').press('Escape')
  assert.ok((await cell.innerText()).includes('InlineSaved'))

  await page.getByRole('button',{name:'브랜드명 일괄 수정',exact:true}).click()
  await page.getByLabel('기존 브랜드명',{exact:true}).fill('BrandA');await page.getByLabel('변경 브랜드명',{exact:true}).fill('BrandNew')
  await page.getByRole('button',{name:'RTDB에 저장',exact:true}).click()
  await page.waitForFunction(()=>document.querySelector('.list-table-scroll tbody')?.textContent.includes('BrandNew'))
  await page.locator('.list-table-scroll tbody tr').first().getByRole('button').click()
  await page.getByLabel('수정 상품명',{exact:true}).fill('수정 상품')
  await page.getByRole('button',{name:'RTDB에 저장',exact:true}).click()
  await page.waitForFunction(()=>document.querySelector('.list-table-scroll tbody')?.textContent.includes('수정 상품'))
  await page.getByRole('button',{name:'권한 관리',exact:true}).click()
  await page.locator('.access-form-row').waitFor()
  await checkGuide(3)
  await page.getByLabel('회사 이메일',{exact:true}).fill('sales@skstoa.com')
  await page.getByRole('button',{name:'권한 부여',exact:true}).click()
  await page.getByLabel('sales@skstoa.com 권한',{exact:true}).waitFor()
  assert.equal(await page.getByLabel('sales@skstoa.com 권한',{exact:true}).inputValue(),'revenue')
  await page.getByRole('button',{name:'접속 로그',exact:true}).click()
  await page.locator('.data-change-logs tbody tr').first().waitFor()
  await checkGuide(4)
  await page.locator('.data-change-logs').getByRole('button',{name:'상세',exact:true}).click()
  assert.ok((await page.locator('.data-change-logs').innerText()).includes('BrandNew'))
 } else {
  assert.equal(await page.getByRole('button',{name:'권한 관리',exact:true}).count(),0)
  if(role==='revenue'){
   await page.evaluate(()=>{window.mockRole='viewer';window.__MSM_MONTH_CACHE__.checked.clear();window.dispatchEvent(new Event('focus'))})
   await page.waitForFunction(()=>window.__MSM_DATA_ACCESS__?.canViewRevenue===false)
   await page.waitForFunction(()=>document.querySelectorAll('.list-table-scroll th').length===13)
  }
 }
 assert.deepEqual(errors,[])
 console.log('역할/편집 확인: '+role)
 await page.close()
}
}finally{await browser.close()}
