export function pageGuideSteps(view, session) {
  const revenue = session.canViewRevenue, admin = session.canManageAccess
  if (view === 'monthly') return [
    { selector: '.gas-header select', title: '조회 월', description: '분석할 월을 선택합니다. 선택한 월의 편성과 전월 비교를 함께 확인합니다.' },
    { selector: '.selector-sheet', title: 'MD분류', description: 'MD분류를 선택하면 회사별 브랜드 목록을 볼 수 있습니다. 전체를 선택하면 모든 분류를 합산합니다.' },
    { selector: '.company-card', title: '회사별 편성 현황', description: '회사별 편성 비중과 브랜드 수를 비교합니다. 전월대비 버튼과 편성 비중 막대에 마우스를 올려 상세 수치를 확인하세요.' },
    { selector: '.brand-table-wrap, .company-card', title: '브랜드 상세', description: 'MD분류 선택 후 브랜드를 클릭하면 방송 상세가 열립니다. Ctrl 키와 함께 클릭하면 여러 브랜드를 선택합니다.' },
    { selector: '.broadcast-section, .company-card', title: revenue ? '매출과 방송 상세' : '방송 상세 조회', description: revenue ? '매출액·분당 매출액을 함께 확인하고 열 제목으로 정렬할 수 있습니다.' : '일반 뷰어는 매출액 없이 편성 내역을 조회합니다. 매출액 열과 합계는 표시되지 않습니다.' },
    ...(admin ? [{ selector: '.brand-cell, .company-card', title: '브랜드·카테고리 수정', description: 'MD분류를 선택하고 브랜드 셀을 우클릭하세요. 선택한 월·회사·브랜드·현재 MD분류 그룹의 원본 행만 변경됩니다. 저장 완료 후 화면에 반영되며 변경 로그가 남습니다.' }] : []),
  ]
  if (view === 'weekly') return [
    { selector: '.competitor-channels', title: '회사 선택', description: 'SSG와 K의 주간 편성표를 전환합니다.' },
    { selector: '.competitor-week', title: '주차 선택', description: '이전·다음 버튼이나 주차 선택으로 조회 기간을 바꿉니다. 선택한 주차는 다음 접속에도 유지됩니다.' },
    { selector: '.competitor-org-filter', title: '조직 강조', description: '조직을 선택하면 해당 조직의 방송을 강조합니다. 다른 방송의 시간 위치는 유지됩니다.' },
    { selector: '.competitor-highlight-search', title: '검색', description: '브랜드·상품·카테고리·조직을 검색해 편성표의 일치하는 방송을 강조합니다.' },
    { selector: '.competitor-program, .competitor-toolbar', title: '방송 상세', description: revenue ? '방송에 마우스를 올리면 판매가격·판매수량·매출액 등 상세 정보를 확인합니다.' : '방송에 마우스를 올리면 판매가격·판매수량을 확인합니다. 판매수량은 방송시작 재고수량에서 방송종료 재고수량을 뺀 값입니다.' },
    { selector: '.competitor-brand-summary-trigger', title: '조직별 브랜드 요약', description: '요약 버튼에서 조직별 브랜드 편성을 비교합니다. 브랜드를 선택해 해당 방송 상세를 확인할 수 있습니다.' },
  ]
  if (view === 'list') return [
    { selector: '.list-company-tabs', title: '회사별 전체목록', description: 'SSG와 K의 원본 방송 목록을 나누어 조회합니다.' },
    { selector: '.list-toolbar', title: '검색과 조회 범위', description: '기본 조회 범위는 직전 한 달입니다. 날짜는 10/1처럼 직접 입력할 수 있고, 조회 버튼으로 기간을 적용합니다. 검색어에 일치하는 목록만 표시합니다.' },
    { selector: '.list-table-scroll thead', title: '열별 필터·정렬', description: '열 제목을 눌러 정렬하고 ▽ 버튼에서 포함하거나 제외할 값을 선택합니다. 검색과 열별 필터를 함께 사용할 수 있습니다.' },
    { selector: '.list-table-scroll', title: revenue ? '매출 조회' : '판매수량 조회', description: revenue ? '매출 권한으로 매출액 열과 합계를 조회할 수 있습니다.' : '매출액 열은 표시되지 않습니다. 판매수량에 마우스를 올리면 재고수량 기준 계산 안내를 볼 수 있습니다.' },
    ...(admin ? [
      { selector: '.list-editable-cell, .list-table-scroll', title: '셀 직접 수정', description: '셀을 더블클릭하거나 Enter·F2로 편집합니다. Enter 또는 저장으로 반영하고 Esc 또는 취소로 취소합니다. 저장 중에는 완료를 기다려 주세요.' },
      { selector: '.full-list-page>header', title: '브랜드 일괄 변경', description: '브랜드명 일괄 수정은 현재 회사와 조회 기간 전체에 적용됩니다. 검색·열별 필터로 좁힌 목록만을 대상으로 하는 기능은 아닙니다. 변경 내역은 변경 로그에서 확인합니다.' },
    ] : []),
  ]
  if (view === 'access' && admin) return [
    { selector: '.access-viewer-info', title: '세 가지 권한', description: '일반 뷰어는 매출 없이 조회하고, 매출 권한은 매출을 조회합니다. 관리자는 수정·권한 관리·로그 조회까지 할 수 있습니다.' },
    { selector: '.access-form-row', title: '권한 부여', description: '회사 이메일을 입력하고 매출 권한 또는 관리자 권한을 선택해 부여합니다. 일반 뷰어는 별도 등록이 필요 없습니다.' },
    { selector: '.access-table-scroll', title: '권한 변경·회수', description: '목록에서 권한을 변경하거나 일반 뷰어로 되돌릴 수 있습니다. 초기 관리자와 본인 권한에는 보호 제한이 있습니다.' },
  ]
  return [
    { selector: '.logs-filters', title: '접속 로그 검색', description: '날짜·이메일·허용/거부 조건으로 검색합니다. 접속 이력은 최초 접속과 새로고침 기준이며 메뉴 이동은 포함하지 않습니다.' },
    { selector: '.logs-stats', title: '접속 통계', description: '검색 조건 전체의 접속 수·사용자 수·허용/거부·일평균을 확인합니다.' },
    { selector: '.logs-table-scroll', title: '접속 이력', description: '접속 일시와 이메일, 결과를 확인합니다. 날짜와 시간은 한국 시간 기준입니다.' },
    { selector: '.data-change-logs', title: '변경 로그', description: '브랜드·카테고리·원본 행 수정 내역을 확인합니다. 상세에서 수정 전후 값과 작업 상태를 비교할 수 있습니다.' },
  ]
}
