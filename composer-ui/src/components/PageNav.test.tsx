import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { I18nextProvider } from 'react-i18next'
import i18n from '../i18n/i18n'
import { PageNav } from './PageNav'

function renderPageNav(initialPath = '/') {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={[initialPath]}>
        <PageNav />
      </MemoryRouter>
    </I18nextProvider>,
  )
}

describe('PageNav', () => {
  it('renders links for all four pages: Home, Composer, Run Pipeline, Run History', () => {
    renderPageNav()
    expect(screen.getByRole('link', { name: 'Home' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Composer' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Run Pipeline' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Run History' })).toBeInTheDocument()
  })

  it('marks the current page as active', () => {
    renderPageNav('/composer')
    expect(screen.getByRole('link', { name: 'Composer' })).toHaveClass('page-nav__link--active')
    expect(screen.getByRole('link', { name: 'Home' })).not.toHaveClass('page-nav__link--active')
  })
})
