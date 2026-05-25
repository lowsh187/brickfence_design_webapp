import type { CollectionConfig, Where } from 'payload'

import { adminsOnly, anyone } from '../access'
import { pricingKeyOptions, pricingUnitOptions } from '../pricingOptions'
import {
  LABOUR_PRICING_KEYS,
  PRICING_KEYS,
  type PricingKey,
  defaultUnitForPricingKey,
  formatPriceWithUnit,
  isLabourPricingKey,
} from '../../pricing'
import {
  getRelationshipID,
  normalizeSupplierUnitPrice,
} from '../../supplierPricing'

const ADMIN_LABOUR_PRICING_KEYS = LABOUR_PRICING_KEYS.filter(
  (key) => key !== 'labour',
)

const PRICING_KEYS_BY_CATEGORY: Record<string, PricingKey[]> = {
  brick: ['standard_brick'],
  mortar: ['mortar'],
  labour: [...ADMIN_LABOUR_PRICING_KEYS],
  infill: ['timber_fence', 'pvc_fence'],
}

const UNITS_BY_PRICING_KEY: Partial<Record<PricingKey, string[]>> = {
  standard_brick: ['each', 'per_quantity'],
  mortar: ['per_bag', 'm3'],
  timber_fence: ['m'],
  pvc_fence: ['m'],
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
        const manualUnitPriceDisplay =
          doc.manualUnitPriceDisplay ||
          formatPriceWithUnit(doc.manualUnitPrice, unit)
        const autoAverageUnitPriceDisplay =
          doc.autoAverageUnitPriceDisplay ||
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

        if (pricingKey === 'standard_brick' && unit === 'per_1000') {
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
          pricingKey === 'standard_brick' &&
          unit === 'per_quantity' &&
          (typeof unitQuantity !== 'number' || unitQuantity <= 1)
        ) {
          unitQuantity = 1000
          data.unitQuantity = unitQuantity
        }
        if (pricingKey === 'mortar' && unit === 'per_bag' && typeof bagWeightKg !== 'number') {
          data.bagWeightKg = 20
        }
        const displayUnit = resolveUnitForDisplay(unit, customUnit)

        data.manualUnitPriceDisplay = formatPriceWithUnit(
          data.manualUnitPrice ?? originalDoc?.manualUnitPrice,
          displayUnit,
          unitQuantity,
        )
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
            data.bagWeightKg = source.bagWeightKg ?? data.bagWeightKg
            const sourceDisplayUnit = resolveUnitForDisplay(
              source.unit,
              source.customUnit,
            )
            data.selectedSupplierUnitPrice = Number(
              normalizeSupplierUnitPrice({
                pricingKey,
                unit: source.unit,
                unitQuantity: source.unitQuantity,
                unitPrice: source.lastPrice,
              }).toFixed(2),
            )
            data.selectedSupplierUnitPriceDisplay = formatPriceWithUnit(
              source.lastPrice,
              sourceDisplayUnit,
              source.unitQuantity,
            )
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
          siblingData.key === 'standard_brick' &&
          siblingData.unit === 'per_quantity',
        description: 'Number of bricks covered by this price.',
      },
      min: 1,
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
        condition: (_, siblingData) => siblingData.priceSource === 'manual',
        description:
          'Company controlled price. Used when Price Source is Manual price.',
      },
      min: 0,
    },
    {
      name: 'manualUnitPriceDisplay',
      type: 'text',
      admin: {
        condition: (_, siblingData) => siblingData.priceSource === 'manual',
        description: 'Manual price with unit.',
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
