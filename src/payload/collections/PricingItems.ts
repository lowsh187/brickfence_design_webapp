import type { CollectionConfig, Where } from 'payload'

import { adminsOnly, anyone } from '../access'
import { pricingKeyOptions, pricingUnitOptions } from '../pricingOptions'
import {
  LABOUR_PRICING_KEYS,
  PRICING_KEYS,
  formatPvcPanelPriceSummary,
  formatPvcPriceDisplay,
  type PricingKey,
  defaultUnitForPricingKey,
  formatPriceWithUnit,
  isLabourPricingKey,
  normalizePvcPanelPrices,
} from '../../pricing'
import {
  getRelationshipID,
  normalizeSupplierUnitPrice,
} from '../../supplierPricing'

const ADMIN_LABOUR_PRICING_KEYS = LABOUR_PRICING_KEYS.filter(
  (key) => key !== 'labour',
)

const PRICING_KEYS_BY_CATEGORY: Record<string, PricingKey[]> = {
  brick: ['standard_brick', 'custom_brick'],
  mortar: ['mortar'],
  labour: [...ADMIN_LABOUR_PRICING_KEYS],
  infill: ['timber_screening_slat', 'timber_picket', 'pvc_fence'],
}

const UNITS_BY_PRICING_KEY: Partial<Record<PricingKey, string[]>> = {
  standard_brick: ['each', 'per_quantity'],
  custom_brick: ['each', 'per_quantity'],
  mortar: ['per_bag', 'm3'],
  timber_screening_slat: ['m'],
  timber_picket: ['each'],
  timber_fence: ['m'],
  pvc_fence: ['each', 'm'],
}

const PRICE_SOURCE_OPTIONS = [
  { label: 'Manual price', value: 'manual' },
  { label: 'Supplier average price', value: 'average' },
  { label: 'Specific supplier price', value: 'supplier' },
]

function getAllowedPricingKeys(category: string | null | undefined): PricingKey[] {
  return category ? PRICING_KEYS_BY_CATEGORY[category] ?? [...PRICING_KEYS] : [...PRICING_KEYS]
}

function getAllowedUnits(
  pricingKey: string | null | undefined,
  category?: string | null,
): string[] {
  if (isLabourPricingKey(pricingKey)) return ['per_brick', 'custom']
  if (!pricingKey && category) {
    const categoryKeys = getAllowedPricingKeys(category)
    const units = new Set(
      categoryKeys.flatMap((key) =>
        isLabourPricingKey(key)
          ? ['per_brick']
          : UNITS_BY_PRICING_KEY[key] ?? [defaultUnitForPricingKey(key)],
      ),
    )
    units.add('custom')

    return [...units]
  }

  if (pricingKey && pricingKey in UNITS_BY_PRICING_KEY) {
    return [
      ...(UNITS_BY_PRICING_KEY[pricingKey as PricingKey] ?? [defaultUnitForPricingKey(pricingKey)]),
      'custom',
    ]
  }

  return pricingUnitOptions.map((option) => option.value)
}

function resolveUnitForDisplay(
  unit: string | null | undefined,
  customUnit: string | null | undefined,
): string | null | undefined {
  return unit === 'custom' ? customUnit || unit : unit
}

function pvcPanelPriceFieldName(size: string | null | undefined):
  | 'fourFt'
  | 'fiveFt'
  | 'sixFt'
  | 'eightFt'
  | 'tenFt'
  | undefined {
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
    default:
      return undefined
  }
}

function readPvcPanelPrices(value: {
  eightFt?: number | null
  fiveFt?: number | null
  fourFt?: number | null
  sixFt?: number | null
  tenFt?: number | null
} | null | undefined) {
  return {
    '4ft': value?.fourFt ?? undefined,
    '5ft': value?.fiveFt ?? undefined,
    '6ft': value?.sixFt ?? undefined,
    '8ft': value?.eightFt ?? undefined,
    '10ft': value?.tenFt ?? undefined,
  }
}

