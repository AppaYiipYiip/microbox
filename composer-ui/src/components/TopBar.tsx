import { useTranslation } from 'react-i18next'
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '../i18n/i18n'
import './TopBar.css'

// Brand + language toggle only - page links live in PageNav (left sidebar)
// now, corrected 2026-09-13 after owner feedback. Stays a top strip rather
// than folding into PageNav so the language toggle is reachable without
// scrolling the (potentially longer, later) page list.
export function TopBar() {
  const { t, i18n } = useTranslation()

  function setLanguage(lang: SupportedLanguage) {
    void i18n.changeLanguage(lang)
  }

  return (
    <header className="top-bar">
      <span className="top-bar__brand">{t('nav.brand')}</span>
      <div className="top-bar__lang" role="group" aria-label="Language">
        {SUPPORTED_LANGUAGES.map((lang) => (
          <button
            key={lang}
            type="button"
            className={i18n.resolvedLanguage === lang ? 'top-bar__lang-btn top-bar__lang-btn--active' : 'top-bar__lang-btn'}
            aria-pressed={i18n.resolvedLanguage === lang}
            onClick={() => setLanguage(lang)}
          >
            {lang.toUpperCase()}
          </button>
        ))}
      </div>
    </header>
  )
}
