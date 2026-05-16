import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useFormContext } from '../context/FormContext'
import { useAppNavigate } from '../navigation'

interface SavedQuote {
  id: string
  name: string
  date: string
  length: string
  height: string
  bondPattern: string
  pierType: string
  pierSize: string
  pierHeight?: string
  pierSpacing: string
  cutBricks: string
  timberFence: string
  brickSizeMode?: string
  brickLength?: string
  brickWidth?: string
  brickHeight?: string
  mortarJoint?: string
  brickCount?: number
  mortarVolumeM3?: number
}

function getQuotes(): SavedQuote[] {
  try {
    return JSON.parse(localStorage.getItem('fence-calculator-quotes') || '[]')
  } catch {
    return []
  }
}

function deleteQuoteFromStorage(id: string) {
  try {
    const quotes = getQuotes().filter((q) => q.id !== id)
    localStorage.setItem('fence-calculator-quotes', JSON.stringify(quotes))
  } catch {
    // ignore
  }
}

interface QuoteManagerProps {
  isOpen: boolean
  onClose: () => void
}

export default function QuoteManager({ isOpen, onClose }: QuoteManagerProps) {
  if (!isOpen) return null

  return <QuoteManagerDialog onClose={onClose} />
}

function QuoteManagerDialog({ onClose }: Pick<QuoteManagerProps, 'onClose'>) {
  const { t } = useTranslation()
  const navigate = useAppNavigate()
  const { dispatch } = useFormContext()
  const [quotes, setQuotes] = useState<SavedQuote[]>(getQuotes)

  const handleLoad = (quote: SavedQuote) => {
    dispatch({ type: 'SET_FIELD', field: 'length', value: quote.length })
    dispatch({ type: 'SET_FIELD', field: 'height', value: quote.height })
    dispatch({
      type: 'SET_FIELD',
      field: 'bondPattern',
      value: quote.bondPattern || 'stretcher',
    })
    dispatch({
      type: 'SET_FIELD',
      field: 'pierType',
      value: quote.pierType || 'none',
    })
    dispatch({
      type: 'SET_FIELD',
      field: 'pierSize',
      value: quote.pierSize || '1_5x1_5',
    })
    dispatch({
      type: 'SET_FIELD',
      field: 'pierHeight',
      value: quote.pierHeight || '1.8',
    })
    dispatch({
      type: 'SET_FIELD',
      field: 'pierSpacing',
      value: quote.pierSpacing || '2.8',
    })
    dispatch({
      type: 'SET_FIELD',
      field: 'cutBricks',
      value: quote.cutBricks || 'allowed',
    })
    dispatch({
      type: 'SET_FIELD',
      field: 'timberFence',
      value: quote.timberFence || 'none',
    })
    dispatch({
      type: 'SET_FIELD',
      field: 'brickSizeMode',
      value: quote.brickSizeMode || 'standard',
    })
    dispatch({
      type: 'SET_FIELD',
      field: 'brickLength',
      value: quote.brickLength || '230',
    })
    dispatch({
      type: 'SET_FIELD',
      field: 'brickWidth',
      value: quote.brickWidth || '110',
    })
    dispatch({
      type: 'SET_FIELD',
      field: 'brickHeight',
      value: quote.brickHeight || '76',
    })
    dispatch({
      type: 'SET_FIELD',
      field: 'mortarJoint',
      value: quote.mortarJoint || '10',
    })
    dispatch({ type: 'SET_FIELD', field: 'activeQuoteName', value: quote.name })
    onClose()
    navigate('/cost')
  }

  const handleDelete = (id: string) => {
    if (!window.confirm(t('quotes.confirmDelete'))) return
    deleteQuoteFromStorage(id)
    setQuotes(getQuotes())
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-start justify-center z-50 p-4 pt-16 sm:pt-24">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[70vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-bold text-text">{t('quotes.title')}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-text-muted hover:text-text hover:bg-gray-100 transition-colors cursor-pointer"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-4">
          {quotes.length === 0 ? (
            <p className="text-text-muted text-center py-8">{t('quotes.empty')}</p>
          ) : (
            <div className="space-y-3">
              {quotes.map((quote) => (
                <div
                  key={quote.id}
                  className="border border-border rounded-xl p-4 hover:bg-surface-alt transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-semibold text-text">{quote.name}</h3>
                      <p className="text-xs text-text-muted">{t('quotes.date')}: {quote.date}</p>
                    </div>
                    <span className="text-primary font-bold">
                      {Math.ceil(quote.brickCount ?? 0)} / {(quote.mortarVolumeM3 ?? 0).toFixed(3)} m³
                    </span>
                  </div>
                  <div className="text-sm text-text-muted mb-3">
                    {t('quotes.length')}: {quote.length}m | {t('quotes.height')}: {quote.height}m
                    {quote.bondPattern && ` | ${t(`bond.${quote.bondPattern}`)}`}
                    {quote.pierType && ` | ${t(`pier.types.${quote.pierType}`)}`}
                    {quote.pierType && quote.pierType !== 'none' && quote.pierSize
                      ? ` | ${t(`pier.sizes.${quote.pierSize}`)}`
                      : ''}
                    {quote.pierType && quote.pierType !== 'none' && quote.pierHeight
                      ? ` | ${quote.pierHeight}m`
                      : ''}
                    {quote.pierType && quote.pierType !== 'none' && quote.pierSpacing
                      ? ` (${quote.pierSpacing}m)`
                      : ''}
                    {quote.cutBricks ? ` | ${t(`cutBricks.options.${quote.cutBricks}`)}` : ''}
                    {quote.pierType && quote.pierType !== 'none' && quote.timberFence
                      ? ` | ${t(`pier.timberFenceOptions.${quote.timberFence}`)}`
                      : ''}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleLoad(quote)}
                      className="flex-1 py-2 rounded-lg bg-primary hover:bg-primary-dark text-white text-sm font-medium transition-colors cursor-pointer"
                    >
                      {t('quotes.load')}
                    </button>
                    <button
                      onClick={() => handleDelete(quote.id)}
                      className="py-2 px-4 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 text-sm font-medium transition-colors cursor-pointer"
                    >
                      {t('quotes.delete')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-border">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl border border-border text-text-muted font-medium hover:bg-gray-50 transition-colors cursor-pointer"
          >
            {t('quotes.close')}
          </button>
        </div>
      </div>
    </div>
  )
}
