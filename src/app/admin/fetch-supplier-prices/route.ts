import { NextResponse } from 'next/server'
import { getPayload } from 'payload'

import config from '../../../../payload.config'
import {
  defaultUnitForPricingKey,
  formatPvcPanelPriceSummary,
  formatPvcPriceDisplay,
  formatPriceWithUnit,
  inferPvcFencePanelSize,
  isPvcFencePricingKey,
  normalizePvcPanelPrices,
  type PvcFencePanelSize,
} from '../../../pricing'
import {
  type SupplierPriceSourceDoc,
  deriveSupplierNameFromUrl,
  recomputeSupplierAverages,
  scrapePvcFencePanelPrices,
  scrapeSupplierPrice,
} from '../../../supplierPricing'
import {
  createFixedWindowRateLimiter,
  getClientRateLimitKey,
  isAllowedSameOriginRequest,
} from '../../../security'

const checkFetchSupplierPricesRateLimit = createFixedWindowRateLimiter({
  limit: 5,
  windowMs: 60_000,
})

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

function pvcPanelPriceFieldName(size: PvcFencePanelSize):
  | 'fourFt'
  | 'fiveFt'
  | 'sixFt'
  | 'eightFt'
  | 'tenFt' {
  switch (size) {
    case '4ft':
      return 'fourFt'
    case '5ft':
      return 'fiveFt'
    case '6ft':
      return 'sixFt'
    case '8ft':
      return 'eightFt'
    case '10ft':
      return 'tenFt'
  }
}

function pvcPanelPricesToGroup(prices: Partial<Record<PvcFencePanelSize, number>>) {
  return {
    eightFt: prices['8ft'],
    fiveFt: prices['5ft'],
    fourFt: prices['4ft'],
    sixFt: prices['6ft'],
    tenFt: prices['10ft'],
  }
}

async function updatePvcPanelPrice(
  payload: Awaited<ReturnType<typeof getPayload>>,
  size: PvcFencePanelSize,
  price: number,
) {
  const pricingItems = await payload.find({
    collection: 'pricing-items',
    depth: 0,
    limit: 1,
    where: {
      key: {
        equals: 'pvc_fence',
      },
    },
  })
  const existing = pricingItems.docs[0] as
    | {
        id: number | string
        pvcDefaultPanelSize?: string | null
        pvcPanelPrices?: {
          fourFt?: number | null
          fiveFt?: number | null
          sixFt?: number | null
          eightFt?: number | null
          tenFt?: number | null
        } | null
      }
    | undefined
  if (!existing) return

  const fieldName = pvcPanelPriceFieldName(size)
  const nextPanelPrices = {
    ...(existing.pvcPanelPrices ?? {}),
    [fieldName]: price,
  }

  await payload.update({
    collection: 'pricing-items',
    id: existing.id,
    data: {
      manualUnitPrice:
        existing.pvcDefaultPanelSize === size ? price : undefined,
      pvcPanelPrices: nextPanelPrices,
    },
  })
}

async function updatePvcPanelPrices(
  payload: Awaited<ReturnType<typeof getPayload>>,
  prices: Partial<Record<PvcFencePanelSize, number>>,
) {
  const pricingItems = await payload.find({
    collection: 'pricing-items',
    depth: 0,
    limit: 1,
    where: {
      key: {
        equals: 'pvc_fence',
      },
    },
  })
  const existing = pricingItems.docs[0] as
    | {
        id: number | string
        pvcDefaultPanelSize?: string | null
        pvcPanelPrices?: {
          fourFt?: number | null
          fiveFt?: number | null
          sixFt?: number | null
          eightFt?: number | null
          tenFt?: number | null
        } | null
      }
    | undefined
  if (!existing) return

  const nextPanelPrices = { ...(existing.pvcPanelPrices ?? {}) }
  for (const [size, price] of Object.entries(prices)) {
    if (typeof price !== 'number') continue
    nextPanelPrices[pvcPanelPriceFieldName(size as PvcFencePanelSize)] = price
  }

  const defaultSize = existing.pvcDefaultPanelSize as PvcFencePanelSize | undefined
  const defaultPrice = defaultSize ? prices[defaultSize] : undefined

  await payload.update({
    collection: 'pricing-items',
    id: existing.id,
    data: {
      manualUnitPrice:
        typeof defaultPrice === 'number' ? defaultPrice : undefined,
      pvcPanelPrices: nextPanelPrices,
    },
  })
}

