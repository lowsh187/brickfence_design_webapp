import type { CollectionConfig } from 'payload'

import { adminsOnly, anyone } from '../access'
import { pricingKeyOptions, pricingUnitOptions } from '../pricingOptions'
import { formatPriceWithUnit } from '../../pricing'
import {
  getRelationshipID,
  normalizeSupplierUnitPrice,
} from '../../supplierPricing'

export const PRICING_KEYS = [
  'standard_brick',
  'mortar',
  'labour',
  'timber_fence',
  'pvc_fence',
] as const

export type PricingKey = (typeof PRICING_KEYS)[number]

const PRICING_KEYS_BY_CATEGORY: Record<string, PricingKey[]> = {
  brick: ['standard_brick'],
  mortar: ['mortar'],
  labour: ['labour'],
  infill: ['timber_fence', 'pvc_fence'],
}

function getAllowedPricingKeys(category: string | null | undefined): PricingKey[] {
  return category ? PRICING_KEYS_BY_CATEGORY[category] ?? [...PRICING_KEYS] : [...PRICING_KEYS]
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
        const unit = doc.unit
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

        const priceSource = data.priceSource ?? originalDoc?.priceSource
        const category = data.category ?? originalDoc?.category
        const pricingKey = data.key ?? originalDoc?.key
        const unit = data.unit ?? originalDoc?.unit
        const selectedSupplierID = getRelationshipID(
          data.selectedSupplierPriceSource ??
            originalDoc?.selectedSupplierPriceSource,
        )
        const allowedPricingKeys = getAllowedPricingKeys(category)

        if (pricingKey && !allowedPricingKeys.includes(pricingKey)) {
          throw new Error('Selected key does not match the selected category.')
        }

        data.manualUnitPriceDisplay = formatPriceWithUnit(
          data.manualUnitPrice ?? originalDoc?.manualUnitPrice,
          unit,
        )
        data.autoAverageUnitPriceDisplay = formatPriceWithUnit(
          data.autoAverageUnitPrice ?? originalDoc?.autoAverageUnitPrice,
          unit,
        )
        data.effectiveUnitPriceDisplay = formatPriceWithUnit(
          data.effectiveUnitPrice ?? originalDoc?.effectiveUnitPrice,
          unit,
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
            data.selectedSupplierUnitPrice = Number(
              normalizeSupplierUnitPrice({
                pricingKey,
                unit: source.unit,
                unitPrice: source.lastPrice,
              }).toFixed(2),
            )
            data.selectedSupplierUnitPriceDisplay = formatPriceWithUnit(
              source.lastPrice,
              source.unit,
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
          allowedPricingKeys.has(option.value as PricingKey),
        )
      },
      required: true,
      unique: true,
    },
    {
      name: 'priceSource',
      type: 'select',
      defaultValue: 'manual',
      options: [
        { label: 'Manual price', value: 'manual' },
        { label: 'Supplier average price', value: 'average' },
        { label: 'Specific supplier price', value: 'supplier' },
      ],
      required: true,
      admin: {
        description:
          'Choose whether the calculator uses the company manual price or the supplier average price.',
      },
    },
    {
      name: 'selectedSupplierPriceSource',
      type: 'relationship',
      relationTo: 'supplier-price-sources',
      filterOptions: ({ siblingData }) => {
        const pricingKey =
          typeof siblingData?.key === 'string' ? siblingData.key : undefined

        if (!pricingKey) {
          return {
            id: {
              equals: -1,
            },
          }
        }

        return {
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
      required: true,
      admin: {
        condition: (_, siblingData) => siblingData.priceSource !== 'supplier',
        description:
          'Set manually for manual and average prices. Specific supplier prices use the selected supplier source unit automatically.',
      },
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
