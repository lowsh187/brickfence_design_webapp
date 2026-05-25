export type AISupplierPriceParse = {
  bagWeightKg?: number | null
  confidence: number
  evidence: string
  price?: number | null
  reason: string
  unit?: 'custom' | 'each' | 'm' | 'm2' | 'm3' | 'per_bag' | 'per_quantity' | null
  unitQuantity?: number | null
}

type GeminiCandidate = {
  content?: {
    parts?: Array<{
      text?: string
    }>
  }
}

type GeminiResponse = {
  candidates?: GeminiCandidate[]
}

function extractResponseText(response: GeminiResponse): string {
  return response.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? '')
    .join('')
    .trim() ?? ''
}

function parseJSONResponse(text: string): AISupplierPriceParse | null {
  if (!text) return null

  try {
    return JSON.parse(text) as AISupplierPriceParse
  } catch {
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return null

    try {
      return JSON.parse(match[0]) as AISupplierPriceParse
    } catch {
      return null
    }
  }
}

export function isSafeAIPriceParse(
  result: AISupplierPriceParse | null,
  pricingKey: string | null | undefined,
): result is AISupplierPriceParse & { price: number; unit: NonNullable<AISupplierPriceParse['unit']> } {
  if (!result) return false
  if (result.confidence < 0.85) return false
  if (typeof result.price !== 'number' || !Number.isFinite(result.price) || result.price <= 0) {
    return false
  }
  if (!result.unit) return false

  if (pricingKey === 'standard_brick') {
    if (result.unit === 'each' && result.price > 20) return false
    if (result.unit === 'per_quantity') {
      return (
        typeof result.unitQuantity === 'number' &&
        Number.isFinite(result.unitQuantity) &&
        result.unitQuantity > 1
      )
    }
  }

  if (pricingKey === 'mortar' && result.unit === 'per_bag') {
    return (
      result.bagWeightKg == null ||
      (typeof result.bagWeightKg === 'number' &&
        Number.isFinite(result.bagWeightKg) &&
        result.bagWeightKg > 0)
    )
  }

  return true
}

export async function parseSupplierPriceWithAI(params: {
  pricingKey: string | null | undefined
  textSnippet: string
  url: string
}): Promise<AISupplierPriceParse | null> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return null

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: [
                  'Extract the main product price and unit from supplier webpage text.',
                  'Ignore delivery fees, unrelated products, recommended products, and $0.00 schema prices.',
                  'Return only JSON with this shape:',
                  '{"price":number|null,"unit":"each|per_quantity|per_bag|m3|m2|m|custom"|null,"unitQuantity":number|null,"bagWeightKg":number|null,"confidence":number,"evidence":string,"reason":string}',
                  'For brick prices like "per 1000" or "per 500", use unit "per_quantity" and set unitQuantity.',
                  'For bag prices, use unit "per_bag" and set bagWeightKg if the page states a bag weight.',
                  `Pricing key: ${params.pricingKey ?? 'unknown'}`,
                  `URL: ${params.url}`,
                  `Text snippet:\n${params.textSnippet}`,
                ].join('\n'),
              },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0,
        },
      }),
      headers: {
        'Content-Type': 'application/json',
      },
      method: 'POST',
    },
  )

  if (!response.ok) {
    throw new Error(`Gemini price parser returned HTTP ${response.status}`)
  }

  const data = (await response.json()) as GeminiResponse
  return parseJSONResponse(extractResponseText(data))
}