async function fetchAndStoreSupplierPrice(
  payload: Awaited<ReturnType<typeof getPayload>>,
  source: SupplierPriceSourceDoc,
) {
  const supplierName = deriveSupplierNameFromUrl(source.productUrl)

  if (!source.productUrl || !source.pricingKey) {
    return {
      source: supplierName,
      status: 'skipped',
      error:
        'Manual supplier sources can only be updated by editing and saving.',
    }
  }

  try {
    let scrapedPvcPanelPrices: Partial<Record<PvcFencePanelSize, number>> | undefined
    let scrapedPvcPanelPriceDisplay: string | undefined
    const scraped = await scrapeSupplierPrice(source.productUrl, source.pricingKey)
    const pvcPricingMode =
      isPvcFencePricingKey(source.pricingKey)
        ? scraped.pvcPricingMode ?? source.pvcPricingMode ?? 'panel'
        : undefined

    if (isPvcFencePricingKey(source.pricingKey)) {
      if (pvcPricingMode === 'panel') {
        const panelResults = await scrapePvcFencePanelPrices(source.productUrl)
        const panelPrices = Object.fromEntries(
          Object.entries(panelResults).map(([size, result]) => [size, result?.price]),
        ) as Partial<Record<PvcFencePanelSize, number>>
        const foundPanelSizes = Object.keys(panelResults)

        if (foundPanelSizes.length > 0) {
          scrapedPvcPanelPrices = panelPrices
          scrapedPvcPanelPriceDisplay = formatPvcPanelPriceSummary(
            normalizePvcPanelPrices(panelPrices).prices,
          )
          await updatePvcPanelPrices(payload, panelPrices)
        }
      } else {
        scrapedPvcPanelPriceDisplay = formatPvcPriceDisplay({
          mode: 'per_m',
          unitPrice: scraped.unitPrice,
        })
      }
    }

    const pvcPanelSize = isPvcFencePricingKey(source.pricingKey)
      ? scraped.pvcPanelSize ??
        inferPvcFencePanelSize(`${source.productUrl} ${scraped.title}`)
      : undefined
    const unit =
      isPvcFencePricingKey(source.pricingKey) && pvcPricingMode === 'per_m'
        ? 'm'
        : scraped.unit || source.unit || defaultUnitForPricingKey(source.pricingKey)
    const unitQuantity =
      scraped.unitQuantity ?? source.unitQuantity ?? (unit === 'per_1000' ? 1000 : undefined)
    const unitConversionFactor =
      scraped.unitConversionFactor ?? source.unitConversionFactor ?? undefined
    const unitConversionNote =
      scraped.unitConversionNote ?? source.unitConversionNote ?? undefined
    if (
      source.pricingKey === 'standard_brick' &&
      unit === 'each' &&
      scraped.unitPrice > 20 &&
      !scraped.unit
    ) {
      throw new Error(
        'Price was found, but the brick unit could not be determined. Please choose the unit manually.',
      )
    }
    const previousPrice =
      typeof source.lastPrice === 'number' ? source.lastPrice : undefined
    const previousUnit = source.unit || unit

    await payload.update({
      collection: 'supplier-price-sources',
      id: source.id,
      data: {
        previousPrice,
        previousPriceDisplay:
          isPvcFencePricingKey(source.pricingKey) && source.pvcPricingMode !== 'per_m'
            ? source.pvcPanelPriceDisplay || 'No data'
            : formatPriceWithUnit(
              previousPrice,
              previousUnit,
              source.unitQuantity,
            ) || 'No data',
        previousFetchedAt: source.lastFetchedAt ?? null,
        lastPrice: scraped.unitPrice,
        lastFetchedAt: new Date().toISOString(),
        lastStatus: 'success',
        lastError: null,
        lastPriceDisplay:
          scrapedPvcPanelPriceDisplay ??
          formatPriceWithUnit(
            scraped.unitPrice,
            unit,
            unitQuantity,
          ),
        unit,
        pvcPricingMode,
        unitQuantity,
        unitConversionFactor,
        unitConversionNote,
        pvcPanelSize,
        pvcPanelPriceDisplay: scrapedPvcPanelPriceDisplay,
        pvcPanelPrices: scrapedPvcPanelPrices
          ? pvcPanelPricesToGroup(scrapedPvcPanelPrices)
          : undefined,
        pvcPanelPriceWarning: scrapedPvcPanelPrices
          ? normalizePvcPanelPrices(scrapedPvcPanelPrices).warning
          : undefined,
        bagWeightKg: scraped.bagWeightKg ?? source.bagWeightKg ?? null,
        supplierName,
      },
    })

    if (isPvcFencePricingKey(source.pricingKey) && pvcPricingMode === 'panel' && pvcPanelSize) {
      await updatePvcPanelPrice(payload, pvcPanelSize, scraped.unitPrice)
    }

    return {
      source: supplierName,
      status: 'success',
      unitPrice: scraped.unitPrice,
      pvcPanelSize,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown scraping error'

    await payload.update({
      collection: 'supplier-price-sources',
      id: source.id,
      data: {
        lastFetchedAt: new Date().toISOString(),
        lastStatus: 'failed',
        lastError: message,
        supplierName,
      },
    })

    return {
      source: supplierName,
      status: 'failed',
      error: message,
    }
  }
}

export async function POST(request: Request) {
  const payload = await getPayload({ config })
  const auth = await payload.auth({ headers: request.headers })

  if (!auth.user || auth.user.collection !== 'admins') {
    return jsonError('Unauthorized', 401)
  }

  if (!isAllowedSameOriginRequest(request)) {
    return jsonError('Cross-origin price update requests are not allowed.', 403)
  }

  const rateLimit = checkFetchSupplierPricesRateLimit(
    getClientRateLimitKey(request, auth.user.id),
  )
  if (!rateLimit.allowed) {
    return jsonError('Too many supplier price update requests. Try again later.', 429)
  }

  const sourceId = new URL(request.url).searchParams.get('sourceId')
  const results = []

  if (sourceId) {
    const source = await payload.findByID({
      collection: 'supplier-price-sources',
      id: sourceId,
      depth: 0,
    })

    results.push(
      await fetchAndStoreSupplierPrice(payload, source as SupplierPriceSourceDoc),
    )
  } else {
    const sourceResult = await payload.find({
      collection: 'supplier-price-sources',
      depth: 0,
      limit: 100,
      pagination: false,
      where: {
        isEnabled: {
          equals: true,
        },
      },
    })

    for (const source of sourceResult.docs as SupplierPriceSourceDoc[]) {
      results.push(await fetchAndStoreSupplierPrice(payload, source))
    }
  }

  await recomputeSupplierAverages(payload)

  return NextResponse.json({
    fetched: results.length,
    results,
  })
}
