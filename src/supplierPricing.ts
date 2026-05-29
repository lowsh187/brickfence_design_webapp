import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

import type { Payload } from 'payload'

import {
  type PricingKey,
  type PvcPricingMode,
  type TimberProductType,
  PVC_FENCE_PANEL_SPECS,
  formatPvcPriceDisplay,
  formatPriceWithUnit,
  inferPvcFencePanelSize,
  inferTimberProductType,
  isPricingKey,
  isPvcFencePricingKey,
  isTimberFencePricingKey,
  normalizePvcPanelPrices,
  type PvcFencePanelSize,
} from './pricing'
import {
  isSafeAIPriceParse,
  type AISupplierPriceParse,
  parseSupplierPriceWithAI,
} from './supplierPriceAI'
import { assertSafeSupplierUrl } from './security'

const execFileAsync = promisify(execFile)
const SUPPLIER_FETCH_TIMEOUT_MS = 15000
const SUPPLIER_FETCH_MAX_BYTES = 2 * 1024 * 1024
const SUPPLIER_FETCH_MAX_REDIRECTS = 3

export type SupplierPriceSourceDoc = {
  id: number | string
  supplierName?: string | null
  pricingKey?: string | null
  productUrl?: string | null
  unit?: string | null
  pvcPricingMode?: string | null
  pvcPanelPriceDisplay?: string | null
  timberProductType?: string | null
  detectedTimberProductType?: string | null
  timberProductTypeWarning?: string | null
  unitConversionFactor?: number | null
  unitConversionNote?: string | null
  unitQuantity?: number | null
  pvcPanelSize?: string | null
  customUnit?: string | null
  bagWeightKg?: number | null
  isEnabled?: boolean | null
  includesGST?: boolean | null
  lastPrice?: number | null
  lastFetchedAt?: string | null
}

export type PvcFencePanelScrapeResult = Partial<Record<PvcFencePanelSize, {
  currency: string
  price: number
  title: string
  url: string
}>>

