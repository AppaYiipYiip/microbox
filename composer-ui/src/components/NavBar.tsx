import { NavLink } from 'react-router'
import { useTranslation } from 'react-i18next'
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '../i18n/i18n'
import './NavBar.css'

// PLAN.md §6.16: "a persistent navigation menu between different pages" is a
// must-have, and the language toggle lives here too since it needs to be
// reachable from every page, not just one.
export function NavBar() {
  const { t, i18n } = useTranslation()

  function setLanguage(lang: SupportedLanguage) {
    void i18n.changeLanguage(lang)
  }

  return (
    <nav className="navbar" aria-label="Main navigation">
      <span className="navbar__brand">{t('nav.brand')}</span>
      <div className="navbar__links">
        <NavLink to="/" end className={({ isActive }) => (isActive ? 'navbar__link navbar__link--active' : 'navbar__link')}>
          {t('nav.composer')}
        </NavLink>
        <NavLink to="/history" className={({ isActive }) => (isActive ? 'navbar__link navbar__link--active' : 'navbar__link')}>
          {t('nav.history')}
        </NavLink>
      </div>
      <div className="navbar__lang" role="group" aria-label="Language">
        {SUPPORTED_LANGUAGES.map((lang) => (
          <button
            key={lang}
            type="button"
            className={i18n.resolvedLanguage === lang ? 'navbar__lang-btn navbar__lang-btn--active' : 'navbar__lang-btn'}
            aria-pressed={i18n.resolvedLanguage === lang}
            onClick={() => setLanguage(lang)}
          >
            {lang.toUpperCase()}
          </button>
        ))}
      </div>
    </nav>
  )
}
