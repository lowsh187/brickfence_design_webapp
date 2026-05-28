import type { CollectionConfig } from 'payload'

import { adminsOnly } from '../access'
import {
  deriveSupplierNameFromUrl,
  recomputeSupplierAverages,
} from '../../supplierPricing'
import {
  defaultUnitForPricingKey,
  formatPvcPanelPriceSummary,
  formatPvcPriceDisplay,
  formatPriceWithUnit,
  isLabourPricingKey,
  normalizePvcPanelPrices,
} from '../../pricing'
import {
  pricingKeyOptions,
  pricingUnitOptions,
} from '../pricingOptions'

const SUPPLIER_UNITS_BY_PRICING_KEY: Record<string, string[]> = {
  standard_brick: ['each', 'per_quantity'],
  mortar: ['per_bag', 'm3'],
  timber_fence: ['m'],
  pvc_fence: ['each', 'm'],
}

function getSupplierAllowedUnits(pricingKey: string | null | undefined): string[] {
  if (!pricingKey) return pricingUnitOptions.map((option) => option.value)

  return [
    ...(SUPPLIER_UNITS_BY_PRICING_KEY[pricingKey] ?? [defaultUnitForPricingKey(pricingKey)]),
    'custom',
  ]
}

function optionValue(option: string | { value: string }): string {
  return typeof option === 'string' ? option : option.value
}

