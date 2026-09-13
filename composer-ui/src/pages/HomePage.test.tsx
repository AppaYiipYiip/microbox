import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import i18n from '../i18n/i18n'
import { HomePage } from './HomePage'

describe('HomePage', () => {
  it('renders the currently-running section, honestly empty (no backend yet)', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <HomePage />
      </I18nextProvider>,
    )
    expect(screen.getByRole('heading', { name: 'Home' })).toBeInTheDocument()
    expect(screen.getByText('Currently running')).toBeInTheDocument()
    expect(screen.getByText('Nothing is running right now.')).toBeInTheDocument()
  })
})
