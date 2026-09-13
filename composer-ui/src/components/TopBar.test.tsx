import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nextProvider } from 'react-i18next'
import i18n from '../i18n/i18n'
import { TopBar } from './TopBar'

function renderTopBar() {
  return render(
    <I18nextProvider i18n={i18n}>
      <TopBar />
    </I18nextProvider>,
  )
}

describe('TopBar', () => {
  beforeEach(() => {
    void i18n.changeLanguage('en')
  })

  it('renders both language buttons, EN active by default', () => {
    renderTopBar()
    expect(screen.getByRole('button', { name: 'EN' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'FR' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('clicking FR actually switches the rendered language, not just the button state', async () => {
    const user = userEvent.setup()
    renderTopBar()

    await user.click(screen.getByRole('button', { name: 'FR' }))

    expect(await screen.findByText('microbox compositeur')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'FR' })).toHaveAttribute('aria-pressed', 'true')
  })
})
