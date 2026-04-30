import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  type ReactNode,
  type Dispatch,
} from 'react'

export interface FormState {
  length: string
  height: string
  bondPattern: string
  pierType: string
  pierSize: string
  pierHeight: string
  pierSpacing: string
  cutBricks: string
  timberFence: string
  activeQuoteName: string
}

type FormAction =
  | { type: 'SET_FIELD'; field: keyof FormState; value: string }
  | { type: 'LOAD'; state: FormState }
  | { type: 'RESET' }

const initialState: FormState = {
  length: '',
  height: '',
  bondPattern: 'stretcher',
  pierType: 'none',
  pierSize: '1_5x1_5',
  pierHeight: '1.8',
  pierSpacing: '2.8',
  cutBricks: 'allowed',
  timberFence: 'none',
  activeQuoteName: '',
}

const STORAGE_KEY = 'fence-calculator-form'

function canUseStorage(): boolean {
  try {
    const consent = document.cookie
      .split('; ')
      .find((row) => row.startsWith('CookieConsent='))
    if (consent?.includes('false')) return false
    return true
  } catch {
    return false
  }
}

function loadState(): FormState {
  if (!canUseStorage()) return initialState
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      const merged = { ...initialState, ...parsed }
      return {
        length: merged.length ?? '',
        height: merged.height ?? '',
        bondPattern: merged.bondPattern || 'stretcher',
        pierType: merged.pierType || 'none',
        pierSize: merged.pierSize || '1_5x1_5',
        pierHeight: merged.pierHeight || '1.8',
        pierSpacing: merged.pierSpacing || '2.8',
        cutBricks: merged.cutBricks || 'allowed',
        timberFence: merged.timberFence || 'none',
        activeQuoteName: merged.activeQuoteName ?? '',
      }
    }
  } catch {
    // ignore
  }
  return initialState
}

function saveState(state: FormState) {
  if (!canUseStorage()) return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // ignore
  }
}

function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case 'SET_FIELD':
      return { ...state, [action.field]: action.value }
    case 'LOAD':
      return { ...action.state }
    case 'RESET':
      return { ...initialState }
    default:
      return state
  }
}

const FormContext = createContext<{
  state: FormState
  dispatch: Dispatch<FormAction>
} | null>(null)

export function FormProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(formReducer, initialState, loadState)

  useEffect(() => {
    saveState(state)
  }, [state])

  return (
    <FormContext.Provider value={{ state, dispatch }}>
      {children}
    </FormContext.Provider>
  )
}

export function useFormContext() {
  const ctx = useContext(FormContext)
  if (!ctx) throw new Error('useFormContext must be used inside FormProvider')
  return ctx
}
