"use client"

import { useEffect, useRef, useState, Suspense } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import './i18n'
import { FormProvider, useFormContext } from './context/FormContext'
import { NavigationProvider } from './navigation'
import LanguageSwitcher from './components/LanguageSwitcher'
import CookieConsentBanner from './components/CookieConsentBanner'
import QuoteManager from './components/QuoteManager'
import FenceDiagram from './components/FenceDiagram'
import {
  brickDimensionsFromStrings,
  validateBrickDimensions,
} from './bonds/brickDimensions'
import StartPage from './screens/StartPage'
import DimensionsPage from './screens/DimensionsPage'
import BondPage from './screens/BondPage'
import CostPage from './screens/CostPage'

function PersistentPreview() {
  const { t } = useTranslation()
  const pathname = usePathname()
  const { state } = useFormContext()
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewZoom, setPreviewZoom] = useState(1)
  const previewScrollRef = useRef<HTMLDivElement>(null)

  const length = parseFloat(state.length) || 0
  const height = parseFloat(state.height) || 0
  const pierHeight = parseFloat(state.pierHeight) || 0
  const pierSpacing = parseFloat(state.pierSpacing) || 0
  const brickDimensions = brickDimensionsFromStrings(state)
  const brickDimensionsValid =
    state.brickSizeMode === 'standard' ||
    (state.brickSizeMode === 'custom' &&
      state.brickLength !== '' &&
      state.brickWidth !== '' &&
      state.brickHeight !== '' &&
      state.mortarJoint !== '' &&
      validateBrickDimensions(brickDimensions))
  const previewPierType = state.pierType || 'none'
  const previewTimberFence = state.timberFence || 'none'
  const spacingTooWide = previewPierType !== 'none' && pierSpacing > 3
  const hasPreviewBond = pathname !== '/dimensions' && !!state.bondPattern && !!state.cutBricks
  const showDiagram =
    length > 0 &&
    height > 0 &&
    height <= 3 &&
    !spacingTooWide &&
    brickDimensionsValid &&
    hasPreviewBond
  const selectionSummary = [
    hasPreviewBond ? t(`bond.${state.bondPattern}`) : null,
    hasPreviewBond ? t(`cutBricks.options.${state.cutBricks}`) : null,
    hasPreviewBond && state.pierType ? t(`pier.types.${previewPierType}`) : null,
  ].filter(Boolean).join(' · ')

  useEffect(() => {
    if (!previewOpen) return
    const el = previewScrollRef.current
    if (!el) return

    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return
      event.preventDefault()
      const delta = event.deltaY < 0 ? 0.12 : -0.12
      setPreviewZoom((zoom) => Math.max(0.6, Math.min(3, Number((zoom + delta).toFixed(2)))))
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [previewOpen])

  return (
    <div className="w-full lg:flex-1 lg:min-w-0">
      <div className="lg:sticky lg:top-20">
        <div className="bg-white rounded-2xl shadow-sm border border-border p-4 sm:p-6">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wide">
              {t('diagram.previewTitle')}
            </h3>
            {showDiagram && (
              <button
                type="button"
                onClick={() => setPreviewOpen(true)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-text-muted hover:border-primary hover:text-primary transition-colors cursor-pointer"
                aria-label={t('diagram.expandPreview')}
                title={t('diagram.expandPreview')}
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
                </svg>
              </button>
            )}
          </div>
          {selectionSummary && (
            <div className="mb-3 rounded-lg border border-border bg-surface-alt px-3 py-2 text-sm font-medium text-text">
              {selectionSummary}
            </div>
          )}
          {showDiagram ? (
            <div className="rounded-xl overflow-hidden border border-border/50">
              <FenceDiagram
                lengthM={length}
                heightM={height}
                bondPattern={state.bondPattern}
                pierType={previewPierType}
                pierSize={state.pierSize || undefined}
                pierHeightM={pierHeight}
                pierSpacingM={pierSpacing}
                cutBricks={state.cutBricks || undefined}
                timberFence={previewTimberFence}
                brickDimensions={brickDimensions}
              />
            </div>
          ) : (
            <div className="flex items-center justify-center rounded-xl border border-dashed border-border/70 bg-surface-alt h-80 sm:h-96 lg:h-[28rem] text-sm text-text-muted text-center px-4">
              {t('diagram.awaitingDimensions')}
            </div>
          )}
        </div>
      </div>
      {previewOpen && showDiagram && (
        <div className="fixed inset-0 z-50 bg-black/45 p-4 sm:p-6">
          <div className="mx-auto flex h-full max-w-[96rem] flex-col rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
              <div>
                <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wide">
                  {t('diagram.previewTitle')}
                </h3>
                {selectionSummary && (
                  <div className="mt-1 text-sm font-medium text-text">{selectionSummary}</div>
                )}
                <div className="mt-1 text-xs text-text-muted">
                  Hold Ctrl and scroll to zoom the preview. Current zoom: {Math.round(previewZoom * 100)}%
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setPreviewZoom((zoom) => Math.max(0.6, Number((zoom - 0.12).toFixed(2))))
                  }
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border text-text-muted hover:bg-surface-alt hover:text-text transition-colors cursor-pointer"
                  aria-label={t('diagram.zoomOut')}
                  title={t('diagram.zoomOut')}
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setPreviewZoom((zoom) => Math.min(3, Number((zoom + 0.12).toFixed(2))))
                  }
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border text-text-muted hover:bg-surface-alt hover:text-text transition-colors cursor-pointer"
                  aria-label={t('diagram.zoomIn')}
                  title={t('diagram.zoomIn')}
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v14m-7-7h14" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewOpen(false)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border text-text-muted hover:bg-surface-alt hover:text-text transition-colors cursor-pointer"
                  aria-label={t('quotes.close')}
                  title={t('quotes.close')}
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 p-4">
              <div
                ref={previewScrollRef}
                className="h-full overflow-auto rounded-xl border border-border/50 bg-surface-alt"
              >
                <div
                  className="min-h-full bg-white"
                  style={{
                    width: `${previewZoom * 100}%`,
                    minWidth: '100%',
                  }}
                >
                  <FenceDiagram
                    lengthM={length}
                    heightM={height}
                    bondPattern={state.bondPattern}
                    pierType={previewPierType}
                    pierSize={state.pierSize || undefined}
                    pierHeightM={pierHeight}
                    pierSpacingM={pierSpacing}
                    cutBricks={state.cutBricks || undefined}
                    timberFence={previewTimberFence}
                    brickDimensions={brickDimensions}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function AppContent() {
  const { t } = useTranslation()
  const pathname = usePathname()
  const [quotesOpen, setQuotesOpen] = useState(false)
  const usesWizardLayout = ['/dimensions', '/bond', '/cost'].includes(pathname)
  const routeContent =
    pathname === '/dimensions' ? (
      <DimensionsPage />
    ) : pathname === '/bond' ? (
      <BondPage />
    ) : pathname === '/cost' ? (
      <CostPage />
    ) : (
      <StartPage />
    )

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-border">
        <div className="max-w-[100rem] mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-bold text-text truncate">
            {t('app.title')}
          </h1>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setQuotesOpen(true)}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-text-muted hover:text-text transition-colors cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="hidden sm:inline">{t('nav.myQuotes')}</span>
            </button>
            <LanguageSwitcher />
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-[100rem] w-full mx-auto px-4 py-8">
        {usesWizardLayout ? (
          <div className="flex flex-col lg:flex-row lg:items-start gap-6 w-full">
            <div className="w-full lg:w-[480px] lg:flex-shrink-0 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto lg:pr-2">
              {routeContent}
            </div>
            <PersistentPreview />
          </div>
        ) : (
          routeContent
        )}
      </main>

      <footer className="border-t border-border bg-white">
        <div className="max-w-[100rem] mx-auto px-4 py-4 text-center text-xs text-text-muted">
          {t('app.title')}
        </div>
      </footer>

      <QuoteManager isOpen={quotesOpen} onClose={() => setQuotesOpen(false)} />
      <CookieConsentBanner />
    </div>
  )
}

function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

export default function App() {
  const router = useRouter()

  return (
    <Suspense fallback={<LoadingFallback />}>
      <NavigationProvider
        navigate={(path, options) =>
          options?.replace ? router.replace(path) : router.push(path)
        }
      >
        <FormProvider>
          <AppContent />
        </FormProvider>
      </NavigationProvider>
    </Suspense>
  )
}
