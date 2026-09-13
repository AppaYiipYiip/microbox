import { useTranslation } from 'react-i18next'

// Deliberately a placeholder - PLAN.md §6.16 is requirements/prototype only.
// Exists to prove multi-page navigation actually works (a real second route,
// not just a second component), not to be a finished feature.
export function HistoryPage() {
  const { t } = useTranslation()
  return (
    <div style={{ padding: '1.5rem', color: '#eee' }}>
      <h1>{t('history.title')}</h1>
      <p style={{ color: '#999' }}>{t('history.placeholder')}</p>
    </div>
  )
}
