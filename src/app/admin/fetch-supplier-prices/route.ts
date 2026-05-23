import config from '@payload-config'
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'

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
    const scraped = await scrapeSupplierPrice(source.productUrl)
    const unit =
      scraped.unit || source.unit || defaultUnitForPricingKey(source.pricingKey)
    const previousPrice =
      typeof source.lastPrice === 'number' ? source.lastPrice : undefined
    const previousUnit = source.unit || unit

    await payload.update({
      collection: 'supplier-price-sources',
      id: source.id,
      data: {
        previousPrice,
        previousPriceDisplay: formatPriceWithUnit(previousPrice, previousUnit) || 'No data',
        previousFetchedAt: source.lastFetchedAt ?? null,
        lastPrice: scraped.unitPrice,
        lastFetchedAt: new Date().toISOString(),
        lastStatus: 'success',
        lastError: null,
        lastPriceDisplay: formatPriceWithUnit(
          scraped.unitPrice,
          unit,
        ),
        unit,
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
