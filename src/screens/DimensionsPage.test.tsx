import { describe, expect, it, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import type { ReactNode } from 'react'

import { FormProvider } from '../context/FormContext'
import { NavigationProvider } from '../navigation'
import DimensionsPage from './DimensionsPage'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      if (key === 'dimensions.maxHeightError') return `dimensions.maxHeightError:${options?.max}`
      if (key === 'dimensions.cutBrickMinimumHint') return `dimensions.cutBrickMinimumHint:${options?.min}`
      return key
    },
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

function renderDimensionsPage(savedState?: Record<string, string>) {
  localStorage.clear()
  document.cookie = 'CookieConsent=true'

  if (savedState) {
    localStorage.setItem(
      'fence-calculator-form',
      JSON.stringify({
        length: '',
        height: '',
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
  }

  function TestRouter() {
    const [path, setPath] = useState('/dimensions')

    return (
      <FormProvider>
        <NavigationProvider navigate={setPath}>
          {path === '/bond' ? <div>bond-route</div> : <DimensionsPage />}
        </NavigationProvider>
      </FormProvider>
    )
  }

  return render(<TestRouter />)
}

describe('DimensionsPage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  function getNextButton() {
    return screen.getByRole('button', { name: /common.next/i })
  }

  it('keeps the next button disabled until valid wall dimensions are entered', async () => {
    const user = userEvent.setup()
    renderDimensionsPage()

    const nextButton = getNextButton()
    const inputs = screen.getAllByRole('spinbutton')

    expect(nextButton).toBeDisabled()

    await user.type(inputs[0], '5')
    await user.type(inputs[1], '1.8')

    expect(nextButton).toBeDisabled()
    expect(screen.getByTestId('show-diagram')).toHaveTextContent('false')

    await user.click(screen.getByText('dimensions.standardBrick'))

    expect(nextButton).toBeEnabled()
    expect(screen.getByTestId('show-diagram')).toHaveTextContent('true')
  })

  it('shows an error and blocks progress when the wall height exceeds the allowed maximum', async () => {
    const user = userEvent.setup()
    renderDimensionsPage()

    const inputs = screen.getAllByRole('spinbutton')
    const nextButton = getNextButton()

    await user.type(inputs[0], '5')
    await user.type(inputs[1], '2.5')

    expect(screen.getByText('dimensions.maxHeightError:2')).toBeInTheDocument()
    expect(nextButton).toBeDisabled()
    expect(screen.getByTestId('show-diagram')).toHaveTextContent('false')
  })

  it('updates the paired brick length when a custom brick width is entered', async () => {
    const user = userEvent.setup()
    renderDimensionsPage()

    await user.click(screen.getByText('dimensions.customBrick'))

    const inputs = screen.getAllByRole('spinbutton')
    const brickLengthInput = inputs[2]
    const brickWidthInput = inputs[3]

    await user.clear(brickWidthInput)
    await user.type(brickWidthInput, '120')

    expect(brickLengthInput).toHaveValue(250)
  })

  it('navigates to the bond step when the form is valid and next is clicked', async () => {
    const user = userEvent.setup()
    renderDimensionsPage()

    const inputs = screen.getAllByRole('spinbutton')

    await user.type(inputs[0], '5')
    await user.type(inputs[1], '1.8')
    await user.click(screen.getByText('dimensions.standardBrick'))
    await user.click(getNextButton())

    expect(screen.getByText('bond-route')).toBeInTheDocument()
  })
})