function optionValue(option: string | { value: string }): string {
  return typeof option === 'string' ? option : option.value
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

function getPvcPricingMode(data: {
  pvcPricingMode?: string | null
  unit?: string | null
}): 'panel' | 'per_m' {
  return data.pvcPricingMode === 'per_m' || data.unit === 'm' ? 'per_m' : 'panel'
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

export const PricingItems: CollectionConfig = {
  slug: 'pricing-items',
  admin: {
    defaultColumns: [
      'key',
      'finalPriceDisplay',
      'finalPriceSourceDisplay',
      'unit',
      'isActive',
    ],
    group: 'Company Settings',
    useAsTitle: 'key',
  },
  access: {
    create: adminsOnly,
    delete: adminsOnly,
    read: anyone,
    update: adminsOnly,
  },
  hooks: {
    afterRead: [
      async ({ doc, req }) => {
        const unit = resolveUnitForDisplay(doc.unit, doc.customUnit)
        const pvcPricingMode = getPvcPricingMode(doc)
        const manualUnitPriceDisplay =
          doc.key === 'pvc_fence'
            ? formatPvcPriceDisplay({
              mode: pvcPricingMode,
              panelPrices: readPvcPanelPrices(doc.pvcPanelPrices),
              unitPrice: doc.manualUnitPrice,
            })
            : doc.manualUnitPriceDisplay ||
              formatPriceWithUnit(doc.manualUnitPrice, unit)
        const autoAverageUnitPriceDisplay =
          doc.key === 'pvc_fence' && pvcPricingMode === 'panel'
            ? doc.pvcPanelPriceDisplay || 'No data'
            : doc.autoAverageUnitPriceDisplay ||
              formatPriceWithUnit(doc.autoAverageUnitPrice, unit)
        const selectedSupplierUnitPriceDisplay =
          doc.selectedSupplierUnitPriceDisplay ||
          formatPriceWithUnit(doc.selectedSupplierUnitPrice, unit)
        let selectedSupplierName: string | null = null
        const selectedSupplierID = getRelationshipID(doc.selectedSupplierPriceSource)

        if (doc.priceSource === 'supplier' && selectedSupplierID) {
          try {
            const source = await req.payload.findByID({
              collection: 'supplier-price-sources',
              id: selectedSupplierID,
              depth: 0,
              overrideAccess: true,
            })

            selectedSupplierName = source.supplierName || null
          } catch {
            selectedSupplierName = null
          }
        }

        doc.manualUnitPriceDisplay = manualUnitPriceDisplay
        doc.autoAverageUnitPriceDisplay = autoAverageUnitPriceDisplay
        doc.selectedSupplierUnitPriceDisplay = selectedSupplierUnitPriceDisplay
        doc.finalPriceDisplay = getFinalPriceDisplay({
          priceSource: doc.priceSource,
          manualUnitPriceDisplay,
          autoAverageUnitPriceDisplay,
          selectedSupplierUnitPriceDisplay:
            doc.priceSource === 'supplier'
              ? selectedSupplierUnitPriceDisplay
              : '',
        })
        doc.finalPriceSourceDisplay = getFinalPriceSourceDisplay({
          priceSource: doc.priceSource,
          selectedSupplierName,
        })

        return doc
      },
    ],
    beforeValidate: [
      async ({ data, originalDoc, req }) => {
        if (!data) return data

        let priceSource = data.priceSource ?? originalDoc?.priceSource
        const category = data.category ?? originalDoc?.category
        const pricingKey = data.key ?? originalDoc?.key
        let unit = data.unit ?? originalDoc?.unit
        let unitQuantity = data.unitQuantity ?? originalDoc?.unitQuantity
        const customUnit = data.customUnit ?? originalDoc?.customUnit
        const pvcPricingMode =
          data.pvcPricingMode ?? originalDoc?.pvcPricingMode ?? 'panel'
        const unitConversionFactor =
          data.unitConversionFactor ?? originalDoc?.unitConversionFactor
        const bagWeightKg = data.bagWeightKg ?? originalDoc?.bagWeightKg
        const selectedSupplierID = getRelationshipID(
          data.selectedSupplierPriceSource ??
            originalDoc?.selectedSupplierPriceSource,
        )
        const allowedPricingKeys = getAllowedPricingKeys(category)

        if (pricingKey && !allowedPricingKeys.includes(pricingKey)) {
          throw new Error('Selected key does not match the selected category.')
        }

        if (category === 'labour' || (pricingKey && isLabourPricingKey(pricingKey))) {
          priceSource = 'manual'
          data.priceSource = 'manual'
          data.selectedSupplierPriceSource = null
        }

        if ((pricingKey === 'standard_brick' || pricingKey === 'custom_brick') && unit === 'per_1000') {
          unit = 'per_quantity'
          unitQuantity = 1000
          data.unit = unit
          data.unitQuantity = unitQuantity
        }
        const allowedUnits = getAllowedUnits(pricingKey, category)
        if (!unit || !allowedUnits.includes(unit)) {
          unit = allowedUnits[0] ?? defaultUnitForPricingKey(pricingKey)
          data.unit = unit
        }
        if (
          (pricingKey === 'standard_brick' || pricingKey === 'custom_brick') &&
          unit === 'per_quantity' &&
          (typeof unitQuantity !== 'number' || unitQuantity <= 1)
        ) {
          unitQuantity = 1000
          data.unitQuantity = unitQuantity
        }
        if (pricingKey === 'mortar' && unit === 'per_bag' && typeof bagWeightKg !== 'number') {
          data.bagWeightKg = 20
        }
        if (unit === 'custom') {
          if (
            typeof unitConversionFactor !== 'number' ||
            !Number.isFinite(unitConversionFactor) ||
            unitConversionFactor <= 0
          ) {
            data.unitConversionNote =
              'Custom unit needs a conversion factor before it can participate accurately in calculations.'
          }
        } else {
          data.unitConversionFactor = null
          data.unitConversionNote = null
        }
        if (pricingKey === 'pvc_fence') {
          data.pvcPricingMode = pvcPricingMode
          if (pvcPricingMode === 'per_m') {
            unit = 'm'
            data.unit = 'm'
            data.pvcPanelPriceDisplay = ''
            data.pvcPanelPriceWarning = ''
          } else {
            unit = 'each'
            data.unit = 'each'
            const defaultPanelSize = data.pvcDefaultPanelSize ?? originalDoc?.pvcDefaultPanelSize ?? '6ft'
            data.pvcDefaultPanelSize = defaultPanelSize
            const normalizedPanelPrices = normalizePvcPanelPrices(
              readPvcPanelPrices(data.pvcPanelPrices ?? originalDoc?.pvcPanelPrices),
              data.manualUnitPrice ?? originalDoc?.manualUnitPrice,
            )
            data.pvcPanelPriceDisplay = formatPvcPanelPriceSummary(normalizedPanelPrices.prices)
            data.pvcPanelPriceWarning = normalizedPanelPrices.warning
            const panelPriceField = pvcPanelPriceFieldName(defaultPanelSize)
            const panelPrice = panelPriceField
              ? normalizedPanelPrices.prices[defaultPanelSize]
              : undefined

            if (typeof panelPrice === 'number') {
              data.manualUnitPrice = panelPrice
            }
          }
        }
        const displayUnit = resolveUnitForDisplay(unit, customUnit)

        data.manualUnitPriceDisplay = formatPriceWithUnit(
          data.manualUnitPrice ?? originalDoc?.manualUnitPrice,
          displayUnit,
          unitQuantity,
        )
        if (pricingKey === 'pvc_fence') {
          data.manualUnitPriceDisplay = formatPvcPriceDisplay({
            mode: pvcPricingMode,
            panelPrices: readPvcPanelPrices(data.pvcPanelPrices ?? originalDoc?.pvcPanelPrices),
            unitPrice: data.manualUnitPrice ?? originalDoc?.manualUnitPrice,
          })
          data.autoAverageUnitPriceDisplay =
            pvcPricingMode === 'panel'
              ? data.pvcPanelPriceDisplay || 'No data'
              : formatPriceWithUnit(data.autoAverageUnitPrice ?? originalDoc?.autoAverageUnitPrice, 'm')
          data.effectiveUnitPriceDisplay =
            pvcPricingMode === 'panel'
              ? data.pvcPanelPriceDisplay || 'No data'
              : formatPriceWithUnit(data.effectiveUnitPrice ?? originalDoc?.effectiveUnitPrice, 'm')
        }
        data.autoAverageUnitPriceDisplay = formatPriceWithUnit(
          data.autoAverageUnitPrice ?? originalDoc?.autoAverageUnitPrice,
          displayUnit,
          unitQuantity,
        )
        data.effectiveUnitPriceDisplay = formatPriceWithUnit(
          data.effectiveUnitPrice ?? originalDoc?.effectiveUnitPrice,
          displayUnit,
          unitQuantity,
        )
        data.finalPriceSourceDisplay = getFinalPriceSourceDisplay({
          priceSource,
        })

        if (priceSource !== 'supplier' || !selectedSupplierID) {
          data.selectedSupplierUnitPrice = null
          data.selectedSupplierUnitPriceDisplay = ''
          data.finalPriceDisplay = getFinalPriceDisplay({
            priceSource,
            manualUnitPriceDisplay: data.manualUnitPriceDisplay,
            autoAverageUnitPriceDisplay: data.autoAverageUnitPriceDisplay,
            selectedSupplierUnitPriceDisplay: data.selectedSupplierUnitPriceDisplay,
          })
          return data
        }

        try {
          const source = await req.payload.findByID({
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
            data.unit = source.unit ?? unit
            data.unitQuantity = source.unitQuantity ?? data.unitQuantity
            data.customUnit = source.customUnit ?? data.customUnit
            data.pvcPricingMode = source.pvcPricingMode ?? data.pvcPricingMode
            data.unitConversionFactor =
              source.unitConversionFactor ?? data.unitConversionFactor
            data.unitConversionNote =
              source.unitConversionNote ?? data.unitConversionNote
            data.bagWeightKg = source.bagWeightKg ?? data.bagWeightKg
            const sourceDisplayUnit = resolveUnitForDisplay(
              source.unit,
              source.customUnit,
            )
            data.selectedSupplierUnitPrice = Number(
              normalizeSupplierUnitPrice({
                pricingKey,
                unit: source.unit,
                unitConversionFactor: source.unitConversionFactor,
                unitQuantity: source.unitQuantity,
                unitPrice: source.lastPrice,
              }).toFixed(2),
            )
            data.selectedSupplierUnitPriceDisplay = formatPriceWithUnit(
              source.lastPrice,
              sourceDisplayUnit,
              source.unitQuantity,
            )
            if (pricingKey === 'pvc_fence') {
              data.selectedSupplierUnitPriceDisplay =
                source.pvcPricingMode === 'per_m'
                  ? formatPriceWithUnit(source.lastPrice, 'm') || 'No data'
                  : source.pvcPanelPriceDisplay || 'No data'
              data.pvcPanelPriceDisplay = source.pvcPanelPriceDisplay ?? data.pvcPanelPriceDisplay
              data.pvcPanelPrices = source.pvcPanelPrices ?? data.pvcPanelPrices
            }
            data.finalPriceSourceDisplay = getFinalPriceSourceDisplay({
              priceSource,
              selectedSupplierName: source.supplierName,
            })
          } else {
            data.selectedSupplierUnitPrice = null
            data.selectedSupplierUnitPriceDisplay = ''
          }
        } catch {
          data.selectedSupplierUnitPrice = null
          data.selectedSupplierUnitPriceDisplay = ''
        }

        data.finalPriceDisplay = getFinalPriceDisplay({
          priceSource,
          manualUnitPriceDisplay: data.manualUnitPriceDisplay,
          autoAverageUnitPriceDisplay: data.autoAverageUnitPriceDisplay,
          selectedSupplierUnitPriceDisplay: data.selectedSupplierUnitPriceDisplay,
        })

        return data
      },
    ],
  },
  fields: [
    {
      name: 'category',
      type: 'select',
      defaultValue: 'brick',
      options: [
        { label: 'Brick', value: 'brick' },
        { label: 'Mortar', value: 'mortar' },
        { label: 'Labour', value: 'labour' },
        { label: 'Fence infill', value: 'infill' },
      ],
      required: true,
    },
    {
      name: 'key',
      type: 'select',
      hasMany: false,
      options: pricingKeyOptions,
      filterOptions: ({ options, siblingData }) => {
        const category =
          typeof siblingData?.category === 'string'
            ? siblingData.category
            : undefined
        const allowedPricingKeys = new Set(getAllowedPricingKeys(category))

        return options.filter((option) =>
          optionValue(option) !== 'timber_fence' &&
          allowedPricingKeys.has(optionValue(option) as PricingKey),
        )
      },
      required: true,
      unique: true,
    },
    {
      name: 'priceSource',
      type: 'select',
      defaultValue: 'manual',
      options: PRICE_SOURCE_OPTIONS,
      filterOptions: ({ options, siblingData }) => {
        const pricingKey =
          typeof siblingData?.key === 'string' ? siblingData.key : undefined
        const category =
          typeof siblingData?.category === 'string'
            ? siblingData.category
            : undefined

        if (category === 'labour' || isLabourPricingKey(pricingKey)) {
          return options.filter((option) => optionValue(option) === 'manual')
        }

        return options
      },
      required: true,
      admin: {
        description:
          'Choose whether the calculator uses the company manual price or a supplier price. Labour costs are manual only.',
      },
    },
    {
      name: 'selectedSupplierPriceSource',
      type: 'relationship',
      relationTo: 'supplier-price-sources',
      filterOptions: ({ siblingData }) => {
        const pricingKey =
          typeof (siblingData as { key?: unknown })?.key === 'string'
            ? (siblingData as { key: string }).key
            : undefined

        if (!pricingKey) {
          return false
        }

        const where: Where = {
          and: [
            {
              pricingKey: {
                equals: pricingKey,
              },
            },
            {
              lastStatus: {
                equals: 'success',
              },
            },
            {
              isEnabled: {
                equals: true,
              },
            },
          ],
        }

        return where
      },
      admin: {
        allowCreate: false,
        condition: (_, siblingData) => siblingData.priceSource === 'supplier',
        description:
          'Used when Price Source is Specific supplier price. Choose a source that has been fetched successfully. The unit will use the selected supplier source unit.',
      },
    },
    {
      name: 'unit',
      type: 'select',
      defaultValue: 'each',
      options: pricingUnitOptions,
      filterOptions: ({ options, siblingData }) => {
        const pricingKey =
          typeof siblingData?.key === 'string' ? siblingData.key : undefined
        const category =
          typeof siblingData?.category === 'string'
            ? siblingData.category
            : undefined
        const allowedUnits = new Set(getAllowedUnits(pricingKey, category))

        return options.filter((option) => allowedUnits.has(optionValue(option)))
      },
      required: true,
      admin: {
        condition: (_, siblingData) => siblingData.priceSource !== 'supplier',
        description:
          'Set manually for manual and average prices. Specific supplier prices use the selected supplier source unit automatically.',
      },
    },
    {
      name: 'unitQuantity',
      type: 'number',
      defaultValue: 1000,
      admin: {
        condition: (_, siblingData) =>
          (siblingData.key === 'standard_brick' || siblingData.key === 'custom_brick') &&
          siblingData.unit === 'per_quantity',
        description: 'Number of bricks covered by this price.',
      },
      min: 1,
    },
    {
      name: 'pvcPricingMode',
      type: 'select',
      defaultValue: 'panel',
      options: [
        { label: 'Panel size prices', value: 'panel' },
        { label: 'Per metre', value: 'per_m' },
      ],
      admin: {
        condition: (_, siblingData) => siblingData.key === 'pvc_fence',
        description:
          'Choose whether PVC is calculated from fixed panel sizes or actual metre length.',
      },
    },
    {
      name: 'customUnit',
      type: 'text',
      admin: {
        condition: (_, siblingData) =>
          siblingData.priceSource !== 'supplier' && siblingData.unit === 'custom',
        description: 'Enter the custom unit label used for display and pricing.',
      },
    },
    {
      name: 'unitConversionFactor',
      type: 'number',
      admin: {
        condition: (_, siblingData) =>
          siblingData.priceSource !== 'supplier' && siblingData.unit === 'custom',
        description:
          'How many calculator base units one custom unit covers. Example: box of 10 bricks = 10; 2.4m panel = 2.4.',
      },
      min: 0,
    },
    {
      name: 'unitConversionNote',
      type: 'textarea',
      admin: {
        condition: (_, siblingData) => siblingData.unit === 'custom',
        description:
          'AI or admin note explaining how this custom unit is converted for calculation.',
      },
    },
    {
      name: 'bagWeightKg',
      type: 'number',
      defaultValue: 20,
      admin: {
        condition: (_, siblingData) =>
          siblingData.key === 'mortar' && siblingData.unit === 'per_bag',
        description: 'Bag weight in kilograms. Used to estimate mortar bag count.',
      },
      min: 0,
    },
    {
      name: 'manualUnitPrice',
      type: 'number',
      admin: {
        condition: (_, siblingData) =>
          siblingData.priceSource === 'manual' &&
          (siblingData.key !== 'pvc_fence' || siblingData.pvcPricingMode === 'per_m'),
        description:
          'Company controlled price. Used when Price Source is Manual price.',
      },
      min: 0,
    },
    {
      name: 'manualUnitPriceDisplay',
      type: 'text',
      admin: {
        condition: (_, siblingData) =>
          siblingData.priceSource === 'manual' &&
          (siblingData.key !== 'pvc_fence' || siblingData.pvcPricingMode === 'per_m'),
        description: 'Manual price with unit.',
        readOnly: true,
      },
    },
    {
      name: 'pvcDefaultPanelSize',
      type: 'select',
      defaultValue: '6ft',
      options: [
        { label: '4ft', value: '4ft' },
        { label: '5ft', value: '5ft' },
        { label: '6ft', value: '6ft' },
        { label: '8ft', value: '8ft' },
        { label: '10ft', value: '10ft' },
      ],
      admin: {
        condition: (_, siblingData) =>
          siblingData.key === 'pvc_fence' && siblingData.pvcPricingMode !== 'per_m',
        description:
          'Default panel size used for the summary unit price. Cost calculation still selects the right panel per bay.',
      },
    },
    {
      name: 'pvcPanelPrices',
      type: 'group',
      admin: {
        condition: (_, siblingData) =>
          siblingData.key === 'pvc_fence' && siblingData.pvcPricingMode !== 'per_m',
        description:
          'PVC fence is priced per panel. Enter each default panel size price here.',
      },
      fields: [
        {
          name: 'fourFt',
          type: 'number',
          label: '4ft panel price',
          min: 0,
        },
        {
          name: 'fiveFt',
          type: 'number',
          label: '5ft panel price',
          min: 0,
        },
        {
          name: 'sixFt',
          type: 'number',
          label: '6ft panel price',
          min: 0,
        },
        {
          name: 'eightFt',
          type: 'number',
          label: '8ft panel price',
          min: 0,
        },
        {
          name: 'tenFt',
          type: 'number',
          label: '10ft panel price',
          min: 0,
        },
      ],
    },
    {
      name: 'pvcPanelPriceDisplay',
      type: 'text',
      admin: {
        condition: (_, siblingData) =>
          siblingData.key === 'pvc_fence' && siblingData.pvcPricingMode !== 'per_m',
        description: 'Effective PVC panel prices after filling missing sizes.',
        readOnly: true,
      },
    },
    {
      name: 'pvcPanelPriceWarning',
      type: 'textarea',
      admin: {
        condition: (_, siblingData) =>
          siblingData.key === 'pvc_fence' && siblingData.pvcPricingMode !== 'per_m',
        description: 'Shown when one or more PVC panel sizes are using fallback prices.',
        readOnly: true,
      },
    },
    {
      name: 'autoAverageUnitPrice',
      type: 'number',
      admin: {
        hidden: true,
        description: 'Calculated from enabled supplier price sources.',
        readOnly: true,
      },
      min: 0,
    },
    {
      name: 'autoAverageUnitPriceDisplay',
      type: 'text',
      admin: {
        hidden: true,
        description: 'Supplier average price with unit.',
        readOnly: true,
      },
    },
    {
      name: 'selectedSupplierUnitPrice',
      type: 'number',
      admin: {
        hidden: true,
        condition: (_, siblingData) => siblingData.priceSource === 'supplier',
        description:
          'Latest price from the selected supplier source. Calculated from the selected source Last Price.',
        readOnly: true,
      },
      min: 0,
    },
    {
      name: 'selectedSupplierUnitPriceDisplay',
      type: 'text',
      admin: {
        condition: (_, siblingData) => siblingData.priceSource === 'supplier',
        description: 'Latest price from the selected supplier source with unit.',
        readOnly: true,
      },
    },
    {
      name: 'effectiveUnitPrice',
      type: 'number',
      admin: {
        hidden: true,
        description:
          'The price currently used by the calculator based on Price Source.',
        readOnly: true,
      },
      min: 0,
    },
    {
      name: 'effectiveUnitPriceDisplay',
      type: 'text',
      admin: {
        hidden: true,
        description:
          'The price currently used by the calculator with unit.',
        readOnly: true,
      },
    },
    {
      name: 'finalPriceDisplay',
      type: 'text',
      defaultValue: 'No data',
      admin: {
        components: {
          Field: {
            path: './src/payload/admin/PricingLiveFinalPriceField',
            exportName: 'PricingLiveFinalPriceField',
          },
        },
        description:
          'Final price shown in the list. Uses the configured price, then supplier average, then No data.',
        readOnly: true,
      },
    },
    {
      name: 'finalPriceSourceDisplay',
      type: 'text',
      defaultValue: 'No data',
      admin: {
        description: 'Shows where the final price comes from.',
        readOnly: true,
      },
    },
    {
      name: 'currency',
      type: 'text',
      defaultValue: 'AUD',
      required: true,
    },
    {
      name: 'supplier',
      type: 'text',
    },
    {
      name: 'notes',
      type: 'textarea',
    },
    {
      name: 'isActive',
      type: 'checkbox',
      defaultValue: true,
      required: true,
    },
  ],
}
