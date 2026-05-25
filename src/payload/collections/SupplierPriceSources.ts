import type { CollectionConfig } from 'payload'

import { adminsOnly } from '../access'
import {
  deriveSupplierNameFromUrl,
  recomputeSupplierAverages,
} from '../../supplierPricing'
import {
  defaultUnitForPricingKey,
  formatPriceWithUnit,
  isLabourPricingKey,
} from '../../pricing'
import {
  pricingKeyOptions,
  pricingUnitOptions,
} from '../pricingOptions'

const SUPPLIER_UNITS_BY_PRICING_KEY: Record<string, string[]> = {
  standard_brick: ['each', 'per_quantity'],
  mortar: ['per_bag', 'm3'],
  timber_fence: ['m'],
  pvc_fence: ['m'],
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
        if (isLabourPricingKey(pricingKey)) {
          throw new Error('Labour costs are manual pricing items and cannot use supplier sources.')
        }

        const allowedUnits = getSupplierAllowedUnits(pricingKey)
        const requestedUnit = data?.unit ?? originalDoc?.unit
        let unitQuantity = data?.unitQuantity ?? originalDoc?.unitQuantity
        const customUnit = data?.customUnit ?? originalDoc?.customUnit
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
        const lastPrice = data?.lastPrice ?? originalDoc?.lastPrice
        const previousPrice =
          data?.previousPrice ?? originalDoc?.previousPrice

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

          if (typeof lastPrice !== 'number') {
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
          formatPriceWithUnit(
            data?.previousPrice ?? previousPrice,
            resolveUnitForDisplay(data?.unit ?? unit, data?.customUnit ?? customUnit),
            data?.unitQuantity ?? unitQuantity,
          ) || 'No data'

        data.lastPriceDisplay =
          formatPriceWithUnit(
            lastPrice,
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
        condition: (_, siblingData) =>
          !siblingData.productUrl || siblingData.lastStatus === 'failed',
        description:
          'Required for manual supplier sources. URL sources detect this automatically, but failed URL sources can be corrected manually.',
      },
      required: true,
    },
    {
      name: 'unitQuantity',
      type: 'number',
      defaultValue: 1000,
      admin: {
        condition: (_, siblingData) =>
          siblingData.pricingKey === 'standard_brick' &&
          siblingData.unit === 'per_quantity' &&
          (!siblingData.productUrl || siblingData.lastStatus === 'failed'),
        description: 'Number of bricks covered by this supplier price.',
      },
      min: 1,
    },
    {
      name: 'customUnit',
      type: 'text',
      admin: {
        condition: (_, siblingData) =>
          siblingData.unit === 'custom' &&
          (!siblingData.productUrl || siblingData.lastStatus === 'failed'),
        description: 'Enter the custom unit label used for display and pricing.',
      },
    },
    {
      name: 'bagWeightKg',
      type: 'number',
      defaultValue: 20,
      admin: {
        condition: (_, siblingData) =>
          siblingData.pricingKey === 'mortar' &&
          siblingData.unit === 'per_bag' &&
          (!siblingData.productUrl || siblingData.lastStatus === 'failed'),
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
          !siblingData.productUrl || siblingData.lastStatus === 'failed',
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
