import { useTranslation } from 'react-i18next'

// New 2026-09-13, owner feedback: "one home page would have whats currently
// running or something like that." Honest placeholder, same pattern as
// History - there's no backend yet, so "currently running" has nothing real
// to show. Exists as a real route/page now so the shape is right when a
// backend does exist, rather than inventing fake run data to look finished.
export function HomePage() {
  const { t } = useTranslation()
  return (
    <div style={{ padding: '1.5rem', color: '#eee' }}>
      <h1>{t('home.title')}</h1>
      <section style={{ marginTop: '1.5rem' }}>
        <h2 style={{ fontSize: '1rem', color: '#ccc' }}>{t('home.currentRunsTitle')}</h2>
        <p style={{ color: '#888' }}>{t('home.currentRunsEmpty')}</p>
      </section>
      <p style={{ color: '#666', marginTop: '2rem', fontSize: '0.85rem' }}>{t('home.placeholder')}</p>
    </div>
  )
}
