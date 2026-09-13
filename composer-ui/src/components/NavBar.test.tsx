import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { I18nextProvider } from 'react-i18next'
import i18n from '../i18n/i18n'
import { NavBar } from './NavBar'

function renderNavBar() {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={['/']}>
        <NavBar />
      </MemoryRouter>
    </I18nextProvider>,
  )
}

describe('NavBar', () => {
  beforeEach(() => {
    // Each test should start from a known language state - real content
    // this project has been bitten by before (docs/KNOWN_ISSUES.md's own
    // "shared state leaking between sessions" lesson, here shared between
    // tests instead of browser sessions).
    void i18n.changeLanguage('en')
  })

  it('renders both navigation links and both language buttons', () => {
    renderNavBar()
    expect(screen.getByText('Composer')).toBeInTheDocument()
    expect(screen.getByText('Run History')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'EN' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'FR' })).toBeInTheDocument()
  })

  it('EN is the active language by default, matching the fallback language', () => {
    renderNavBar()
    expect(screen.getByRole('button', { name: 'EN' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'FR' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('clicking FR actually switches the rendered UI language, not just a visual toggle state', async () => {
    const user = userEvent.setup()
    renderNavBar()

    await user.click(screen.getByRole('button', { name: 'FR' }))

    // Real content assertion, not just "the button looks active" -
    // confirms the switch actually re-renders translated text, matching
    // this project's "never assert appearance alone" standard.
    expect(await screen.findByText('Compositeur')).toBeInTheDocument()
    expect(screen.getByText('Historique des analyses')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'FR' })).toHaveAttribute('aria-pressed', 'true')
  })
})
