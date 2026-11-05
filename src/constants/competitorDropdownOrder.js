// 경쟁사 편성 페이지 드롭다운 표시 순서
// - MD_CATEGORY_ORDER 배열 순서대로 MD분류 드롭다운에 표시됩니다.
// - 여기에 없는 값은 배열에 적은 항목 뒤에 가나다순으로 붙습니다.
// - DB/GAS 원본 값과 글자가 정확히 같아야 우선순위가 적용됩니다.

export const MD_CATEGORY_ORDER = [
  '레포츠',
  '여성의류',
  '캐쥬얼남성',
  'PB',
  '잡화',
  '언더웨어',
  '뷰티',
  '대형가전',
  '생활가전',
  '주방가전',
  '주방용품',
  '생활용품',
  '가구',
  '건강식품',
  '일반식품',
  '렌탈',
  '렌터카',
  '보험',
  '여행',
  '교육/유아동',
]

export function sortByConfiguredOrder(values, configuredOrder) {
  const normalizedOrder = configuredOrder
    .map((value) => String(value || '').trim())
    .filter(Boolean)
  const orderMap = new Map(normalizedOrder.map((value, index) => [value, index]))

  return values
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .sort((a, b) => {
    const aOrder = orderMap.has(a) ? orderMap.get(a) : Number.MAX_SAFE_INTEGER
    const bOrder = orderMap.has(b) ? orderMap.get(b) : Number.MAX_SAFE_INTEGER

    if (aOrder !== bOrder) return aOrder - bOrder
    return String(a).localeCompare(String(b), 'ko')
  })
}
