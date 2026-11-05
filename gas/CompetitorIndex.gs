// Same v2 search index schema as MSM and PGMDR.
const SEARCH_INDEX_VERSION = 2
const MIN_GRAM_LENGTH = 1
const MAX_GRAM_LENGTH = 2

function normalizeSearchText_(value) {
  return String(value || '')
    .normalize('NFKC')
    .toLocaleLowerCase('ko-KR')
    .replace(/\s+/g, '')
}

function encodeGram_(value) {
  return Utilities.base64EncodeWebSafe(value, Utilities.Charset.UTF_8).replace(/=+$/, '')
}

function getGrams_(value) {
  const normalized = normalizeSearchText_(value)
  const characters = Array.from(normalized)
  if (characters.length < MIN_GRAM_LENGTH) return []

  const grams = new Set()
  const maxLength = Math.min(MAX_GRAM_LENGTH, characters.length)
  for (let length = MIN_GRAM_LENGTH; length <= maxLength; length += 1) {
    for (let index = 0; index <= characters.length - length; index += 1) {
      grams.add(characters.slice(index, index + length).join(''))
    }
  }
  return [...grams]
}

function addDocumentToIndex_(target, value, documentId) {
  getGrams_(value).forEach((gram) => {
    const key = encodeGram_(gram)
    if (!target[key]) target[key] = {}
    target[key][documentId] = true
  })
}

function buildCompetitorSearchIndex_(payload) {
  const brand = {}
  const product = {}
  let documentCount = 0

  Object.entries(payload?.data || {}).forEach(([company, rows]) => {
    if (!Array.isArray(rows)) return

    rows.forEach((row, rowIndex) => {
      const documentId = `${company}_${rowIndex}`
      addDocumentToIndex_(brand, row?.brand, documentId)
      addDocumentToIndex_(product, row?.dataProductName, documentId)
      addDocumentToIndex_(product, row?.productName, documentId)
      documentCount += 1
    })
  })

  return {
    version: SEARCH_INDEX_VERSION,
    month: payload?.month,
    updatedAt: payload?.updatedAt,
    minGramLength: MIN_GRAM_LENGTH,
    maxGramLength: MAX_GRAM_LENGTH,
    documentCount,
    grams: {
      brand,
      product,
    },
  }
}
