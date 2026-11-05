import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { writeFile } from 'node:fs/promises'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
// 자체 설치를 우선하고, 현재 작업 공간에서는 기존 설치도 재사용합니다.
const candidates = ['package.json', '../../MSM/package.json', '../../PGMDR/draft-schedule/package.json']
let dependencyRequire
for (const candidate of candidates) {
  const require = createRequire(resolve(root, candidate))
  try { require.resolve('vite'); require.resolve('react'); require.resolve('react-dom'); require.resolve('dayjs'); dependencyRequire = require; break } catch { /* 다음 설치 확인 */ }
}
if (!dependencyRequire) throw new Error('이 폴더에서 npm install을 먼저 실행하세요.')
const { build } = await import(pathToFileURL(dependencyRequire.resolve('vite')).href)
const reactDir = dirname(dependencyRequire.resolve('react/package.json'))
const domDir = dirname(dependencyRequire.resolve('react-dom/package.json'))
async function buildScreen(entry, scriptFile, styleFile, bundleName, libraryName) {
const result = await build({
  root,
  configFile: false,
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  resolve: { alias: [
    { find: /^react-dom(?=\/|$)/, replacement: domDir },
    { find: /^react(?=\/|$)/, replacement: reactDir },
    { find: /^dayjs(?=\/|$)/, replacement: dirname(dependencyRequire.resolve('dayjs/package.json')) },
  ] },
  build: {
    write: false,
    cssCodeSplit: false,
    assetsInlineLimit: Number.MAX_SAFE_INTEGER,
    lib: { entry: resolve(root, entry), name: libraryName, formats: ['iife'], fileName: () => 'dashboard.js' },
    // 배포 크기를 줄이고 별도 Diagnostics 로더로 실행 오류를 기록합니다.
    minify: true,
    sourcemap: false,
  },
})
const output = (Array.isArray(result) ? result : [result]).flatMap(result => result.output)
const chunks = output.filter(file => file.type === 'chunk')
if (chunks.length !== 1 || chunks[0].imports.length || chunks[0].dynamicImports.length) {
  throw new Error('GAS 화면은 외부 JS 청크 없이 하나의 번들로 생성되어야 합니다.')
}
const css = output.filter(file => file.type === 'asset' && file.fileName.endsWith('.css')).map(file => String(file.source)).join('\n')
// GAS에는 단순한 로더와 Base64 데이터만 전달합니다. 복원한 소스는 HTML 파서를
// 다시 통과시키지 않고 script.textContent로 실행합니다. 암호화/비밀 저장 용도가 아닙니다.
const encoded = Buffer.from(chunks[0].code, 'utf8').toString('base64').match(/.{1,2048}/g)
const loader = `<script>
(function () {
  var diagnostics = window.__MSM_DIAGNOSTICS__;
  try {
    if (!diagnostics) throw new Error('Diagnostics.html을 추가하고 Index.html과 Code.gs를 최신 파일로 교체하세요.');
    diagnostics.stage('${bundleName}:decode');
    var encoded = [
${encoded.map(part => '      ' + JSON.stringify(part)).join(',\n')}
    ].join('');
    var binary = atob(encoded);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    var script = document.createElement('script');
    var source = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    diagnostics.setSource('${bundleName}', source);
    script.textContent = source + '\\n//# sourceURL=${bundleName}';
    diagnostics.stage('${bundleName}:execute');
    document.body.appendChild(script);
  } catch (error) {
    if (diagnostics) diagnostics.report('loader', { message: error.message || String(error), stack: error.stack });
    else console.error('[MSM ERROR] loader', error);
  }
})();
</script>
`
await writeFile(resolve(root, 'gas/' + scriptFile), loader)
await writeFile(resolve(root, 'gas/' + styleFile), '<style>\n' + css.replace(/<\/style/gi, '<\\/style') + '\n</style>\n')
console.log('GAS screen: ' + scriptFile + ', ' + styleFile)
}

await buildScreen('src/main.jsx', 'Scripts.html', 'Styles.html', 'msm-dashboard.bundle.js', 'MSMDashboard')
await buildScreen('src/weekly-main.jsx', 'Scripts2.html', 'Styles2.html', 'pgmdr-competitor.bundle.js', 'PGMDRCompetitor')
await buildScreen('src/access-main.jsx', 'Scripts3.html', 'Styles3.html', 'access-management.bundle.js', 'MSMAccess')
await buildScreen('src/logs-main.jsx', 'Scripts4.html', 'Styles4.html', 'access-logs.bundle.js', 'MSMLogs')
await buildScreen('src/list-main.jsx', 'Scripts5.html', 'Styles5.html', 'full-list.bundle.js', 'MSMFullList')
