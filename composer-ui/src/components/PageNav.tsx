import { NavLink } from 'react-router'
import { useTranslation } from 'react-i18next'
import './PageNav.css'

// Left-side page navigation - corrected 2026-09-13 after owner feedback on
// the first prototype pass: pages navigate from the LEFT, the node palette
// belongs on the RIGHT (this file's counterpart is NodePalette, now
// rendered from ComposerPage on the right side of the canvas). The
// original prototype had this backwards (a single top bar, palette on the
// left) - this is a correction of a real misreading of the original
// request, not new scope.
const PAGES = [
  { to: '/', key: 'nav.home', end: true },
  { to: '/composer', key: 'nav.composer', end: false },
  { to: '/history', key: 'nav.history', end: false },
] as const

export function PageNav() {
  const { t } = useTranslation()

  return (
    <nav className="page-nav" aria-label="Page navigation">
      {PAGES.map((page) => (
        <NavLink
          key={page.to}
          to={page.to}
          end={page.end}
          className={({ isActive }) => (isActive ? 'page-nav__link page-nav__link--active' : 'page-nav__link')}
        >
          {t(page.key)}
        </NavLink>
      ))}
    </nav>
  )
}
