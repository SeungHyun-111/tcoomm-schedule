import { dataAccessKey, checkDataAccess } from './dataAccess'
export function callGas(name, ...args) {
  const started = performance.now()
  console.info(`[MSM RPC] ${name}: 요청 시작`)
  const dataRequest = ['getDashboardData', 'getCompetitorMonths'].includes(name)
  if (dataRequest) args.push(dataAccessKey())
  return new Promise((resolve, reject) => {
    const diagnostics = globalThis.__MSM_DIAGNOSTICS__
    diagnostics?.stage(`gas-request:${name}`)
    function failed(error) {
      console.error(`[MSM RPC] ${name}: 실패 (${((performance.now() - started) / 1000).toFixed(1)}s)`)
      diagnostics?.report('gas-api', { message: `${name}: ${error?.message || '서버 요청 실패'}`, stack: error?.stack || '' })
      reject(new Error(error?.message || '서버 요청에 실패했습니다.'))
    }
    if (!globalThis.google?.script?.run) {
      failed(new Error('GAS 웹앱의 /exec 주소에서 열어주세요. 로컬 화면은 GAS 서버에 연결되지 않습니다.'))
      return
    }
    globalThis.google.script.run
      .withSuccessHandler(result => { try { if (dataRequest) checkDataAccess(result); console.info(`[MSM RPC] ${name}: 응답 완료 (${((performance.now() - started) / 1000).toFixed(1)}s)`); diagnostics?.stage(`gas-success:${name}`); resolve(result) } catch (error) { reject(error) } })
      .withFailureHandler(failed)
      [name](...args)
  })
}
