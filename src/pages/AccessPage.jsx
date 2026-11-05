import React, { useEffect, useState } from 'react'
import { callGas } from '../services/gasApi'

export default function AccessPage({ session }) {
  const [admins, setAdmins] = useState([])
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('revenue')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    callGas('getAccessManagement').then(result => {
      if (active) setAdmins(result.admins)
    }).catch(error => { if (active) { setAdmins([]); setError(error.message) } })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [revision])

  async function grant(event) {
    event.preventDefault()
    if (busy) return
    setBusy(true); setError(''); setNotice('')
    try {
      const target = email.trim().toLowerCase()
      await callGas('setAppRole', target, role)
      setEmail(''); setNotice(`${target}에 ${role === 'admin' ? '관리자' : '매출'} 권한을 부여했습니다.`)
      setRevision(value => value + 1)
    } catch (error) { setError(error.message) }
    finally { setBusy(false) }
  }
  async function revoke(target) {
    if (busy) return
    setBusy(true); setError(''); setNotice('')
    try {
      await callGas('setAppRole', target, 'viewer')
      setAdmins(previous => previous.filter(item => item.email !== target))
      setNotice(`${target}을 일반 뷰어로 변경했습니다. 매출액은 조회할 수 없습니다.`)
    } catch (error) { setError(error.message) }
    finally { setBusy(false) }
  }
  async function changeRole(target, value) {
    if (busy) return
    setBusy(true); setError(''); setNotice('')
    try { await callGas('setAppRole', target, value); setRevision(value => value + 1); setNotice('권한을 변경했습니다.') }
    catch (error) { setError(error.message) }
    finally { setBusy(false) }
  }
  return <main className="access-page">
    <header><div><span className="access-eyebrow">ACCESS MANAGEMENT</span><h1>권한 관리</h1><p>관리자로 추가한 회사 이메일만 이 페이지를 열고 관리 권한을 변경할 수 있습니다.</p></div><span className="access-session">{session.email}</span></header>
    <section className="access-card access-viewer-info"><strong>일반 뷰어 / 매출 권한 / 관리자</strong><p>일반 뷰어는 별도 등록 없이 조회하며 매출액은 볼 수 없습니다. 매출 권한자는 매출액을 조회하고, 관리자는 매출 조회와 권한·접속 로그 관리를 모두 할 수 있습니다.</p></section>
    <section className="access-card"><h2>권한 지정</h2><form onSubmit={grant}><label htmlFor="access-email">회사 이메일</label><div className="access-form-row"><input id="access-email" type="email" autoComplete="off" placeholder="name@skstoa.com" required value={email} disabled={busy} onChange={event => setEmail(event.target.value)} /><select aria-label="부여할 권한" value={role} disabled={busy} onChange={event => setRole(event.target.value)}><option value="revenue">매출 권한</option><option value="admin">관리자 권한</option></select><button type="submit" disabled={busy || loading || !email.trim()}>권한 부여</button></div></form></section>
    {error && <p className="access-error" role="alert">{error}</p>}
    {notice && <p className="access-notice" role="status">{notice}</p>}
    <section className="access-card"><div className="access-list-title"><h2>권한 지정 목록 <small>{admins.length}명</small></h2><button disabled={busy || loading} onClick={() => setRevision(value => value + 1)}>목록 갱신</button></div>
      {loading ? <p role="status">권한 목록을 불러오는 중…</p> : <div className="access-table-scroll"><table><thead><tr><th>이메일</th><th>권한</th><th>지정자</th><th>지정 일시</th><th>관리</th></tr></thead><tbody>{admins.map(item => <tr key={item.email}><td><strong>{item.email}</strong>{item.initialAdmin && <span className="access-badge">초기 관리자</span>}</td><td>{item.initialAdmin || item.email === session.email ? '관리자 (매출 포함)' : <select aria-label={`${item.email} 권한`} value={item.role} disabled={busy} onChange={event => changeRole(item.email, event.target.value)}><option value="revenue">매출 권한</option><option value="admin">관리자 권한</option></select>}</td><td>{item.initialAdmin ? '최초 설정' : item.updatedBy || '—'}</td><td>{item.updatedAt ? new Date(item.updatedAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) : '—'}</td><td>{item.initialAdmin ? <span className="access-muted">고정</span> : item.email === session.email ? <span className="access-muted">본인</span> : <button className="access-revoke" disabled={busy} onClick={() => revoke(item.email)} aria-label={`${item.email} 권한 회수`}>일반 뷰어로 변경</button>}</td></tr>)}</tbody></table></div>}
    </section>
  </main>
}
