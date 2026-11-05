// Lê os relatórios JSON do Lighthouse CI e gera lighthouse/RESULTS.md com a MEDIANA de 3 execuções.
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]
}
const rows = []
let meta = null
for (const profile of ['mobile', 'desktop']) {
  const dir = join('lighthouse', 'reports', profile)
  if (!existsSync(dir)) continue
  const byUrl = {}
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.json') && f.startsWith('localhost'))) {
    const lhr = JSON.parse(readFileSync(join(dir, f), 'utf8'))
    meta ??= { lighthouse: lhr.lighthouseVersion, ua: lhr.environment?.hostUserAgent, fetchTime: lhr.fetchTime }
    const page = new URL(lhr.finalDisplayedUrl ?? lhr.requestedUrl).pathname
    ;(byUrl[page] ??= []).push(lhr)
  }
  for (const [page, runs] of Object.entries(byUrl)) {
    const cat = (k) => Math.round(median(runs.map((r) => r.categories[k].score)) * 100)
    const audit = (k) => median(runs.map((r) => r.audits[k].numericValue))
    rows.push({
      profile,
      page,
      runs: runs.length,
      perf: cat('performance'),
      a11y: cat('accessibility'),
      bp: cat('best-practices'),
      seo: cat('seo'),
      lcp: (audit('largest-contentful-paint') / 1000).toFixed(2) + ' s',
      cls: audit('cumulative-layout-shift').toFixed(3),
      tbt: Math.round(audit('total-blocking-time')) + ' ms',
    })
  }
}
const md = [
  '# Resultados do Lighthouse (mediana de 3 execuções)',
  '',
  `Lighthouse ${meta?.lighthouse ?? '?'} · build de produção (\`vite preview\`) · cenário padrão do mock · ${meta?.fetchTime ?? ''}`,
  '',
  '| Perfil | Página | Execuções | Performance | Acessibilidade | Boas práticas | SEO | LCP | CLS | TBT |',
  '|---|---|---|---|---|---|---|---|---|---|',
  ...rows.map((r) => `| ${r.profile} | \`${r.page}\` | ${r.runs} | ${r.perf} | ${r.a11y} | ${r.bp} | ${r.seo} | ${r.lcp} | ${r.cls} | ${r.tbt} |`),
  '',
  `Ambiente: ${meta?.ua ?? ''}`,
  '',
  'Relatórios HTML e JSON de cada execução: `lighthouse/reports/<perfil>/`.',
  '',
].join('\n')
// anexa a análise escrita à mão (causas, condições e o que foi feito)
const analysis = existsSync(join('lighthouse', 'ANALYSIS.md')) ? readFileSync(join('lighthouse', 'ANALYSIS.md'), 'utf8') : ''
writeFileSync(join('lighthouse', 'RESULTS.md'), md + '\n' + analysis)
console.log(md)
