import type { CollectionConfig } from 'payload'

import { adminsOnly } from '../access'
import {
  pricingKeyOptions,
  pricingUnitOptions,
} from '../pricingOptions'

export const SupplierPriceSnapshots: CollectionConfig = {
  slug: 'supplier-price-snapshots',
  admin: {
    defaultColumns: [
      'supplierName',
      'pricingKey',
      'unitPrice',
      'status',
      'fetchedAt',
    ],
    group: 'Company Settings',
    useAsTitle: 'rawTitle',
  },
  access: {
    create: adminsOnly,
    delete: adminsOnly,
    read: adminsOnly,
    update: adminsOnly,
  },
  fields: [
    {
      name: 'source',
      type: 'relationship',
      relationTo: 'supplier-price-sources',
    },
    {
      name: 'supplierName',
      type: 'text',
      required: true,
    },
    {
      name: 'pricingKey',
      type: 'select',
      options: pricingKeyOptions,
      required: true,
    },
    {
      name: 'unitPrice',
      type: 'number',
      min: 0,
    },
    {
      name: 'currency',
      type: 'text',
      defaultValue: 'AUD',
      required: true,
    },
    {
      name: 'unit',
      type: 'select',
      options: pricingUnitOptions,
      required: true,
    },
    {
      name: 'fetchedAt',
      type: 'date',
      defaultValue: () => new Date().toISOString(),
      required: true,
    },
    {
      name: 'rawTitle',
      type: 'text',
    },
    {
      name: 'rawUrl',
      type: 'text',
      required: true,
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'success',
      options: [
        { label: 'Success', value: 'success' },
        { label: 'Failed', value: 'failed' },
      ],
      required: true,
    },
    {
      name: 'errorMessage',
      type: 'textarea',
    },
  ],
}
