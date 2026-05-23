'use client'

import { useEffect, useState } from 'react'

type SupplierPriceFetchButtonProps = {
  mode?: 'all' | 'current'
}

type FetchResult = {
  fetched?: number
  results?: Array<{
    source?: string | null
    status?: string
    unitPrice?: number
    error?: string
  }>
}

function getCurrentSourceID(): string | undefined {
  if (typeof window === 'undefined') return undefined

  const match = window.location.pathname.match(
    /\/admin\/collections\/supplier-price-sources\/([^/?#]+)/,
  )

  return match?.[1] && match[1] !== 'create' ? match[1] : undefined
}

export function SupplierPriceFetchButton({
  mode = 'all',
}: SupplierPriceFetchButtonProps) {
  const [isFetching, setIsFetching] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isManualSource, setIsManualSource] = useState(false)
  const isCurrentMode = mode === 'current'

  useEffect(() => {
    if (!isCurrentMode) return

    const sourceID = getCurrentSourceID()
    if (!sourceID) {
      setIsManualSource(true)
      return
    }

    async function loadSource() {
      try {
        const response = await fetch(
          `/api/supplier-price-sources/${sourceID}?depth=0`,
        )
        const data = (await response.json()) as { productUrl?: string | null }
        setIsManualSource(!data.productUrl)
      } catch {
        setIsManualSource(false)
      }
    }

    void loadSource()
  }, [isCurrentMode])

  async function fetchPrices() {
    const sourceID = getCurrentSourceID()

    if (isCurrentMode && !sourceID) {
      setError('Save this URL supplier source before updating its price.')
      return
    }

    if (isCurrentMode && isManualSource) {
      setError('Manual supplier sources are updated by editing and saving.')
      return
    }

    setIsFetching(true)
    setMessage(null)
    setError(null)

    try {
      const response = await fetch(
        `/admin/fetch-supplier-prices${
          isCurrentMode && sourceID ? `?sourceId=${encodeURIComponent(sourceID)}` : ''
        }`,
        {
          method: 'POST',
        },
      )

      const data = (await response.json()) as FetchResult

      if (!response.ok) {
        throw new Error('Price update failed.')
      }

      const successCount =
        data.results?.filter((result) => result.status === 'success').length ?? 0
      const failedResults =
        data.results?.filter((result) => result.status === 'failed') ?? []
      const failedCount = failedResults.length

      if (successCount === 0 && failedResults[0]?.error) {
        throw new Error(failedResults[0].error)
      }

      setMessage(
        `Finished: ${successCount} success${
          failedCount ? `, ${failedCount} failed` : ''
        }. Refresh the page to see the latest values.`,
      )
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Price update failed.',
      )
    } finally {
      setIsFetching(false)
    }
  }

  return (
    <div
      style={{
        alignItems: 'center',
        display: 'flex',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 20,
        marginTop: isCurrentMode ? 12 : 4,
      }}
    >
      {isCurrentMode ? (
        <span style={{ color: '#777', flexBasis: '100%' }}>
          Use this button only for URL supplier sources. Manual sources are
          updated by editing and saving.
        </span>
      ) : null}
      <button
        type="button"
        disabled={isFetching || (isCurrentMode && isManualSource)}
        onClick={fetchPrices}
        style={{
          background:
            isFetching || (isCurrentMode && isManualSource) ? '#777' : '#222',
          border: 0,
          borderRadius: 4,
          color: '#fff',
          cursor:
            isFetching || (isCurrentMode && isManualSource)
              ? 'not-allowed'
              : 'pointer',
          font: 'inherit',
          padding: '10px 16px',
        }}
      >
        {isFetching
          ? 'Updating prices...'
          : isCurrentMode && isManualSource
            ? 'Manual source: edit to update'
          : isCurrentMode
            ? 'Update this supplier price'
            : 'Update all supplier prices'}
      </button>
      {message ? <span style={{ color: '#267a3e' }}>{message}</span> : null}
      {error ? <span style={{ color: '#b00020' }}>{error}</span> : null}
    </div>
  )
}
