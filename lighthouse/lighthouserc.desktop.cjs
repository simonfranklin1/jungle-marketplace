/** Lighthouse CI — perfil DESKTOP (preset oficial "desktop"). */
const mobile = require('./lighthouserc.mobile.cjs')

module.exports = {
  ci: {
    ...mobile.ci,
    collect: { ...mobile.ci.collect, settings: { ...mobile.ci.collect.settings, preset: 'desktop' } },
    upload: { target: 'filesystem', outputDir: 'lighthouse/reports/desktop' },
  },
}
