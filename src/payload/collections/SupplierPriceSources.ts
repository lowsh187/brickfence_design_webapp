import type { CollectionConfig } from 'payload'

import { adminsOnly } from '../access'
import {
  deriveSupplierNameFromUrl,
  recomputeSupplierAverages,
} from '../../supplierPricing'
import {
  defaultUnitForPricingKey,
  formatPriceWithUnit,
} from '../../pricing'
import {
  pricingKeyOptions,
  pricingUnitOptions,
} from '../pricingOptions'

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
      'lastPriceDisplay',
      'lastStatus',
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
        const productUrl = data?.productUrl ?? originalDoc?.productUrl
        const pricingKey = data?.pricingKey ?? originalDoc?.pricingKey
        const unit = data?.unit ?? originalDoc?.unit ?? defaultUnitForPricingKey(pricingKey)
        const lastPrice = data?.lastPrice ?? originalDoc?.lastPrice

        if (productUrl) {
          data.supplierName = deriveSupplierNameFromUrl(productUrl)
          data.unit = unit
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

        data.lastPriceDisplay =
          formatPriceWithUnit(
            lastPrice,
            data?.unit ?? unit,
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
      required: true,
    },
    {
      name: 'unit',
      type: 'select',
      defaultValue: 'each',
      options: pricingUnitOptions,
      admin: {
        condition: (_, siblingData) => !siblingData.productUrl,
        description:
          'Required for manual supplier sources. Detected automatically when Product URL is provided.',
      },
      required: true,
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
        condition: (_, siblingData) => !siblingData.productUrl,
        description:
          'Required for manual supplier sources. URL sources use the update button to fetch this value.',
      },
      min: 0,
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