function resolveUnitForDisplay(
  unit: string | null | undefined,
  customUnit: string | null | undefined,
): string | null | undefined {
  return unit === 'custom' ? customUnit || unit : unit
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

export const SupplierPriceSources: CollectionConfig = {
  slug: 'supplier-price-sources',
  admin: {
    components: {
      beforeList: [
        {
          path: './src/payload/admin/SupplierPriceFetchButton',
          exportName: 'SupplierPriceFetchButton',
          clientProps: {
            mode: 'all',
          },
        },
      ],
    },
    defaultColumns: [
      'supplierName',
      'pricingKey',
      'productUrl',
      'unit',
      'previousPriceDisplay',
      'lastPriceDisplay',
      'lastStatus',
      'lastError',
      'isEnabled',
    ],
    group: 'Company Settings',
    useAsTitle: 'supplierName',
  },
  access: {
    create: adminsOnly,
    delete: adminsOnly,
    read: adminsOnly,
    update: adminsOnly,
  },
  hooks: {
    beforeValidate: [
      ({ data, originalDoc }) => {
        if (!data) return data

        const productUrl = data?.productUrl ?? originalDoc?.productUrl
        const pricingKey = data?.pricingKey ?? originalDoc?.pricingKey
        const pvcPricingMode =
          data?.pvcPricingMode ?? originalDoc?.pvcPricingMode ?? 'panel'
        if (isLabourPricingKey(pricingKey)) {
          throw new Error('Labour costs are manual pricing items and cannot use supplier sources.')
        }

        const allowedUnits = getSupplierAllowedUnits(pricingKey)
        const requestedUnit = data?.unit ?? originalDoc?.unit
        let unitQuantity = data?.unitQuantity ?? originalDoc?.unitQuantity
        const customUnit = data?.customUnit ?? originalDoc?.customUnit
        const unitConversionFactor =
          data?.unitConversionFactor ?? originalDoc?.unitConversionFactor
        const bagWeightKg = data?.bagWeightKg ?? originalDoc?.bagWeightKg
        let unit =
          requestedUnit && allowedUnits.includes(requestedUnit)
            ? requestedUnit
            : productUrl
              ? defaultUnitForPricingKey(pricingKey)
              : allowedUnits[0] ?? defaultUnitForPricingKey(pricingKey)
        if (pricingKey === 'mortar' && unit === 'per_bag' && typeof bagWeightKg !== 'number') {
          data.bagWeightKg = 20
        }
        if (pricingKey === 'standard_brick' && unit === 'per_1000') {
          unit = 'per_quantity'
          unitQuantity = 1000
          data.unit = unit
        }
        if (
          pricingKey === 'standard_brick' &&
          (unit === 'per_quantity' || unit === 'per_1000') &&
          (typeof unitQuantity !== 'number' || unitQuantity <= 1)
        ) {
          unitQuantity = 1000
          data.unitQuantity = unitQuantity
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
        const lastPrice = data?.lastPrice ?? originalDoc?.lastPrice
        const previousPrice =
          data?.previousPrice ?? originalDoc?.previousPrice

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
            const normalizedPanelPrices = normalizePvcPanelPrices(
              readPvcPanelPrices(data.pvcPanelPrices ?? originalDoc?.pvcPanelPrices),
              data.lastPrice ?? originalDoc?.lastPrice,
            )
            data.pvcPanelPriceDisplay = formatPvcPanelPriceSummary(normalizedPanelPrices.prices)
            data.pvcPanelPriceWarning = normalizedPanelPrices.warning

            const selectedPanelSize = data.pvcPanelSize ?? originalDoc?.pvcPanelSize ?? '6ft'
            data.pvcPanelSize = selectedPanelSize
            const selectedPanelPrice =
              normalizedPanelPrices.prices[
                selectedPanelSize as keyof typeof normalizedPanelPrices.prices
              ]
            if (typeof selectedPanelPrice === 'number' && selectedPanelPrice > 0) {
              data.lastPrice = selectedPanelPrice
            }
          }
        }

        if (productUrl) {
          data.supplierName = deriveSupplierNameFromUrl(productUrl)
          data.unit = unit
          if (
            originalDoc?.lastStatus === 'failed' &&
            typeof lastPrice === 'number' &&
            (typeof data.lastPrice === 'number' || data.unit || data.unitQuantity)
          ) {
            data.lastPrice = lastPrice
            data.lastFetchedAt = new Date().toISOString()
            data.lastStatus = 'success'
            data.lastError = null
          }
        } else {
          if (!data?.supplierName && !originalDoc?.supplierName) {
            throw new Error('Supplier name is required when Product URL is blank.')
          }

          if (!pricingKey) {
            throw new Error('Pricing key is required.')
          }

          if (!unit) {
            throw new Error('Unit is required when Product URL is blank.')
          }

          if (pricingKey !== 'pvc_fence' && typeof lastPrice !== 'number') {
            throw new Error('Manual price is required when Product URL is blank.')
          }

          data.unit = unit
          data.lastPrice = lastPrice
          data.lastStatus = 'success'
          data.lastError = null
        }

        if (
          originalDoc &&
          typeof originalDoc.lastPrice === 'number' &&
          typeof data?.lastPrice === 'number' &&
          data.lastPrice !== originalDoc.lastPrice &&
          !data.previousPrice
        ) {
          data.previousPrice = originalDoc.lastPrice
          data.previousPriceDisplay =
            formatPriceWithUnit(
              originalDoc.lastPrice,
              resolveUnitForDisplay(originalDoc.unit ?? unit, originalDoc.customUnit),
              originalDoc.unitQuantity,
            ) ||
            'No data'
          data.previousFetchedAt = originalDoc.lastFetchedAt ?? null
        }

        data.previousPriceDisplay =
          pricingKey === 'pvc_fence' && pvcPricingMode !== 'per_m'
            ? originalDoc?.pvcPanelPriceDisplay || data.pvcPanelPriceDisplay || 'No data'
            : formatPriceWithUnit(
              data?.previousPrice ?? previousPrice,
              resolveUnitForDisplay(data?.unit ?? unit, data?.customUnit ?? customUnit),
              data?.unitQuantity ?? unitQuantity,
            ) || 'No data'

        data.lastPriceDisplay =
          pricingKey === 'pvc_fence'
            ? formatPvcPriceDisplay({
              mode: pvcPricingMode,
              panelPrices: readPvcPanelPrices(data.pvcPanelPrices ?? originalDoc?.pvcPanelPrices),
              unitPrice: data?.lastPrice ?? lastPrice,
            })
            : formatPriceWithUnit(
              data?.lastPrice ?? lastPrice,
              resolveUnitForDisplay(data?.unit ?? unit, data?.customUnit ?? customUnit),
              data?.unitQuantity ?? unitQuantity,
            ) || 'No data'

        return data
      },
    ],
    afterChange: [
      async ({ req }) => {
        await recomputeSupplierAverages(req.payload)
      },
    ],
  },
  fields: [
    {
      name: 'productUrl',
      type: 'text',
      admin: {
        components: {
          Description: {
            path: './src/payload/admin/SupplierPriceFetchButton',
            exportName: 'SupplierPriceFetchButton',
            clientProps: {
              mode: 'current',
            },
          },
        },
        description:
          'Optional. If provided, supplier name and unit are detected automatically and the update button fetches the price.',
      },
    },
    {
      name: 'supplierName',
      type: 'text',
      admin: {
        condition: (_, siblingData) => !siblingData.productUrl,
        description:
          'Required for manual supplier sources. Automatically detected when Product URL is provided.',
      },
      required: true,
    },
    {
      name: 'pricingKey',
      type: 'select',
      options: pricingKeyOptions,
      filterOptions: ({ options }) =>
        options.filter((option) => !isLabourPricingKey(optionValue(option))),
      required: true,
    },
    {
      name: 'unit',
      type: 'select',
      defaultValue: 'each',
      options: pricingUnitOptions,
      filterOptions: ({ options, siblingData }) => {
        const pricingKey =
          typeof siblingData?.pricingKey === 'string'
            ? siblingData.pricingKey
            : undefined
        const allowedUnits = new Set(getSupplierAllowedUnits(pricingKey))

        return options.filter((option) => allowedUnits.has(optionValue(option)))
      },
      admin: {
        condition: () => true,
        description:
          'Required for manual supplier sources. URL sources detect this automatically, but existing sources can be corrected manually.',
      },
      required: true,
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
        condition: (_, siblingData) => siblingData.pricingKey === 'pvc_fence',
        description:
          'URL sources detect this automatically, but existing sources can be corrected manually.',
      },
    },
    {
      name: 'unitQuantity',
      type: 'number',
      defaultValue: 1000,
      admin: {
        condition: (_, siblingData) =>
          siblingData.pricingKey === 'standard_brick' &&
          siblingData.unit === 'per_quantity',
        description: 'Number of bricks covered by this supplier price.',
      },
      min: 1,
    },
    {
      name: 'pvcPanelSize',
      type: 'select',
      options: [
        { label: '4ft', value: '4ft' },
        { label: '5ft', value: '5ft' },
        { label: '6ft', value: '6ft' },
        { label: '8ft', value: '8ft' },
        { label: '10ft', value: '10ft' },
      ],
      admin: {
        hidden: true,
      },
    },
    {
      name: 'pvcPanelPrices',
      type: 'group',
      admin: {
        condition: (_, siblingData) =>
          siblingData.pricingKey === 'pvc_fence' &&
          siblingData.pvcPricingMode !== 'per_m',
        description:
          'Enter PVC panel prices. Missing sizes use the next larger size price where available.',
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
          siblingData.pricingKey === 'pvc_fence' &&
          siblingData.pvcPricingMode !== 'per_m',
        description: 'Effective PVC panel prices after filling missing sizes.',
        readOnly: true,
      },
    },
    {
      name: 'pvcPanelPriceWarning',
      type: 'textarea',
      admin: {
        condition: (_, siblingData) =>
          siblingData.pricingKey === 'pvc_fence' &&
          siblingData.pvcPricingMode !== 'per_m',
        description: 'Shown when one or more PVC panel sizes are using fallback prices.',
        readOnly: true,
      },
    },
    {
      name: 'customUnit',
      type: 'text',
      admin: {
        condition: (_, siblingData) =>
          siblingData.unit === 'custom',
        description: 'Enter the custom unit label used for display and pricing.',
      },
    },
    {
      name: 'unitConversionFactor',
      type: 'number',
      admin: {
        condition: (_, siblingData) =>
          siblingData.unit === 'custom',
        description:
          'How many calculator base units one custom unit covers. AI fills this for URL sources when possible.',
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
          siblingData.pricingKey === 'mortar' &&
          siblingData.unit === 'per_bag',
        description: 'Bag weight in kilograms. Used when this source is priced per bag.',
      },
      min: 0,
    },
    {
      name: 'region',
      type: 'text',
      defaultValue: 'Australia',
    },
    {
      name: 'includesGST',
      type: 'checkbox',
      defaultValue: true,
    },
    {
      name: 'isEnabled',
      type: 'checkbox',
      defaultValue: true,
      required: true,
    },
    {
      name: 'lastPrice',
      type: 'number',
      admin: {
        condition: (_, siblingData) =>
          siblingData.pricingKey !== 'pvc_fence' ||
          siblingData.pvcPricingMode === 'per_m',
        description:
          'Required for manual supplier sources. Failed URL sources can use this as a manual fallback price.',
      },
      min: 0,
    },
    {
      name: 'previousPrice',
      type: 'number',
      admin: {
        description: 'Supplier price before the latest successful update.',
        readOnly: true,
      },
      min: 0,
    },
    {
      name: 'previousPriceDisplay',
      type: 'text',
      defaultValue: 'No data',
      admin: {
        description: 'Previous supplier price with unit.',
        readOnly: true,
      },
    },
    {
      name: 'previousFetchedAt',
      type: 'date',
      admin: {
        date: {
          pickerAppearance: 'dayAndTime',
        },
        readOnly: true,
      },
    },
    {
      name: 'lastPriceDisplay',
      type: 'text',
      defaultValue: 'No data',
      admin: {
        description: 'Last fetched supplier price with unit.',
        readOnly: true,
      },
    },
    {
      name: 'lastFetchedAt',
      type: 'date',
      admin: {
        date: {
          pickerAppearance: 'dayAndTime',
        },
        readOnly: true,
      },
    },
    {
      name: 'lastStatus',
      type: 'select',
      defaultValue: 'pending',
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Success', value: 'success' },
        { label: 'Failed', value: 'failed' },
      ],
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'lastError',
      type: 'textarea',
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'notes',
      type: 'textarea',
    },
  ],
}
