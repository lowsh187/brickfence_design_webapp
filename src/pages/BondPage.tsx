import { useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Stepper from '../components/Stepper'
import WizardLayout from '../components/WizardLayout'
import { useFormContext } from '../context/FormContext'
import { allBonds } from '../bonds/registry'
import {
  brickDimensionsFromStrings,
  validateBrickDimensions,
} from '../bonds/brickDimensions'

const ALL_PIER_SIZES = ['1_5x1', '1_5x1_5', '2x1', '2x2'] as const
const STACK_HIDDEN_PIER_SUPPORTED_SIZES = ['2x1', '2x2']
const STRETCHER_HIDDEN_PIER_SUPPORTED_SIZES = ['1_5x1', '1_5x1_5', '2x1', '2x2']
const TWO_BY_TWO_ONLY_PIER_SIZES = ['2x2']

function supportedPierSizes(bondPattern: string, pierType: string): string[] {
  if (pierType === 'hidden' && bondPattern === 'stack') return STACK_HIDDEN_PIER_SUPPORTED_SIZES
  if (pierType === 'hidden' && bondPattern === 'stretcher') {
    return STRETCHER_HIDDEN_PIER_SUPPORTED_SIZES
  }
  if (
    pierType === 'exposed' &&
    (bondPattern === 'stack' || bondPattern === 'stretcher')
  ) {
    return TWO_BY_TWO_ONLY_PIER_SIZES
  }
  return [...ALL_PIER_SIZES]
}

function pierSizeUnavailableMessageKey(bondPattern: string, pierType: string): string {
  if (pierType === 'hidden' && bondPattern === 'stack') return 'pier.stackHiddenSizeUnavailable'
  if (pierType === 'hidden' && bondPattern === 'stretcher') {
    return 'pier.stretcherHiddenSizeUnavailable'
  }
  if (
    pierType === 'exposed' &&
    (bondPattern === 'stack' || bondPattern === 'stretcher')
  ) {
    return 'pier.exposedSizeUnavailable'
  }
  return 'pier.hiddenSizeUnavailable'
}

export default function BondPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { state, dispatch } = useFormContext()

  const bonds = allBonds()
  const canProceed = !!state.bondPattern && bonds.some((b) => b.id === state.bondPattern)

  const length = parseFloat(state.length) || 0
  const height = parseFloat(state.height) || 0
  const brickDimensions = brickDimensionsFromStrings(state)
  const brickDimensionsValid = validateBrickDimensions(brickDimensions)
  const showPierSize = state.pierType !== 'none'
  const showPierHeight = state.pierType !== 'none'
  const pierHeight = parseFloat(state.pierHeight) || 0
  const pierSpacing = parseFloat(state.pierSpacing) || 0
  const showPierSpacing = state.pierType !== 'none'
  const showInfill = state.pierType !== 'none'
  const spacingTooWide = showPierSpacing && pierSpacing > 3
  const canRenderPierPreview = length > 0 && height > 0 && !spacingTooWide && brickDimensionsValid
  const hasSelectedBond = bonds.some((b) => b.id === state.bondPattern)
  const noCutAvailable = state.bondPattern === 'stretcher' || state.bondPattern === 'stack'
  const currentSupportedPierSizes = useMemo(
    () => supportedPierSizes(state.bondPattern, state.pierType),
    [state.bondPattern, state.pierType],
  )
  useEffect(() => {
    if (!noCutAvailable && state.cutBricks === 'notAllowed') {
      dispatch({ type: 'SET_FIELD', field: 'cutBricks', value: 'allowed' })
    }
  }, [dispatch, noCutAvailable, state.cutBricks])

  useEffect(() => {
    if (state.pierType !== 'none' && !currentSupportedPierSizes.includes(state.pierSize)) {
      dispatch({
        type: 'SET_FIELD',
        field: 'pierSize',
        value: currentSupportedPierSizes[0] ?? '1_5x1_5',
      })
    }
  }, [currentSupportedPierSizes, dispatch, state.pierSize, state.pierType])

  const form = (
    <div className="bg-white rounded-2xl shadow-sm border border-border p-8">
      <h1 className="text-2xl font-bold text-text mb-2">{t('bond.heading')}</h1>
      <p className="text-text-muted mb-8">{t('bond.description')}</p>

      <div>
        <h2 className="text-base font-semibold text-text">{t('bond.heading')}</h2>
        <p className="mt-1 text-sm text-text-muted">{t('bond.description')}</p>

        <div className="mt-5 space-y-3">
          {bonds.map((bond) => {
            const selected = state.bondPattern === bond.id
            return (
              <button
                key={bond.id}
                type="button"
                onClick={() =>
                  dispatch({ type: 'SET_FIELD', field: 'bondPattern', value: bond.id })
                }
                className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-colors cursor-pointer text-left ${
                  selected
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-gray-300 hover:bg-surface-alt'
                }`}
              >
                <div
                  className="w-16 h-8 rounded overflow-hidden flex-shrink-0 border border-border/50"
                  dangerouslySetInnerHTML={{ __html: bond.iconSvg }}
                />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-text">{t(bond.nameKey)}</div>
                  <div className="text-xs text-text-muted mt-0.5">{t(bond.descKey)}</div>
                </div>
                <div
                  className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                    selected ? 'border-primary' : 'border-gray-300'
                  }`}
                >
                  {selected && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      <div className="mt-8 rounded-2xl border border-border bg-surface-alt/60 p-5">
        <h2 className="text-base font-semibold text-text">{t('pier.heading')}</h2>
        <p className="mt-1 text-sm text-text-muted">{t('pier.description')}</p>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {(['none', 'hidden', 'exposed'] as const).map((pierType) => {
            const selected = state.pierType === pierType
            return (
              <button
                key={pierType}
                type="button"
                onClick={() =>
                  dispatch({ type: 'SET_FIELD', field: 'pierType', value: pierType })
                }
                className={`rounded-xl border p-4 text-left transition-colors cursor-pointer ${
                  selected
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-gray-300 hover:bg-white'
                }`}
              >
                <div className="font-semibold text-text">{t(`pier.types.${pierType}`)}</div>
                <div className="mt-1 text-xs text-text-muted">
                  {t(`pier.typeDesc.${pierType}`)}
                </div>
              </button>
            )
          })}
        </div>

        {showPierSize && (
          <div className="mt-5">
            <label className="block text-sm font-medium text-text mb-2">
              {t('pier.size')}
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              {ALL_PIER_SIZES.map((size) => {
                const selected = state.pierSize === size
                const disabled = !currentSupportedPierSizes.includes(size)
                const unavailableMessage = t(
                  pierSizeUnavailableMessageKey(state.bondPattern, state.pierType),
                )
                return (
                  <button
                    key={size}
                    type="button"
                    disabled={disabled}
                    title={disabled ? unavailableMessage : undefined}
                    onClick={() =>
                      !disabled &&
                      dispatch({ type: 'SET_FIELD', field: 'pierSize', value: size })
                    }
                    className={`rounded-xl border p-4 text-left transition-colors cursor-pointer ${
                      disabled
                        ? 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
                        : selected
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-gray-300 hover:bg-white'
                    }`}
                  >
                    <div className={`font-semibold ${disabled ? 'text-gray-400' : 'text-text'}`}>
                      {t(`pier.sizes.${size}`)}
                    </div>
                    <div className={`mt-1 text-xs ${disabled ? 'text-gray-400' : 'text-text-muted'}`}>
                      {t(`pier.sizeDesc.${size}`)}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {showPierHeight && (
          <div className="mt-5">
            <label className="block text-sm font-medium text-text mb-2">
              {t('pier.height')} ({t('dimensions.unit')})
            </label>
            <input
              type="number"
              min={Math.max(0.5, height).toFixed(1)}
              max="3"
              step="0.1"
              value={state.pierHeight}
              onChange={(e) =>
                dispatch({ type: 'SET_FIELD', field: 'pierHeight', value: e.target.value })
              }
              className="w-full px-4 py-3 rounded-xl border bg-white focus:outline-none focus:ring-2 transition-colors text-text border-border focus:ring-primary/30 focus:border-primary"
            />
            <p className="mt-1.5 text-xs text-text-muted">{t('pier.heightHint')}</p>
          </div>
        )}

        {showPierSpacing && (
          <div className="mt-5">
            <label className="block text-sm font-medium text-text mb-2">
              {t('pier.spacing')} ({t('dimensions.unit')})
            </label>
            <input
              type="number"
              min="0.24"
              max="3"
              step="0.24"
              value={state.pierSpacing}
              onChange={(e) =>
                dispatch({ type: 'SET_FIELD', field: 'pierSpacing', value: e.target.value })
              }
              className={`w-full px-4 py-3 rounded-xl border bg-white focus:outline-none focus:ring-2 transition-colors text-text ${
                spacingTooWide
                  ? 'border-red-400 focus:ring-red-200 focus:border-red-400'
                  : 'border-border focus:ring-primary/30 focus:border-primary'
              }`}
            />
            <p className="mt-1.5 text-xs text-text-muted">{t('pier.spacingHint')}</p>
            {spacingTooWide && (
              <p className="mt-1.5 text-xs text-red-500">{t('pier.spacingError')}</p>
            )}
          </div>
        )}
      </div>

      {showInfill && (
        <div className="mt-8 rounded-2xl border border-border bg-surface-alt/60 p-5">
          <h2 className="text-base font-semibold text-text">{t('pier.timberFence')}</h2>
          <p className="mt-1 text-sm text-text-muted">{t('pier.timberFenceHint')}</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {(['none', 'timber', 'pvc'] as const).map((option) => {
              const selected = state.timberFence === option
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() =>
                    dispatch({ type: 'SET_FIELD', field: 'timberFence', value: option })
                  }
                  className={`rounded-xl border p-4 text-left transition-colors cursor-pointer ${
                    selected
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-gray-300 hover:bg-white'
                  }`}
                >
                  <div className="font-semibold text-text">
                    {t(`pier.timberFenceOptions.${option}`)}
                  </div>
                  <div className="mt-1 text-xs text-text-muted">
                    {t(`pier.timberFenceDesc.${option}`)}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {hasSelectedBond && (
        <div className="mt-8 rounded-2xl border border-border bg-surface-alt/60 p-5">
          <h2 className="text-base font-semibold text-text">{t('cutBricks.heading')}</h2>
          <p className="mt-1 text-sm text-text-muted">{t('cutBricks.description')}</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {(['allowed', 'notAllowed'] as const).map((option) => {
              const selected = state.cutBricks === option
              const disabled = option === 'notAllowed' && !noCutAvailable
              return (
                <button
                  key={option}
                  type="button"
                  disabled={disabled}
                    title={disabled ? t('cutBricks.noCutUnavailable') : undefined}
                  onClick={() =>
                    !disabled &&
                    dispatch({ type: 'SET_FIELD', field: 'cutBricks', value: option })
                  }
                  className={`rounded-xl border p-4 text-left transition-colors ${
                    disabled
                      ? 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
                      : selected
                      ? 'border-primary bg-primary/5 cursor-pointer'
                      : 'border-border hover:border-gray-300 hover:bg-white cursor-pointer'
                  }`}
                >
                  <div className="font-semibold">{t(`cutBricks.options.${option}`)}</div>
                  <div className={`mt-1 text-xs ${disabled ? 'text-gray-400' : 'text-text-muted'}`}>
                    {t(`cutBricks.optionDesc.${option}`)}
                  </div>
                </button>
              )
            })}
          </div>
          <p className="mt-3 text-xs text-text-muted italic">{t('cutBricks.note')}</p>
        </div>
      )}

      <div className="flex justify-between mt-10">
        <button
          onClick={() => navigate('/dimensions')}
          className="inline-flex items-center gap-2 text-text-muted hover:text-text font-medium py-3 px-6 rounded-xl transition-colors cursor-pointer"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 17l-5-5m0 0l5-5m-5 5h12" />
          </svg>
          {t('common.back')}
        </button>
        <button
          onClick={() => navigate('/cost')}
          disabled={!canProceed || spacingTooWide || !brickDimensionsValid}
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
      <Stepper currentStep={2} />
      <WizardLayout
        form={form}
        lengthM={length}
        heightM={height}
        bondPattern={state.bondPattern}
        pierType={state.pierType}
        pierSize={state.pierSize}
        pierHeightM={pierHeight}
        pierSpacingM={pierSpacing}
        cutBricks={state.cutBricks}
        timberFence={state.timberFence}
        brickDimensions={brickDimensions}
        showDiagram={canRenderPierPreview}
      />
    </div>
  )
}
