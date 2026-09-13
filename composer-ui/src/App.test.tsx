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

  it('renders the Home page at /', () => {
    renderApp('/')
    expect(screen.getByRole('heading', { name: 'Home' })).toBeInTheDocument()
  })

  it('renders the Composer page at /composer', () => {
    renderApp('/composer')
    expect(screen.getByRole('heading', { name: 'Pipeline Composer' })).toBeInTheDocument()
  })

  it('renders the History page at /history', () => {
    renderApp('/history')
    expect(screen.getByRole('heading', { name: 'Run History' })).toBeInTheDocument()
  })

  it('renders the Run Pipeline page at /run, embedding the real launcher via the dev-server proxy', () => {
    renderApp('/run')
    const frame = screen.getByTitle('Run Pipeline')
    expect(frame.tagName).toBe('IFRAME')
    expect(frame).toHaveAttribute('src', '/run-app')
  })

  it('clicking Composer in the left page nav actually navigates there - a real route change', async () => {
    const user = userEvent.setup()
    renderApp('/')
    expect(screen.getByRole('heading', { name: 'Home' })).toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: 'Composer' }))

    expect(await screen.findByRole('heading', { name: 'Pipeline Composer' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Home' })).not.toBeInTheDocument()
  })

  it('clicking Run History in the left page nav navigates there', async () => {
    const user = userEvent.setup()
    renderApp('/')

    await user.click(screen.getByRole('link', { name: 'Run History' }))

    expect(await screen.findByRole('heading', { name: 'Run History' })).toBeInTheDocument()
  })

  it('clicking Run Pipeline in the left page nav navigates there', async () => {
    const user = userEvent.setup()
    renderApp('/')

    await user.click(screen.getByRole('link', { name: 'Run Pipeline' }))

    expect(await screen.findByTitle('Run Pipeline')).toBeInTheDocument()
  })
})
