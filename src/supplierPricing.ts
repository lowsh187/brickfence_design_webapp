import type { Payload } from 'payload'

import {
  type PricingKey,
  formatPriceWithUnit,
  isPricingKey,
} from './pricing'

export type SupplierPriceSourceDoc = {
  id: number | string
  supplierName?: string | null
  pricingKey?: string | null
  productUrl?: string | null
  unit?: string | null
  isEnabled?: boolean | null
  includesGST?: boolean | null
  lastPrice?: number | null
  lastFetchedAt?: string | null
}

type ScrapedPrice = {
  title: string
  unitPrice: number
  currency: string
  unit?: string
}

function getFinalPriceDisplay(params: {
  priceSource: string | null | undefined
  manualUnitPriceDisplay: string | null | undefined
  autoAverageUnitPriceDisplay: string | null | undefined
  selectedSupplierUnitPriceDisplay: string | null | undefined
}): string {
  const manualPrice = params.manualUnitPriceDisplay || undefined
  const averagePrice = params.autoAverageUnitPriceDisplay || undefined
  const selectedSupplierPrice =
    params.selectedSupplierUnitPriceDisplay || undefined

  if (params.priceSource === 'supplier') {
    return selectedSupplierPrice ?? averagePrice ?? 'No data'
  }

  if (params.priceSource === 'average') {
    return averagePrice ?? 'No data'
  }

  return manualPrice ?? averagePrice ?? 'No data'
}

function getFinalPriceSourceDisplay(params: {
  priceSource: string | null | undefined
  selectedSupplierName?: string | null
}): string {
  if (params.priceSource === 'average') return 'Supplier average price'
  if (params.priceSource === 'manual') return 'Manual price'
  if (params.priceSource === 'supplier') {
    return params.selectedSupplierName || 'Specific supplier price'
  }

  return 'No data'
}

const SUPPLIER_HOST_MATCHES = [
  { host: 'australbricks.com.au', name: 'Austral Bricks / Brickworks' },
  { host: 'brickworks.com.au', name: 'Austral Bricks / Brickworks' },
  { host: 'pghbricks.com.au', name: 'PGH Bricks & Pavers' },
  { host: 'bowralbricks.com.au', name: 'Bowral Bricks' },
  { host: 'selkirk.com.au', name: 'Selkirk' },
  { host: 'midlandbrick.com.au', name: 'Midland Brick' },
  { host: 'littlehamptonbrick.com.au', name: 'Littlehampton Bricks' },
  { host: 'nationalmasonry.com.au', name: 'National Masonry' },
  { host: 'boral.com.au', name: 'Boral' },
  { host: 'adbri.com.au', name: 'Adbri / Adelaide Brighton Cement' },
  { host: 'bunnings.com.au', name: 'Bunnings' },
  { host: 'bowens.com.au', name: 'Bowens' },
  { host: 'westbuildgroup.com.au', name: 'Westbuild' },
  { host: 'mapei.com', name: 'Mapei Australia' },
  { host: 'mortafil.com.au', name: 'Mortafil' },
  { host: 'sydneyhardware.com.au', name: 'Sydney Hardware' },
  { host: 'cementaustralia.com.au', name: 'Cement Australia' },
] as const

function titleCaseHostSegment(value: string): string {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ')
}

