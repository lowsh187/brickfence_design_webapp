import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

import type { Payload } from 'payload'

import {
  type PricingKey,
  formatPriceWithUnit,
  isPricingKey,
} from './pricing'
import {
  isSafeAIPriceParse,
  parseSupplierPriceWithAI,
} from './supplierPriceAI'

const execFileAsync = promisify(execFile)

export type SupplierPriceSourceDoc = {
  id: number | string
  supplierName?: string | null
  pricingKey?: string | null
  productUrl?: string | null
  unit?: string | null
  unitQuantity?: number | null
  customUnit?: string | null
  bagWeightKg?: number | null
  isEnabled?: boolean | null
  includesGST?: boolean | null
  lastPrice?: number | null
  lastFetchedAt?: string | null
}

type ScrapedPrice = {
  bagWeightKg?: number
  title: string
  unitPrice: number
  currency: string
  unit?: string
  unitQuantity?: number
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
  unitQuantity?: number | null
  unitPrice: number
}): number {
  if (params.pricingKey === 'standard_brick' && params.unit === 'per_1000') {
    return params.unitPrice / 1000
  }

  if (params.pricingKey === 'standard_brick' && params.unit === 'per_quantity') {
    const quantity =
      typeof params.unitQuantity === 'number' &&
      Number.isFinite(params.unitQuantity) &&
      params.unitQuantity > 0
        ? params.unitQuantity
        : 1

    return params.unitPrice / quantity
  }

  return params.unitPrice
}