type ScrapedPrice = {
  bagWeightKg?: number
  title: string
  unitPrice: number
  currency: string
  unit?: string
  pvcPricingMode?: PvcPricingMode
  detectedTimberProductType?: TimberProductType
  unitConversionFactor?: number
  unitConversionNote?: string
  unitQuantity?: number
  pvcPanelSize?: PvcFencePanelSize
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
  unitConversionFactor?: number | null
  unitQuantity?: number | null
  unitPrice: number
}): number {
  if (
    (params.pricingKey === 'standard_brick' || params.pricingKey === 'custom_brick') &&
    params.unit === 'per_1000'
  ) {
    return params.unitPrice / 1000
  }

  if (
    (params.pricingKey === 'standard_brick' || params.pricingKey === 'custom_brick') &&
    params.unit === 'per_quantity'
  ) {
    const quantity =
      typeof params.unitQuantity === 'number' &&
      Number.isFinite(params.unitQuantity) &&
      params.unitQuantity > 0
        ? params.unitQuantity
        : 1

    return params.unitPrice / quantity
  }

  if (
    params.unit === 'custom' &&
    typeof params.unitConversionFactor === 'number' &&
    Number.isFinite(params.unitConversionFactor) &&
    params.unitConversionFactor > 0
  ) {
    return params.unitPrice / params.unitConversionFactor
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

function extractCurrency(html: string): string {
  return (
    html.match(/<meta[^>]+itemprop=["']priceCurrency["'][^>]+content=["']([^"']+)["']/i)?.[1] ??
    html.match(/priceCurrency["']?\s*:\s*["']([A-Z]{3})["']/i)?.[1] ??
    'AUD'
  ).toUpperCase()
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

function buildPvcFencePanelUrl(sourceUrl: string, panelSize: PvcFencePanelSize): string | undefined {
  try {
    const parsed = new URL(sourceUrl)
    const feet = panelSize.replace('ft', '')
    const styleSlug = parsed.pathname.includes('t-top-railing')
      ? 't-top-railing'
      : 't-style-vinyl-railing'

    parsed.pathname = `/products/detail/36-high-x-${feet}-long-white-${styleSlug}`
    parsed.search = ''
    parsed.hash = ''
    return parsed.toString()
  } catch {
    return undefined
  }
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
}

function decodeJavaScriptString(value: string): string {
  return value
    .replace(/\\"/g, '"')
    .replace(/\\'/g, "'")
    .replace(/\\\\/g, '\\')
}

function extractFencingDirectMainProduct(html: string):
  | {
      price: number
      size?: string
      title: string
    }
  | undefined {
  const productMatch = html.match(/w\.mainProduct\s*=\s*\{([\s\S]*?)\};/i)
  const productBody = productMatch?.[1]
  if (!productBody) return undefined

  const priceText = productBody.match(/\bbase_price:\s*([0-9]+(?:\.[0-9]+)?)/i)?.[1]
  const titleText = productBody.match(/\btitle:\s*"((?:\\.|[^"])*)"/i)?.[1]
  const sizeText = productBody.match(/\bsize:\s*"((?:\\.|[^"])*)"/i)?.[1]
  const price = priceText ? Number.parseFloat(priceText) : Number.NaN
  if (!Number.isFinite(price) || price <= 0 || !titleText) return undefined

  return {
    price,
    size: sizeText ? decodeJavaScriptString(sizeText).trim() : undefined,
    title: decodeJavaScriptString(titleText).trim(),
  }
}

function extractFencingDirectOptionsGridEndpoint(html: string, sourceUrl: string): string | undefined {
  const endpoint = html.match(/OPTIONS_GRID_ENDPOINT\s*=\s*"([^"]+)"/i)?.[1]
  if (!endpoint) return undefined

  try {
    return new URL(endpoint.replace(/\\\//g, '/'), sourceUrl).toString()
  } catch {
    return undefined
  }
}

function extractFencingDirectColor(html: string): string {
  const color = html.match(/id=["']current-color["'][^>]*>([\s\S]*?)<\/span>/i)?.[1]
  return decodeHtmlEntities(stripHtml(color ?? '')).trim() || 'White'
}

function extractFencingDirectSizeOptions(html: string): Partial<Record<PvcFencePanelSize, string>> {
  const options: Partial<Record<PvcFencePanelSize, string>> = {}
  const grid = html.match(/id=["']size-grid["'][^>]*>([\s\S]*?)<\/div>/i)?.[1]
  if (!grid) return options

  for (const match of grid.matchAll(/<a\b[\s\S]*?<\/a>/gi)) {
    const label = decodeHtmlEntities(stripHtml(match[0])).replace(/\s+/g, ' ').trim()
    const panelSize = inferPvcFencePanelSize(label)
    if (panelSize) options[panelSize] = label
  }

  return options
}

async function fetchFencingDirectVariantHtml(params: {
  color: string
  endpoint: string
  referrer: string
  sizeLabel: string
}): Promise<string> {
  const safeEndpoint = await assertSafeSupplierUrl(params.endpoint)
  const response = await fetch(safeEndpoint, {
    body: new URLSearchParams({
      color: params.color,
      size: params.sizeLabel,
    }),
    headers: {
      accept: 'text/html, */*; q=0.01',
      'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
      referer: params.referrer,
      'user-agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36',
      'x-requested-with': 'XMLHttpRequest',
    },
    method: 'POST',
    redirect: 'manual',
    signal: AbortSignal.timeout(SUPPLIER_FETCH_TIMEOUT_MS),
  })

  if (!response.ok) {
    throw new Error(`Supplier variant endpoint returned HTTP ${response.status}`)
  }

  return responseToLimitedText(response)
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

function extractMainEachProductPrice(text: string):
  | {
      unitPrice: number
      unit: string
    }
  | undefined {
  const measurementMatch = text.match(/Measurement Unit:\s*Ea/i)
  if (!measurementMatch || typeof measurementMatch.index !== 'number') return undefined

  const context = text.slice(Math.max(0, measurementMatch.index - 1200), measurementMatch.index)
  const priceMatches = [
    ...context.matchAll(/\$\s*([0-9]{1,4}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?)/g),
  ]
  const priceText = priceMatches.at(-1)?.[1]
  const unitPrice = priceText
    ? Number.parseFloat(priceText.replace(/,/g, ''))
    : Number.NaN

  if (!Number.isFinite(unitPrice) || unitPrice <= 0) return undefined

  return {
    unit: 'each',
    unitPrice,
  }
}

function normalizeProductText(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLowerCase()
}

function extractPrimaryProductEachPrice(text: string, title: string):
  | {
      unitPrice: number
      unit: string
    }
  | undefined {
  const addToCartMatch = text.match(/\bAdd to Cart\b/i)
  const productAreaEnd = addToCartMatch?.index ?? Math.min(text.length, 5000)
  const productPrefix = text.slice(0, productAreaEnd)
  const normalizedPrefix = normalizeProductText(productPrefix)
  const normalizedTitle = normalizeProductText(title)
  const normalizedTitleIndex = normalizedTitle
    ? normalizedPrefix.lastIndexOf(normalizedTitle)
    : -1
  const roughTitleIndex =
    normalizedTitleIndex >= 0
      ? productPrefix.toLowerCase().lastIndexOf(title.toLowerCase().slice(0, 24))
      : -1
  const context =
    roughTitleIndex >= 0
      ? productPrefix.slice(roughTitleIndex)
      : productPrefix.slice(Math.max(0, productPrefix.length - 1800))
  const priceMatches = [
    ...context.matchAll(/\$\s*([0-9]{1,4}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?)/g),
  ]

  for (const match of priceMatches) {
    const priceText = match[1]
    const index = match.index ?? 0
    const before = context.slice(Math.max(0, index - 30), index).toLowerCase()
    if (/\b(rrp|save|saving|paypal|payment|delivery|shipping|freight)\b/.test(before)) continue

    const unitPrice = Number.parseFloat(priceText.replace(/,/g, ''))
    if (Number.isFinite(unitPrice) && unitPrice > 0 && unitPrice < 10000) {
      return {
        unit: 'each',
        unitPrice,
      }
    }
  }

  return undefined
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
  const productContextPatterns = [
    /\b[0-9]+\s*x\s*[0-9]+mm\b[\s\S]{0,2200}?\bAdd to Cart\b/gi,
    /\b(?:picket|paling|screening|slat|fence)\b[\s\S]{0,2200}?\bAdd to Cart\b/gi,
    /\$\s*[0-9]{1,4}\s*[.\s]\s*[0-9]{2}[\s\S]{0,800}/g,
    /\$\s*[0-9]{1,4}\s*[.\s]\s*[0-9]{2}\s*per\s+linear\s+metre[\s\S]{0,800}/gi,
  ]
  const htmlPatterns = [
    /data-price-amount=["']?([0-9][0-9,]*(?:\.[0-9]+)?)["']?[\s\S]{0,500}/gi,
    /\$\s*[0-9]{1,4}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?[\s\S]{0,500}/g,
    /class=["'][^"']*(?:uom|price)[^"']*["'][\s\S]{0,500}/gi,
  ]

  for (const pattern of productContextPatterns) {
    for (const match of text.matchAll(pattern)) {
      if (match[0]) snippets.push(match[0])
      if (snippets.length >= 4) break
    }
    if (snippets.length >= 4) break
  }

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
  if (isPvcFencePricingKey(params.pricingKey)) return true
  if (isTimberFencePricingKey(params.pricingKey)) {
    return isSuspiciousTimberPrice({
      unit: params.unit,
      unitPrice: params.unitPrice,
    })
  }

  if (!params.unit) return true

  return (
    (params.pricingKey === 'standard_brick' || params.pricingKey === 'custom_brick') &&
    params.unit === 'each' &&
    params.unitPrice > 20
  )
}

async function parseSupplierPriceWithAISafely(params: {
  html: string
  pricingKey?: string | null
  text: string
  url: string
}): Promise<AISupplierPriceParse | null> {
  try {
    return await parseSupplierPriceWithAI({
      pricingKey: params.pricingKey,
      textSnippet: extractPriceContextSnippet(params.html, params.text),
      url: params.url,
    })
  } catch {
    return null
  }
}

function isSuspiciousTimberPrice(params: {
  unit?: string
  unitPrice: number
}): boolean {
  if (!params.unit) return true
  if (params.unit !== 'each' && params.unit !== 'm' && params.unit !== 'custom') return true

  return params.unitPrice >= 100
}

async function responseToLimitedText(response: Response): Promise<string> {
  const contentLength = Number.parseInt(response.headers.get('content-length') ?? '', 10)
  if (Number.isFinite(contentLength) && contentLength > SUPPLIER_FETCH_MAX_BYTES) {
    throw new Error('Supplier page is too large to parse safely.')
  }

  const text = await response.text()
  if (new TextEncoder().encode(text).byteLength > SUPPLIER_FETCH_MAX_BYTES) {
    throw new Error('Supplier page is too large to parse safely.')
  }

  return text
}

async function fetchSupplierHtml(
  url: string,
  redirectCount = 0,
): Promise<string> {
  const safeUrl = await assertSafeSupplierUrl(url)
  const response = await fetch(safeUrl, {
    headers: {
      accept: 'text/html,application/xhtml+xml',
      'user-agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36',
    },
    redirect: 'manual',
    signal: AbortSignal.timeout(SUPPLIER_FETCH_TIMEOUT_MS),
  })

  if ([301, 302, 303, 307, 308].includes(response.status)) {
    if (redirectCount >= SUPPLIER_FETCH_MAX_REDIRECTS) {
      throw new Error('Supplier page returned too many redirects.')
    }

    const location = response.headers.get('location')
    if (!location) {
      throw new Error('Supplier page redirected without a location.')
    }

    return fetchSupplierHtml(new URL(location, safeUrl).toString(), redirectCount + 1)
  }

  if (!response.ok) {
    throw new Error(`Supplier page returned HTTP ${response.status}`)
  }

  return responseToLimitedText(response)
}

async function fetchSupplierHtmlWithPowerShell(url: string): Promise<string | undefined> {
  if (process.platform !== 'win32') return undefined

  try {
    await assertSafeSupplierUrl(url)
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
        maxBuffer: SUPPLIER_FETCH_MAX_BYTES,
        timeout: SUPPLIER_FETCH_TIMEOUT_MS,
      },
    )

    if (new TextEncoder().encode(stdout).byteLength > SUPPLIER_FETCH_MAX_BYTES) {
      return undefined
    }

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
  const fencingDirectMainProduct = extractFencingDirectMainProduct(html)
  const title = fencingDirectMainProduct?.title ?? extractTitle(html)
  const text = stripHtml(html)
  if (fencingDirectMainProduct) {
    return {
      structuredPrice: {
        unit: 'each',
        unitPrice: fencingDirectMainProduct.price,
      },
      text,
      title,
      unitPrice: fencingDirectMainProduct.price,
    }
  }

  const mainEachProductPrice = extractMainEachProductPrice(text)
  if (mainEachProductPrice) {
    return {
      structuredPrice: mainEachProductPrice,
      text,
      title,
      unitPrice: mainEachProductPrice.unitPrice,
    }
  }

  const primaryProductEachPrice = extractPrimaryProductEachPrice(text, title)
  if (primaryProductEachPrice) {
    return {
      structuredPrice: primaryProductEachPrice,
      text,
      title,
      unitPrice: primaryProductEachPrice.unitPrice,
    }
  }

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
    if (isTimberFencePricingKey(pricingKey)) {
      const aiParsed = await parseSupplierPriceWithAISafely({
        html,
        pricingKey,
        text,
        url: fetchUrl,
      })

      if (isSafeAIPriceParse(aiParsed, pricingKey)) {
        return {
          title,
          unitPrice: aiParsed.price,
          currency: extractCurrency(html),
          unit: aiParsed.unit,
          unitConversionFactor: aiParsed.unitConversionFactor ?? undefined,
          unitConversionNote: aiParsed.unitConversionNote ?? undefined,
          unitQuantity: aiParsed.unitQuantity ?? undefined,
          bagWeightKg: aiParsed.bagWeightKg ?? undefined,
          detectedTimberProductType: inferTimberProductType(
            `${fetchUrl} ${title} ${text.slice(0, 3000)}`,
          ),
        }
      }
    }

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
  let unitConversionFactor: number | undefined
  let unitConversionNote: string | undefined

  if (
    shouldUseAIPriceFallback({
      pricingKey,
      unit: unitInfo.unit,
      unitPrice,
    })
  ) {
    const aiParsed = await parseSupplierPriceWithAISafely({
      html,
      pricingKey,
      text,
      url: fetchUrl,
    })

    if (isSafeAIPriceParse(aiParsed, pricingKey)) {
      resolvedUnitPrice = aiParsed.price
      unitInfo = {
        unit: aiParsed.unit,
        unitQuantity: aiParsed.unitQuantity ?? undefined,
      }
      bagWeightKg = aiParsed.bagWeightKg ?? undefined
      unitConversionFactor = aiParsed.unitConversionFactor ?? undefined
      unitConversionNote = aiParsed.unitConversionNote ?? undefined
    } else if (
      isTimberFencePricingKey(pricingKey) &&
      isSuspiciousTimberPrice({
        unit: unitInfo.unit,
        unitPrice,
      })
    ) {
      throw new Error(
        'URL parsing found a suspicious timber price, and AI-assisted parsing could not confirm the public product price. Please double check the supplier page or enter this price manually.',
      )
    }
  }

  return {
    title,
    unitPrice: resolvedUnitPrice,
    currency: extractCurrency(html),
    unit: unitInfo.unit,
    pvcPricingMode: isPvcFencePricingKey(pricingKey)
      ? unitInfo.unit === 'm'
        ? 'per_m'
        : 'panel'
      : undefined,
    unitConversionFactor,
    unitConversionNote,
    unitQuantity: unitInfo.unitQuantity,
    bagWeightKg,
    pvcPanelSize: isPvcFencePricingKey(pricingKey)
      ? inferPvcFencePanelSize(`${fetchUrl} ${title} ${text.slice(0, 1000)}`)
      : undefined,
    detectedTimberProductType: isTimberFencePricingKey(pricingKey)
      ? inferTimberProductType(`${fetchUrl} ${title} ${text.slice(0, 3000)}`)
      : undefined,
  }
}

export async function scrapePvcFencePanelPrices(
  url: string,
): Promise<PvcFencePanelScrapeResult> {
  const prices: PvcFencePanelScrapeResult = {}
  const initialHtml = await fetchSupplierHtml(url)
  const endpoint = extractFencingDirectOptionsGridEndpoint(initialHtml, url)
  const color = extractFencingDirectColor(initialHtml)
  const sizeOptions = extractFencingDirectSizeOptions(initialHtml)

  if (endpoint && Object.keys(sizeOptions).length > 0) {
    for (const spec of PVC_FENCE_PANEL_SPECS) {
      const sizeLabel = sizeOptions[spec.label]
      if (!sizeLabel) continue

      try {
        const variantHtml = await fetchFencingDirectVariantHtml({
          color,
          endpoint,
          referrer: url,
          sizeLabel,
        })
        const mainProduct = extractFencingDirectMainProduct(variantHtml)
        const scraped = getPriceCandidateFromHtml(variantHtml)
        const panelSize =
          inferPvcFencePanelSize(`${mainProduct?.size ?? ''} ${mainProduct?.title ?? ''}`) ??
          inferPvcFencePanelSize(`${sizeLabel} ${scraped.title}`)
        if (!panelSize || typeof scraped.unitPrice !== 'number') continue

        prices[panelSize] = {
          currency: extractCurrency(variantHtml),
          price: scraped.unitPrice,
          title: scraped.title,
          url,
        }
      } catch {
        // Skip unavailable variant options so one failed size does not fail the batch.
      }
    }

    if (Object.keys(prices).length > 0) return prices
  }

  for (const spec of PVC_FENCE_PANEL_SPECS) {
    const panelUrl = buildPvcFencePanelUrl(url, spec.label)
    if (!panelUrl) continue

    try {
      const scraped = await scrapeSupplierPrice(panelUrl, 'pvc_fence')
      const panelSize =
        scraped.pvcPanelSize ?? inferPvcFencePanelSize(`${panelUrl} ${scraped.title}`)
      if (!panelSize) continue

      prices[panelSize] = {
        currency: scraped.currency,
        price: scraped.unitPrice,
        title: scraped.title,
        url: panelUrl,
      }
    } catch {
      // Skip unavailable panel URLs so one missing size does not fail the batch.
    }
  }

  return prices
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
  const pvcPanelPriceGroups = new Map<PvcFencePanelSize, number[]>()

  for (const source of sourceResult.docs as Array<{
    pricingKey?: string | null
    unit?: string | null
    pvcPricingMode?: string | null
    unitConversionFactor?: number | null
    unitQuantity?: number | null
    lastPrice?: number | null
    pvcPanelPrices?: {
      eightFt?: number | null
      fiveFt?: number | null
      fourFt?: number | null
      sixFt?: number | null
      tenFt?: number | null
    } | null
  }>) {
    if (!isPricingKey(source.pricingKey) || typeof source.lastPrice !== 'number') continue
      if (source.pricingKey === 'pvc_fence' && source.pvcPricingMode !== 'per_m') {
        const normalized = normalizePvcPanelPrices(
          {
            '4ft': source.pvcPanelPrices?.fourFt ?? undefined,
            '5ft': source.pvcPanelPrices?.fiveFt ?? undefined,
            '6ft': source.pvcPanelPrices?.sixFt ?? undefined,
            '8ft': source.pvcPanelPrices?.eightFt ?? undefined,
            '10ft': source.pvcPanelPrices?.tenFt ?? undefined,
          },
          source.lastPrice,
        ).prices

        for (const spec of PVC_FENCE_PANEL_SPECS) {
          const values = pvcPanelPriceGroups.get(spec.label) ?? []
          values.push(normalized[spec.label])
          pvcPanelPriceGroups.set(spec.label, values)
        }
      }
      const prices = priceGroups.get(source.pricingKey) ?? []
      prices.push(
        normalizeSupplierUnitPrice({
          pricingKey: source.pricingKey,
          unit: source.unit,
          unitConversionFactor: source.unitConversionFactor,
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
            unitConversionFactor: source.unitConversionFactor,
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
    const pvcPanelAveragePrices =
      pricingKey === 'pvc_fence'
        ? Object.fromEntries(
          PVC_FENCE_PANEL_SPECS.map((spec) => {
            const values = pvcPanelPriceGroups.get(spec.label) ?? []
            const panelAverage =
              values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length)

            return [spec.label, Number(panelAverage.toFixed(2))]
          }),
        ) as Record<PvcFencePanelSize, number>
        : undefined
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
          pvcPanelPrices: pvcPanelAveragePrices
            ? {
                eightFt: pvcPanelAveragePrices['8ft'],
                fiveFt: pvcPanelAveragePrices['5ft'],
                fourFt: pvcPanelAveragePrices['4ft'],
                sixFt: pvcPanelAveragePrices['6ft'],
                tenFt: pvcPanelAveragePrices['10ft'],
              }
            : undefined,
          pvcPanelPriceDisplay: pvcPanelAveragePrices
            ? formatPvcPriceDisplay({
              mode: 'panel',
              panelPrices: pvcPanelAveragePrices,
            })
            : undefined,
          pvcPanelPriceWarning: pvcPanelAveragePrices ? '' : undefined,
        },
      })
    }
  }
}