function normalizeUrlLikeValue(value: string): string {
  return value.trim().replace(/^https?:\/\//i, '').replace(/^www\./i, '')
}

function inferSupplierNameFromHost(hostname: string): string {
  const parts = hostname.split('.').filter(Boolean)
  const secondLevelDomains = new Set(['asn', 'com', 'edu', 'gov', 'id', 'net', 'org'])
  const registrableName =
    parts.length >= 3 &&
    (parts.at(-2)?.length === 2 || secondLevelDomains.has(parts.at(-2) ?? ''))
      ? parts.at(-3)
      : parts.at(-2) ?? parts.at(0)

  return registrableName ? titleCaseHostSegment(registrableName) : ''
}

export function deriveSupplierNameFromUrl(url: string | null | undefined): string {
  if (!url) return ''

  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '').toLowerCase()
    const match = SUPPLIER_HOST_MATCHES.find(
      (supplier) =>
        hostname === supplier.host || hostname.endsWith(`.${supplier.host}`),
    )

    if (match) return match.name

    return inferSupplierNameFromHost(hostname) || titleCaseHostSegment(hostname)
  } catch {
    const normalized = normalizeUrlLikeValue(url).split(/[/?#]/)[0] ?? ''
    return inferSupplierNameFromHost(normalized) || titleCaseHostSegment(normalized)
  }
}

export function normalizeSupplierUnitPrice(params: {
  pricingKey: string | null | undefined
  unit: string | null | undefined
  unitPrice: number
}): number {
  if (params.pricingKey === 'standard_brick' && params.unit === 'per_1000') {
    return params.unitPrice / 1000
  }

  return params.unitPrice
}

export function getRelationshipID(
  value: number | string | { id?: number | string } | null | undefined,
): number | string | undefined {
  if (typeof value === 'number' || typeof value === 'string') return value
  return value?.id
}

function stripHtml(value: string): string {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractTitle(html: string): string {
  const ogTitle = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)
  if (ogTitle?.[1]) return ogTitle[1].trim()

  const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  return title?.[1]?.trim() || 'Supplier product page'
}

function extractJsonLdPrices(html: string): number[] {
  const prices: number[] = []
  const scripts = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi) ?? []

  for (const script of scripts) {
    const jsonText = script
      .replace(/^<script[^>]*>/i, '')
      .replace(/<\/script>$/i, '')
      .trim()

    try {
      const parsed = JSON.parse(jsonText)
      const queue = Array.isArray(parsed) ? [...parsed] : [parsed]

      while (queue.length > 0) {
        const value = queue.shift()
        if (!value || typeof value !== 'object') continue

        if ('price' in value) {
          const price = Number.parseFloat(String(value.price).replace(/,/g, ''))
          if (Number.isFinite(price) && price > 0) prices.push(price)
        }

        queue.push(...Object.values(value).filter((child) => typeof child === 'object'))
      }
    } catch {
      // ignore invalid supplier JSON-LD
    }
  }

  return prices
}

function extractTextPrices(text: string): number[] {
  const prices: number[] = []
  const priceMatches = text.matchAll(/\$\s*([0-9]{1,4}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?)/g)

  for (const match of priceMatches) {
    const price = Number.parseFloat(match[1].replace(/,/g, ''))
    if (Number.isFinite(price) && price > 0 && price < 10000) prices.push(price)
  }

  return prices
}

function inferUnitFromText(text: string): string | undefined {
  const normalized = text.toLowerCase()

  if (/\bper\s*1000\b|\b1000\s*(bricks|brick|units|pcs)\b/.test(normalized)) {
    return 'per_1000'
  }

  if (/\b20\s*kg\b/.test(normalized)) return '20kg_bag'
  if (/\bm3\b|cubic\s*met(re|er)/.test(normalized)) return 'm3'
  if (/\bm2\b|square\s*met(re|er)/.test(normalized)) return 'm2'
  if (/\bper\s*(metre|meter)\b|\bm\b/.test(normalized)) return 'm'
  if (/\beach\b|\bper\s*(brick|unit|piece|pc)\b/.test(normalized)) return 'each'

  return undefined
}

export async function scrapeSupplierPrice(url: string): Promise<ScrapedPrice> {
  const response = await fetch(url, {
    headers: {
      accept: 'text/html,application/xhtml+xml',
      'user-agent':
        'FenceCostCalculator/1.0 (+https://example.local; pricing research)',
    },
  })

  if (!response.ok) {
    throw new Error(`Supplier page returned HTTP ${response.status}`)
  }

  const html = await response.text()
  const title = extractTitle(html)
  const text = stripHtml(html)
  const prices = [...extractJsonLdPrices(html), ...extractTextPrices(text)]
  const uniquePrices = [...new Set(prices)].sort((a, b) => a - b)
  const unitPrice = uniquePrices[0]

  if (!unitPrice) {
    throw new Error('No public price could be parsed from this product page')
  }

  return {
    title,
    unitPrice,
    currency: 'AUD',
    unit: inferUnitFromText(text),
  }
}

