import { describe, expect, it, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { FormProvider, useFormContext } from './FormContext'

function ContextConsumer() {
  const { state, dispatch } = useFormContext()

  return (
    <div>
      <div data-testid="length">{state.length}</div>
      <div data-testid="bondPattern">{state.bondPattern}</div>
      <div data-testid="brickSizeMode">{state.brickSizeMode}</div>
      <button
        type="button"
        onClick={() => dispatch({ type: 'SET_FIELD', field: 'length', value: '12.5' })}
      >
        set length
      </button>
      <button
        type="button"
        onClick={() => dispatch({ type: 'RESET' })}
      >
        reset
      </button>
    </div>
  )
}

describe('FormProvider', () => {
  beforeEach(() => {
    localStorage.clear()
    document.cookie = 'CookieConsent=true'
  })

  it('provides the default form state when no saved state exists', () => {
    render(
      <FormProvider>
        <ContextConsumer />
      </FormProvider>,
    )

    expect(screen.getByTestId('length')).toHaveTextContent('')
    expect(screen.getByTestId('bondPattern')).toHaveTextContent('stretcher')
    expect(screen.getByTestId('brickSizeMode')).toHaveTextContent('standard')
  })

  it('loads saved form state from localStorage when cookie consent allows storage', () => {
    localStorage.setItem(
      'fence-calculator-form',
      JSON.stringify({
        length: '8.5',
        bondPattern: 'stack',
        brickSizeMode: 'custom',
      }),
    )

    render(
      <FormProvider>
        <ContextConsumer />
      </FormProvider>,
    )

    expect(screen.getByTestId('length')).toHaveTextContent('8.5')
    expect(screen.getByTestId('bondPattern')).toHaveTextContent('stack')
    expect(screen.getByTestId('brickSizeMode')).toHaveTextContent('custom')
  })

  it('ignores saved state when cookie consent disables storage', () => {
    localStorage.setItem(
      'fence-calculator-form',
      JSON.stringify({
        length: '8.5',
        bondPattern: 'stack',
      }),
    )
    document.cookie = 'CookieConsent=false'

    render(
      <FormProvider>
        <ContextConsumer />
      </FormProvider>,
    )

    expect(screen.getByTestId('length')).toHaveTextContent('')
    expect(screen.getByTestId('bondPattern')).toHaveTextContent('stretcher')
  })

  it('persists field updates to localStorage when storage is allowed', async () => {
    const user = userEvent.setup()

    render(
      <FormProvider>
        <ContextConsumer />
      </FormProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'set length' }))

    await waitFor(() => {
      expect(localStorage.getItem('fence-calculator-form')).toContain('"length":"12.5"')
    })
  })

  it('resets the form state back to defaults', async () => {
    const user = userEvent.setup()

    render(
      <FormProvider>
        <ContextConsumer />
      </FormProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'set length' }))
    await user.click(screen.getByRole('button', { name: 'reset' }))

    expect(screen.getByTestId('length')).toHaveTextContent('')
    expect(screen.getByTestId('bondPattern')).toHaveTextContent('stretcher')
  })
})
