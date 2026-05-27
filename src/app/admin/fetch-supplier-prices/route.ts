import { NextResponse } from 'next/server'
import { getPayload } from 'payload'

import config from '../../../../payload.config'
import {
  defaultUnitForPricingKey,
  formatPriceWithUnit,
} from '../../../pricing'
import {
  type SupplierPriceSourceDoc,
  deriveSupplierNameFromUrl,
  recomputeSupplierAverages,
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
    const scraped = await scrapeSupplierPrice(source.productUrl, source.pricingKey)
    const unit =
      scraped.unit || source.unit || defaultUnitForPricingKey(source.pricingKey)
    const unitQuantity =
      scraped.unitQuantity ?? source.unitQuantity ?? (unit === 'per_1000' ? 1000 : undefined)
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
        previousPriceDisplay: formatPriceWithUnit(
          previousPrice,
          previousUnit,
          source.unitQuantity,
        ) || 'No data',
        previousFetchedAt: source.lastFetchedAt ?? null,
        lastPrice: scraped.unitPrice,
        lastFetchedAt: new Date().toISOString(),
        lastStatus: 'success',
        lastError: null,
        lastPriceDisplay: formatPriceWithUnit(
          scraped.unitPrice,
          unit,
          unitQuantity,
        ),
        unit,
        unitQuantity,
        bagWeightKg: scraped.bagWeightKg ?? source.bagWeightKg ?? null,
        supplierName,
      },
    })

    return {
      source: supplierName,
      status: 'success',
      unitPrice: scraped.unitPrice,
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
