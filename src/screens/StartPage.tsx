import { useTranslation } from 'react-i18next'
import Stepper from '../components/Stepper'
import { useFormContext } from '../context/FormContext'
import { useAppNavigate } from '../navigation'

export default function StartPage() {
  const navigate = useAppNavigate()
  const { t } = useTranslation()
  const { dispatch } = useFormContext()

  return (
    <div className="flex flex-col items-center">
      <Stepper currentStep={0} />

      <div className="w-full max-w-lg bg-white rounded-2xl shadow-sm border border-border p-8 text-center">
        <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-text mb-3">
          {t('start.heading')}
        </h1>
        <p className="text-text-muted leading-relaxed mb-8">
          {t('start.description')}
        </p>

        <button
          onClick={() => {
            dispatch({ type: 'RESET' })
            navigate('/dimensions')
          }}
          className="inline-flex items-center gap-2 bg-primary hover:bg-primary-dark text-white font-semibold py-3 px-8 rounded-xl transition-colors shadow-sm cursor-pointer"
        >
          {t('start.getStarted')}
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </button>
      </div>
    </div>
  )
}
