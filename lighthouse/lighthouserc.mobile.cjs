/** Lighthouse CI — perfil MOBILE (padrão do Lighthouse: Moto G Power, 4G lento, CPU 4x). */
module.exports = {
  ci: {
    collect: {
      startServerCommand: 'npx vite preview --port 4180 --strictPort',
      startServerReadyPattern: 'Local',
      url: ['http://localhost:4180/', 'http://localhost:4180/nft/emerald-ape-042'],
      numberOfRuns: 3,
      settings: { chromeFlags: '--headless=new --no-sandbox' },
    },
    assert: {
      // mediana das 3 execuções; metas do desafio
      aggregationMethod: 'median',
      assertions: {
        'categories:performance': ['warn', { minScore: 0.9 }],
        'categories:accessibility': ['error', { minScore: 0.95 }],
        'categories:best-practices': ['error', { minScore: 0.95 }],
        'categories:seo': ['error', { minScore: 0.9 }],
      },
    },
    upload: { target: 'filesystem', outputDir: 'lighthouse/reports/mobile' },
  },
}
