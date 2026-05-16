import { describe, expect, it, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import type { ReactNode } from 'react'

import { FormProvider } from '../context/FormContext'
import { NavigationProvider } from '../navigation'
import BondPage from './BondPage'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}))

vi.mock('../components/Stepper', () => ({
  default: () => <div data-testid="stepper" />,
}))

vi.mock('../components/WizardLayout', () => ({
  default: ({
    form,
    showDiagram,
  }: {
    form: ReactNode
    showDiagram: boolean
  }) => (
    <div>
      <div data-testid="show-diagram">{String(showDiagram)}</div>
      {form}
    </div>
  ),
}))

function renderBondPage(savedState?: Record<string, string>) {
  localStorage.clear()
  document.cookie = 'CookieConsent=true'

  localStorage.setItem(
    'fence-calculator-form',
    JSON.stringify({
      length: '5',
      height: '1.8',
      brickSizeMode: 'standard',
      brickLength: '230',
      brickWidth: '110',
      brickHeight: '76',
      mortarJoint: '10',
      bondPattern: 'stretcher',
      pierType: 'none',
      pierSize: '1_5x1_5',
      pierHeight: '1.8',
      pierSpacing: '2.8',
      cutBricks: 'allowed',
      timberFence: 'none',
      activeQuoteName: '',
      ...savedState,
    }),
  )

  function TestRouter() {
    const [path, setPath] = useState('/bond')

    return (
      <FormProvider>
        <NavigationProvider navigate={setPath}>
          {path === '/cost' ? <div>cost-route</div> : <BondPage />}
        </NavigationProvider>
      </FormProvider>
    )
  }

  return render(<TestRouter />)
}

async function goToPierStep(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /common.next/i }))
  await user.click(screen.getByRole('button', { name: /common.next/i }))
}

describe('BondPage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('reveals pier options after selecting a non-none pier type', async () => {
    const user = userEvent.setup()
    renderBondPage()

    await goToPierStep(user)
    await user.click(screen.getByRole('button', { name: /pier.types.hidden/i }))

    expect(screen.getByText('pier.size')).toBeInTheDocument()
    expect(screen.getByDisplayValue('1.8')).toBeInTheDocument()
    expect(screen.getByDisplayValue('2.8')).toBeInTheDocument()
    expect(screen.getByText('pier.timberFence')).toBeInTheDocument()
  })

  it('disables unsupported hidden pier sizes for the stack bond', async () => {
    const user = userEvent.setup()
    renderBondPage()

    await user.click(screen.getByRole('button', { name: /bond.stack/i }))
    await goToPierStep(user)
    await user.click(screen.getByRole('button', { name: /pier.types.hidden/i }))

    expect(screen.getByText('pier.sizes.1_5x1').closest('button')).toBeDisabled()
    expect(screen.getByText('pier.sizes.1_5x1_5').closest('button')).toBeDisabled()
    expect(screen.getByText('pier.sizes.2x1').closest('button')).toBeEnabled()
  })

  it('blocks progress when pier spacing is wider than the allowed maximum', async () => {
    const user = userEvent.setup()
    renderBondPage({ pierType: 'hidden' })

    await goToPierStep(user)
    const spacingInput = screen.getAllByRole('spinbutton')[1]
    const nextButton = screen.getByRole('button', { name: /common.next/i })

    await user.clear(spacingInput)
    await user.type(spacingInput, '3.2')

    expect(screen.getByText('pier.spacingError')).toBeInTheDocument()
    expect(nextButton).toBeDisabled()
    expect(screen.getByTestId('show-diagram')).toHaveTextContent('false')
  })

  it('resets cutBricks to allowed when the selected bond does not support no-cut mode', async () => {
    renderBondPage({
      bondPattern: 'english',
      cutBricks: 'notAllowed',
    })

    await waitFor(() => {
      const saved = localStorage.getItem('fence-calculator-form') ?? ''
      expect(saved).toContain('"cutBricks":"allowed"')
    })
  })

  it('navigates to the cost step when the bond form is valid', async () => {
    const user = userEvent.setup()
    renderBondPage()

    await user.click(screen.getByRole('button', { name: /common.next/i }))
    await user.click(screen.getByRole('button', { name: /common.next/i }))
    await user.click(screen.getByRole('button', { name: /common.next/i }))

    expect(screen.getByText('cost-route')).toBeInTheDocument()
  })
})