export async function recomputeSupplierAverages(payload: Payload) {
  const sourceResult = await payload.find({
    collection: 'supplier-price-sources',
    depth: 0,
    limit: 1000,
    pagination: false,
    where: {
      lastStatus: {
        equals: 'success',
      },
    },
  })

  const priceGroups = new Map<PricingKey, number[]>()

  for (const source of sourceResult.docs as Array<{
    pricingKey?: string | null
    unit?: string | null
    lastPrice?: number | null
  }>) {
    if (!isPricingKey(source.pricingKey) || typeof source.lastPrice !== 'number') continue
      const prices = priceGroups.get(source.pricingKey) ?? []
      prices.push(
        normalizeSupplierUnitPrice({
          pricingKey: source.pricingKey,
          unit: source.unit,
          unitPrice: source.lastPrice,
        }),
      )
      priceGroups.set(source.pricingKey, prices)
  }

  for (const [pricingKey, values] of priceGroups) {
    const average =
      values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length)
    const pricingItems = await payload.find({
      collection: 'pricing-items',
      depth: 0,
      limit: 1,
      where: {
        key: {
          equals: pricingKey,
        },
      },
    })
    const existing = pricingItems.docs[0] as
      | {
          id: number | string
          manualUnitPrice?: number | null
          manualUnitPriceDisplay?: string | null
          priceSource?: string | null
          selectedSupplierUnitPrice?: number | null
          unit?: string | null
          selectedSupplierPriceSource?:
            | number
            | string
            | { id?: number | string }
            | null
          name?: string
        }
      | undefined
    let selectedSupplierPrice: number | undefined
    let selectedSupplierPriceDisplay = ''
    let selectedSupplierName = ''
    const selectedSupplierID = getRelationshipID(existing?.selectedSupplierPriceSource)

    if (existing?.priceSource === 'supplier' && selectedSupplierID) {
      try {
        const source = await payload.findByID({
          collection: 'supplier-price-sources',
          id: selectedSupplierID,
          depth: 0,
          overrideAccess: true,
        })

        if (
          source.pricingKey === pricingKey &&
          source.lastStatus === 'success' &&
          typeof source.lastPrice === 'number'
        ) {
          selectedSupplierPrice = normalizeSupplierUnitPrice({
            pricingKey,
            unit: source.unit,
            unitPrice: source.lastPrice,
          })
          selectedSupplierPriceDisplay = formatPriceWithUnit(
            source.lastPrice,
            source.unit,
          )
          selectedSupplierName = source.supplierName || ''
        }
      } catch {
        selectedSupplierPrice = undefined
        selectedSupplierPriceDisplay = ''
        selectedSupplierName = ''
      }
    }

    const averagePrice = Number(average.toFixed(2))
    const averagePriceDisplay = formatPriceWithUnit(averagePrice, existing?.unit)
    const manualPriceDisplay = formatPriceWithUnit(
      existing?.manualUnitPrice,
      existing?.unit,
    )
    const effectiveUnitPrice =
      existing?.priceSource === 'supplier'
        ? selectedSupplierPrice ?? averagePrice
        : existing?.priceSource === 'average' ||
            typeof existing?.manualUnitPrice !== 'number'
          ? averagePrice
          : existing.manualUnitPrice

    if (existing) {
      await payload.update({
        collection: 'pricing-items',
        id: existing.id,
        data: {
          autoAverageUnitPrice: averagePrice,
          autoAverageUnitPriceDisplay: averagePriceDisplay,
          selectedSupplierUnitPrice:
            existing.priceSource === 'supplier'
              ? selectedSupplierPrice ?? null
              : null,
          selectedSupplierUnitPriceDisplay:
            existing.priceSource === 'supplier'
              ? selectedSupplierPriceDisplay
              : '',
          effectiveUnitPrice,
          effectiveUnitPriceDisplay: formatPriceWithUnit(
            effectiveUnitPrice,
            existing.unit,
          ),
          finalPriceDisplay: getFinalPriceDisplay({
            priceSource: existing.priceSource,
            manualUnitPriceDisplay: manualPriceDisplay,
            autoAverageUnitPriceDisplay: averagePriceDisplay,
            selectedSupplierUnitPriceDisplay:
              existing.priceSource === 'supplier'
                ? selectedSupplierPriceDisplay
                : '',
          }),
          finalPriceSourceDisplay: getFinalPriceSourceDisplay({
            priceSource: existing.priceSource,
            selectedSupplierName,
          }),
          manualUnitPriceDisplay: manualPriceDisplay,
        },
      })
    }
  }
}
