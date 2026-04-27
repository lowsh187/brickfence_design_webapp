import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Stepper from '../components/Stepper'
import WizardLayout from '../components/WizardLayout'
import { useFormContext } from '../context/FormContext'

const MAX_HEIGHT = 2

export default function DimensionsPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { state, dispatch } = useFormContext()

  const length = parseFloat(state.length) || 0
  const height = parseFloat(state.height) || 0
  const heightTooHigh = height > MAX_HEIGHT
  const canProceed = length > 0 && height > 0 && !heightTooHigh

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
            step="0.1"
            value={state.length}
            onChange={(e) =>
              dispatch({ type: 'SET_FIELD', field: 'length', value: e.target.value })
            }
            placeholder={t('dimensions.lengthPlaceholder')}
            className="w-full px-4 py-3 rounded-xl border border-border bg-surface-alt focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors text-text"
          />
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
        showDiagram={length > 0 && height > 0 && !heightTooHigh}
      />
    </div>
  )
}
