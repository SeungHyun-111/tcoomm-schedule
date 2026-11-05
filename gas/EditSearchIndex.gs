// 유효한 v2 인덱스는 변경된 문서의 검색어만 수정합니다.
function editSearchIndexUpdates_(payload, details, previousVersion, actor, request) {
  var root = 'competitorInfo/searchIndex/' + payload.month;
  var updates = {};
  var header = dashboardFetchPaths_([root + '/version', root + '/updatedAt']);
  if (header[0] !== SEARCH_INDEX_VERSION || header[1] !== previousVersion) {
    saveProgress_(actor, request, 'index-rebuild', '인덱스 버전 불일치: 전체 복구');
    updates[root] = buildCompetitorSearchIndex_(payload);
    return updates;
  }
  var encoded = {};
  function gramKey(value) { return encoded[value] || (encoded[value] = encodeGram_(value)); }
  function grams(row, kind) {
    return new Set(kind === 'brand' ? getGrams_(row.brand) : getGrams_(row.productName).concat(getGrams_(row.dataProductName)));
  }
  details.forEach(function(detail) {
    var row = payload.data[detail.company][detail.index];
    var before = Object.assign({}, row, detail.before);
    ['brand', 'product'].forEach(function(kind) {
      var fields = kind === 'brand' ? ['brand'] : ['productName', 'dataProductName'];
      if (!fields.some(function(key) { return Object.prototype.hasOwnProperty.call(detail.after, key); })) return;
      var oldGrams = grams(before, kind), newGrams = grams(row, kind);
      var suffix = '/' + detail.company + '_' + detail.index;
      oldGrams.forEach(function(value) { if (!newGrams.has(value)) updates[root + '/grams/' + kind + '/' + gramKey(value) + suffix] = null; });
      newGrams.forEach(function(value) { if (!oldGrams.has(value)) updates[root + '/grams/' + kind + '/' + gramKey(value) + suffix] = true; });
    });
  });
  updates[root + '/updatedAt'] = payload.updatedAt;
  saveProgress_(actor, request, 'index-delta-ready', '변경 경로 수=' + Object.keys(updates).length);
  return updates;
}