function resolveUnitForDisplay(
  unit: string | null | undefined,
  customUnit: string | null | undefined,
): string | null | undefined {
  return unit === 'custom' ? customUnit || unit : unit
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

function getSupplierFetchUrl(url: string): string {
  try {
    const parsed = new URL(url)
    const hostname = parsed.hostname.replace(/^www\./, '').toLowerCase()

    if (
      (hostname === 'australbricks.com.au' ||
        hostname.endsWith('.australbricks.com.au') ||
        hostname === 'brickworks.com.au' ||
        hostname.endsWith('.brickworks.com.au')) &&
      !parsed.searchParams.has('change_state')
    ) {
      const state = parsed.pathname
        .split('/')
        .filter(Boolean)[0]
        ?.toUpperCase()
      const knownStates = new Set(['ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA'])

      if (state && knownStates.has(state)) {
        parsed.searchParams.set('change_state', state)
        return parsed.toString()
      }
    }
  } catch {
    return url
  }

  return url
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

function parseQuantityValue(value: string | null | undefined): number | undefined {
  if (!value) return undefined

  const quantity = Number.parseInt(value.replace(/,/g, ''), 10)
  return Number.isFinite(quantity) && quantity > 1 ? quantity : undefined
}

function inferUnitFromUnitText(value: string): {
  unit?: string
  unitQuantity?: number
} {
  const normalized = stripHtml(value).toLowerCase()
  const quantityMatch = normalized.match(
    /\b(?:per|\/)\s*(\d{1,3}(?:,\d{3})+|\d{2,5})\b|\b(\d{1,3}(?:,\d{3})+|\d{2,5})\s*(?:bricks|brick|units|unit|pcs|pieces)\b/,
  )
  const unitQuantity = parseQuantityValue(quantityMatch?.[1] ?? quantityMatch?.[2])

  if (unitQuantity) {
    return {
      unit: 'per_quantity',
      unitQuantity,
    }
  }

  if (/\b\d+(?:\.\d+)?\s*kg\b/.test(normalized) && /\bbag\b/.test(normalized)) {
    return { unit: 'per_bag' }
  }
  if (/\bm3\b|cubic\s*met(re|er)/.test(normalized)) return { unit: 'm3' }
  if (/\bm2\b|square\s*met(re|er)/.test(normalized)) return { unit: 'm2' }
  if (/\bper\s*(metre|meter)\b|\bm\b/.test(normalized)) return { unit: 'm' }
  if (/\beach\b|\bper\s*(brick|unit|piece|pc)\b/.test(normalized)) return { unit: 'each' }

  return {}
}

function inferUnitFromText(text: string): {
  unit?: string
  unitQuantity?: number
} {
  return inferUnitFromUnitText(text)
}

function extractStructuredPrice(html: string):
  | {
      unitPrice: number
      unit?: string
      unitQuantity?: number
    }
  | undefined {
  const priceAmountMatches = html.matchAll(
    /data-price-amount=["']?([0-9][0-9,]*(?:\.[0-9]+)?)["']?[\s\S]{0,1200}/gi,
  )

  for (const match of priceAmountMatches) {
    const unitPrice = Number.parseFloat(match[1].replace(/,/g, ''))
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) continue

    const context = match[0]
    const uomMatch =
      context.match(/class=["'][^"']*\buom\b[^"']*["'][^>]*>([^<]+)</i) ??
      context.match(/data-th=["']UOM["'][^>]*>([^<]+)</i) ??
      context.match(/(?:uom|unit\s*of\s*measure)[^<]{0,80}<[^>]*>([^<]+)</i)
    const unitInfo = uomMatch?.[1] ? inferUnitFromUnitText(uomMatch[1]) : {}

    if (unitInfo.unit) {
      return {
        unitPrice,
        ...unitInfo,
      }
    }

    const contextUnitInfo = inferUnitFromUnitText(context)
    return {
      unitPrice,
      ...contextUnitInfo,
    }
  }

  return undefined
}

function extractPriceContextSnippet(html: string, text: string): string {
  const snippets: string[] = []
  const htmlPatterns = [
    /data-price-amount=["']?([0-9][0-9,]*(?:\.[0-9]+)?)["']?[\s\S]{0,500}/gi,
    /\$\s*[0-9]{1,4}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?[\s\S]{0,500}/g,
    /class=["'][^"']*(?:uom|price)[^"']*["'][\s\S]{0,500}/gi,
  ]

  for (const pattern of htmlPatterns) {
    for (const match of html.matchAll(pattern)) {
      if (match[0]) snippets.push(match[0])
      if (snippets.length >= 8) break
    }
    if (snippets.length >= 8) break
  }

  if (snippets.length === 0) {
    const priceMatch = text.match(/\$\s*[0-9]{1,4}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?/)
    const index = priceMatch?.index ?? 0
    snippets.push(text.slice(Math.max(0, index - 500), index + 1500))
  }

  return snippets
    .join('\n---\n')
    .replace(/\s+/g, ' ')
    .slice(0, 6000)
}

function shouldUseAIPriceFallback(params: {
  pricingKey?: string | null
  unit?: string
  unitPrice: number
}): boolean {
  if (!params.unit) return true

  return (
    params.pricingKey === 'standard_brick' &&
    params.unit === 'each' &&
    params.unitPrice > 20
  )
}

async function fetchSupplierHtml(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      accept: 'text/html,application/xhtml+xml',
      'user-agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36',
    },
  })

  if (!response.ok) {
    throw new Error(`Supplier page returned HTTP ${response.status}`)
  }

  return response.text()
}

async function fetchSupplierHtmlWithPowerShell(url: string): Promise<string | undefined> {
  if (process.platform !== 'win32') return undefined

  try {
    const { stdout } = await execFileAsync(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        [
          "$ProgressPreference = 'SilentlyContinue'",
          "$headers = @{ 'User-Agent' = 'Mozilla/5.0'; 'Accept' = 'text/html,application/xhtml+xml' }",
          '(Invoke-WebRequest -Uri $env:SUPPLIER_FETCH_URL -Headers $headers -UseBasicParsing).Content',
        ].join('; '),
      ],
      {
        env: {
          ...process.env,
          SUPPLIER_FETCH_URL: url,
        },
        maxBuffer: 12 * 1024 * 1024,
        timeout: 30000,
      },
    )

    return stdout
  } catch {
    return undefined
  }
}

function getPriceCandidateFromHtml(html: string): {
  structuredPrice?: ReturnType<typeof extractStructuredPrice>
  text: string
  title: string
  unitPrice?: number
} {
  const title = extractTitle(html)
  const text = stripHtml(html)
  const structuredPrice = extractStructuredPrice(html)
  const prices = structuredPrice
    ? [structuredPrice.unitPrice]
    : [...extractJsonLdPrices(html), ...extractTextPrices(text)]
  const uniquePrices = [...new Set(prices)].sort((a, b) => a - b)

  return {
    structuredPrice,
    text,
    title,
    unitPrice: uniquePrices[0],
  }
}

export async function scrapeSupplierPrice(
  url: string,
  pricingKey?: string | null,
): Promise<ScrapedPrice> {
  const fetchUrl = getSupplierFetchUrl(url)
  let html = await fetchSupplierHtml(fetchUrl)
  let candidate = getPriceCandidateFromHtml(html)

  if (!candidate.unitPrice) {
    const fallbackHtml = await fetchSupplierHtmlWithPowerShell(fetchUrl)

    if (fallbackHtml) {
      const fallbackCandidate = getPriceCandidateFromHtml(fallbackHtml)

      if (fallbackCandidate.unitPrice) {
        html = fallbackHtml
        candidate = fallbackCandidate
      }
    }
  }

  const { structuredPrice, text, title, unitPrice } = candidate

  if (!unitPrice) {
    if (/\bPOA\b|price\s*on\s*application|price\s*on\s*request/i.test(text)) {
      throw new Error(
        'Supplier page returned POA instead of a numeric public price. Open the product page in a browser or enter this supplier price manually.',
      )
    }

    throw new Error('No public price could be parsed from this product page')
  }

  let unitInfo = structuredPrice?.unit
    ? {
        unit: structuredPrice.unit,
        unitQuantity: structuredPrice.unitQuantity,
      }
    : inferUnitFromText(text)
  let resolvedUnitPrice = unitPrice
  let bagWeightKg: number | undefined

  if (
    shouldUseAIPriceFallback({
      pricingKey,
      unit: unitInfo.unit,
      unitPrice,
    })
  ) {
    try {
      const aiParsed = await parseSupplierPriceWithAI({
        pricingKey,
        textSnippet: extractPriceContextSnippet(html, text),
        url: fetchUrl,
      })

      if (isSafeAIPriceParse(aiParsed, pricingKey)) {
        resolvedUnitPrice = aiParsed.price
        unitInfo = {
          unit: aiParsed.unit,
          unitQuantity: aiParsed.unitQuantity ?? undefined,
        }
        bagWeightKg = aiParsed.bagWeightKg ?? undefined
      }
    } catch {
      // Keep the deterministic parse result when the optional AI fallback is unavailable.
    }
  }

  return {
    title,
    unitPrice: resolvedUnitPrice,
    currency: 'AUD',
    unit: unitInfo.unit,
    unitQuantity: unitInfo.unitQuantity,
    bagWeightKg,
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
    unitQuantity?: number | null
    lastPrice?: number | null
  }>) {
    if (!isPricingKey(source.pricingKey) || typeof source.lastPrice !== 'number') continue
      const prices = priceGroups.get(source.pricingKey) ?? []
      prices.push(
        normalizeSupplierUnitPrice({
          pricingKey: source.pricingKey,
          unit: source.unit,
          unitQuantity: source.unitQuantity,
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
          unitQuantity?: number | null
          customUnit?: string | null
          bagWeightKg?: number | null
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
            unitQuantity: source.unitQuantity,
            unitPrice: source.lastPrice,
          })
          selectedSupplierPriceDisplay = formatPriceWithUnit(
            source.lastPrice,
            resolveUnitForDisplay(source.unit, source.customUnit),
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
    const displayUnit = resolveUnitForDisplay(existing?.unit, existing?.customUnit)
    const averagePriceDisplay = formatPriceWithUnit(
      averagePrice,
      displayUnit,
      existing?.unitQuantity,
    )
    const manualPriceDisplay = formatPriceWithUnit(
      existing?.manualUnitPrice,
      displayUnit,
      existing?.unitQuantity,
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
            displayUnit,
            existing.unitQuantity,
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
