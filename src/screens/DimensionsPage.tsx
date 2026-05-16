import { useTranslation } from 'react-i18next'
import Stepper from '../components/Stepper'
import WizardLayout from '../components/WizardLayout'
import { useFormContext } from '../context/FormContext'
import { useAppNavigate } from '../navigation'
import {
  DEFAULT_BRICK_DIMENSIONS,
  MIN_BRICK_WIDTH,
  MIN_CUT_BRICK_DIMENSION,
  brickDimensionsFromStrings,
  validateBrickDimensions,
} from '../bonds/brickDimensions'

const MAX_HEIGHT = 2
const MAX_LENGTH = 30
const MAX_LENGTH_DECIMALS = 3

export default function DimensionsPage() {
  const navigate = useAppNavigate()
  const { t } = useTranslation()
  const { state, dispatch } = useFormContext()

  const length = parseFloat(state.length) || 0
  const height = parseFloat(state.height) || 0
  const brickDimensions = brickDimensionsFromStrings(state)
  const brickDimensionsValid = validateBrickDimensions(brickDimensions)
  const usingCustomBrickSize = state.brickSizeMode === 'custom'
  const heightTooHigh = height > MAX_HEIGHT
  const canProceed = length > 0 && height > 0 && !heightTooHigh && brickDimensionsValid

  const setStandardBrickSize = () => {
    dispatch({ type: 'SET_FIELD', field: 'brickSizeMode', value: 'standard' })
    dispatch({
      type: 'SET_FIELD',
      field: 'brickLength',
      value: DEFAULT_BRICK_DIMENSIONS.length.toString(),
    })
    dispatch({
      type: 'SET_FIELD',
      field: 'brickWidth',
      value: DEFAULT_BRICK_DIMENSIONS.width.toString(),
    })
    dispatch({
      type: 'SET_FIELD',
      field: 'brickHeight',
      value: DEFAULT_BRICK_DIMENSIONS.height.toString(),
    })
    dispatch({
      type: 'SET_FIELD',
      field: 'mortarJoint',
      value: DEFAULT_BRICK_DIMENSIONS.mortar.toString(),
    })
  }

  const formatDimensionValue = (value: number) => {
    if (!Number.isFinite(value)) return ''
    return Number.isInteger(value) ? value.toString() : value.toFixed(2).replace(/\.?0+$/, '')
  }

  const normalizeLengthInput = (value: string) => {
    if (value === '') return ''
    if (!/^\d*\.?\d*$/.test(value)) return state.length

    const [integerPart, decimalPart] = value.split('.')
    const trimmedDecimal =
      decimalPart === undefined
        ? undefined
        : decimalPart.slice(0, MAX_LENGTH_DECIMALS)
    const normalized =
      trimmedDecimal === undefined
        ? integerPart
        : `${integerPart}.${trimmedDecimal}`
    const numericValue = parseFloat(normalized)

    if (Number.isFinite(numericValue) && numericValue > MAX_LENGTH) {
      return MAX_LENGTH.toString()
    }

    return normalized
  }

  const handleBrickFieldChange = (
    field: 'brickLength' | 'brickWidth' | 'brickHeight' | 'mortarJoint',
    value: string,
  ) => {
    dispatch({ type: 'SET_FIELD', field, value })

    const numericValue = parseFloat(value)
    const mortar = parseFloat(state.mortarJoint) || DEFAULT_BRICK_DIMENSIONS.mortar

    if (!Number.isFinite(numericValue) || numericValue <= 0) return

    if (field === 'brickLength') {
      const calculatedWidth = (numericValue - mortar) / 2
      if (calculatedWidth >= MIN_BRICK_WIDTH) {
        dispatch({
          type: 'SET_FIELD',
          field: 'brickWidth',
          value: formatDimensionValue(calculatedWidth),
        })
      }
    }

    if (field === 'brickWidth') {
      dispatch({
        type: 'SET_FIELD',
        field: 'brickLength',
        value: formatDimensionValue(numericValue * 2 + mortar),
      })
    }
  }

  const brickFields = [
    { field: 'brickLength' as const, label: t('dimensions.brickLength') },
    { field: 'brickWidth' as const, label: t('dimensions.brickWidth') },
    { field: 'brickHeight' as const, label: t('dimensions.brickHeight') },
    { field: 'mortarJoint' as const, label: t('dimensions.mortarJoint') },
  ]

  const form = (
    <div className="bg-white rounded-2xl shadow-sm border border-border p-8">
      <h1 className="text-2xl font-bold text-text mb-2">
        {t('dimensions.heading')}
      </h1>
      <p className="text-text-muted mb-8">{t('dimensions.description')}</p>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-text mb-2">
            {t('dimensions.length')} ({t('dimensions.unit')})
          </label>
          <input
            type="number"
            min="0.1"
            max={MAX_LENGTH}
            step="0.001"
            value={state.length}
            onChange={(e) =>
              dispatch({
                type: 'SET_FIELD',
                field: 'length',
                value: normalizeLengthInput(e.target.value),
              })
            }
            placeholder={t('dimensions.lengthPlaceholder')}
            className="w-full px-4 py-3 rounded-xl border border-border bg-surface-alt focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors text-text"
          />
          <p className="mt-1.5 text-xs text-text-muted">
            {t('dimensions.lengthHint', { max: MAX_LENGTH })}
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-text mb-2">
            {t('dimensions.height')} ({t('dimensions.unit')})
          </label>
          <input
            type="number"
            min="0.1"
            max={MAX_HEIGHT}
            step="0.1"
            value={state.height}
            onChange={(e) =>
              dispatch({ type: 'SET_FIELD', field: 'height', value: e.target.value })
            }
            placeholder={t('dimensions.heightPlaceholder')}
            className={`w-full px-4 py-3 rounded-xl border bg-surface-alt focus:outline-none focus:ring-2 transition-colors text-text ${
              heightTooHigh
                ? 'border-red-400 focus:ring-red-200 focus:border-red-400'
                : 'border-border focus:ring-primary/30 focus:border-primary'
            }`}
          />
          {heightTooHigh && (
            <p className="mt-1.5 text-xs text-red-500">
              {t('dimensions.maxHeightError', { max: MAX_HEIGHT })}
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-surface-alt/60 p-5">
          <h2 className="text-base font-semibold text-text">
            {t('dimensions.brickSizeHeading')}
          </h2>
          <p className="mt-1 text-sm text-text-muted">
            {t('dimensions.brickSizeDescription')}
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={setStandardBrickSize}
              className={`rounded-xl border p-4 text-left transition-colors cursor-pointer ${
                !usingCustomBrickSize
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-gray-300 hover:bg-white'
              }`}
            >
              <div className="font-semibold text-text">{t('dimensions.standardBrick')}</div>
              <div className="mt-1 text-xs text-text-muted">
                {t('dimensions.standardBrickDesc')}
              </div>
            </button>
            <button
              type="button"
              onClick={() =>
                dispatch({ type: 'SET_FIELD', field: 'brickSizeMode', value: 'custom' })
              }
              className={`rounded-xl border p-4 text-left transition-colors cursor-pointer ${
                usingCustomBrickSize
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-gray-300 hover:bg-white'
              }`}
            >
              <div className="font-semibold text-text">{t('dimensions.customBrick')}</div>
              <div className="mt-1 text-xs text-text-muted">
                {t('dimensions.customBrickDesc')}
              </div>
            </button>
          </div>

          {!usingCustomBrickSize && (
            <p className="mt-3 text-xs text-text-muted">
              {t('dimensions.standardBrickSummary')}
            </p>
          )}
          {usingCustomBrickSize && (
            <>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                {brickFields.map(({ field, label }) => (
                  <div key={field}>
                    <label className="block text-sm font-medium text-text mb-2">
                      {label} ({t('dimensions.mmUnit')})
                    </label>
                    <input
                      type="number"
                      min={field === 'brickWidth' ? MIN_BRICK_WIDTH : 1}
                      step="1"
                      value={state[field]}
                      onChange={(e) =>
                        handleBrickFieldChange(field, e.target.value)
                      }
                      className={`w-full px-4 py-3 rounded-xl border bg-white focus:outline-none focus:ring-2 transition-colors text-text ${
                        !brickDimensionsValid
                          ? 'border-red-400 focus:ring-red-200 focus:border-red-400'
                          : 'border-border focus:ring-primary/30 focus:border-primary'
                      }`}
                    />
                  </div>
                ))}
              </div>

              <p className="mt-3 text-xs text-text-muted">
                {t('dimensions.brickSizeRule')}
              </p>
              {!brickDimensionsValid && (
                <p className="mt-1.5 text-xs text-red-500">
                  {t('dimensions.brickSizeError')}
                </p>
              )}
            </>
          )}
          <div className="mt-4 rounded-xl border border-border bg-white p-4 text-xs leading-relaxed text-text-muted">
            {t('dimensions.cutBrickMinimumHint', {
              min: MIN_CUT_BRICK_DIMENSION,
            })}
          </div>
        </div>
      </div>

      <div className="flex justify-between mt-10">
        <button
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-2 text-text-muted hover:text-text font-medium py-3 px-6 rounded-xl transition-colors cursor-pointer"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 17l-5-5m0 0l5-5m-5 5h12" />
          </svg>
          {t('common.back')}
        </button>
        <button
          onClick={() => navigate('/bond')}
          disabled={!canProceed}
          className="inline-flex items-center gap-2 bg-primary hover:bg-primary-dark disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-3 px-8 rounded-xl transition-colors shadow-sm cursor-pointer"
        >
          {t('common.next')}
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex flex-col items-center">
      <Stepper currentStep={1} />
      <WizardLayout
        form={form}
        lengthM={length}
        heightM={height}
        bondPattern={undefined}
        pierType={state.pierType}
        pierSize={state.pierSize}
        pierHeightM={parseFloat(state.pierHeight) || 0}
        pierSpacingM={parseFloat(state.pierSpacing) || 0}
        cutBricks={state.cutBricks}
        timberFence={state.timberFence}
        brickDimensions={brickDimensions}
        showDiagram={length > 0 && height > 0 && !heightTooHigh && brickDimensionsValid}
      />
    </div>
  )
}
