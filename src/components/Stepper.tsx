import { useTranslation } from 'react-i18next'
import { useAppNavigate } from '../navigation'

interface StepperProps {
  currentStep: number
}

const steps = [
  { key: 'start', path: '/' },
  { key: 'dimensions', path: '/dimensions' },
  { key: 'bond', path: '/bond' },
  { key: 'cost', path: '/cost' },
] as const

export default function Stepper({ currentStep }: StepperProps) {
  const { t } = useTranslation()
  const navigate = useAppNavigate()

  const handleClick = (index: number) => {
    if (index < currentStep) {
      navigate(steps[index].path)
    }
  }

  return (
    <div className="flex items-center justify-center gap-0 w-full max-w-2xl mx-auto mb-8">
      {steps.map(({ key }, index) => {
        const isCompleted = index < currentStep
        const isCurrent = index === currentStep
        const isClickable = isCompleted

        return (
          <div key={key} className="flex items-center flex-1 last:flex-none">
            <button
              type="button"
              onClick={() => handleClick(index)}
              disabled={!isClickable}
              className={`flex flex-col items-center group ${isClickable ? 'cursor-pointer' : 'cursor-default'}`}
            >
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                  isCompleted
                    ? 'bg-primary text-white group-hover:bg-primary-dark'
                    : isCurrent
                      ? 'bg-primary text-white ring-4 ring-primary/20'
                      : 'bg-gray-200 text-text-muted'
                }`}
              >
                {isCompleted ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  index + 1
                )}
              </div>
              <span
                className={`mt-2 text-xs font-medium transition-colors ${
                  isCompleted
                    ? 'text-primary group-hover:text-primary-dark'
                    : isCurrent
                      ? 'text-primary'
                      : 'text-text-muted'
                }`}
              >
                {t(`steps.${key}`)}
              </span>
            </button>
            {index < steps.length - 1 && (
              <div
                className={`flex-1 h-0.5 mx-3 mt-[-1.25rem] ${
                  isCompleted ? 'bg-primary' : 'bg-gray-200'
                }`}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
