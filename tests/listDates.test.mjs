import test from 'node:test'
import assert from 'node:assert/strict'
import { parseListDate, defaultListRange, listMonths } from '../src/utils/listDates.js'

test('날짜 직접 입력과 잘못된 날짜 처리', () => {
  assert.equal(parseListDate('10/1', 2026), '2026-10-01')
  assert.equal(parseListDate('2026/1/1'), '2026-01-01')
  assert.equal(parseListDate('20261001'), '2026-10-01')
  assert.equal(parseListDate('1001', 2026), '2026-10-01')
  assert.throws(() => parseListDate('2026/02/30'), /존재하지/)
  assert.throws(() => parseListDate('13/1', 2026), /범위/)
})
test('직전 한 달의 월말 보정과 연도 경계', () => {
  assert.deepEqual(defaultListRange('2026-11-05'), { start: '2026-10-05', end: '2026-11-05' })
  assert.deepEqual(defaultListRange('2026-03-31'), { start: '2026-02-28', end: '2026-03-31' })
  assert.deepEqual(listMonths('2025-12-20', '2026-02-01'), ['202512', '202601', '202602'])
  assert.throws(() => listMonths('2026-11-05', '2026-10-01'), /시작일/)
})
