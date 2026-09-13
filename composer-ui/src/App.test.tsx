import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { I18nextProvider } from 'react-i18next'
import i18n from './i18n/i18n'
import App from './App'

function renderApp(initialPath = '/') {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={[initialPath]}>
        <App />
      </MemoryRouter>
    </I18nextProvider>,
  )
}

describe('App routing', () => {
  beforeEach(() => {
    void i18n.changeLanguage('en')
  })

  it('renders the Composer page at /', () => {
    renderApp('/')
    expect(screen.getByRole('heading', { name: 'Pipeline Composer' })).toBeInTheDocument()
  })

  it('renders the History page at /history', () => {
    renderApp('/history')
    expect(screen.getByRole('heading', { name: 'Run History' })).toBeInTheDocument()
  })

  it('clicking the Run History nav link actually navigates there - a real route change, not just a second component', async () => {
    const user = userEvent.setup()
    renderApp('/')
    expect(screen.getByRole('heading', { name: 'Pipeline Composer' })).toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: 'Run History' }))

    expect(await screen.findByRole('heading', { name: 'Run History' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Pipeline Composer' })).not.toBeInTheDocument()
  })
})
