import { callGas } from './gasApi'
import { applyCommittedEdits } from './monthCache'
import { dataAccessKey } from './dataAccess'

export async function saveEdits(request) {
  const traceId = `edit_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
  const started = performance.now()
  const scope = dataAccessKey()
  let active = true, checking = false, lastStage = 'request-sent', lastChange = started
  const elapsed = () => `${((performance.now() - started) / 1000).toFixed(1)}s`
  console.info(`[MSM SAVE ${traceId}] ${elapsed()} 요청 전송`)
  const timer = setInterval(async () => {
    console.info(`[MSM SAVE ${traceId}] ${elapsed()} 현재 단계=${lastStage}, 단계 대기=${((performance.now() - lastChange) / 1000).toFixed(1)}s`)
    if (checking) return
    checking = true
    try {
      const state = await callGas('getEditProgress', traceId)
      if (!active) return
      if (state.stage !== lastStage) { lastChange = performance.now(); lastStage = state.stage }
      console.info(`[MSM SAVE ${traceId}] ${elapsed()} 서버 단계=${state.stage}`, { detail: state.detail || '', serverElapsedMs: state.elapsedMs, lastUpdateAgoMs: state.at ? Date.now() - state.at : null })
    } catch (error) { if (active) console.warn(`[MSM SAVE ${traceId}] 진행 조회 실패: ${error.message}`) }
    finally { checking = false }
  }, 4000)
  try {
    const result = await callGas('saveCompetitorEdits', { ...request, traceId })
    if (scope === dataAccessKey()) await applyCommittedEdits(result.committedMonths)
    console.info(`[MSM SAVE ${traceId}] ${elapsed()} 완료`, { applied: result.applied, errors: result.errors, warnings: result.warnings })
    return result
  } catch (error) {
    console.error(`[MSM SAVE ${traceId}] ${elapsed()} 실패 / 마지막 확인 단계=${lastStage}`, error.message)
    throw error
  } finally { active = false; clearInterval(timer) }
}
