import type { CollectionConfig } from 'payload'

import { adminsOnly } from '../access'

export const Admins: CollectionConfig = {
  slug: 'admins',
  auth: true,
  admin: {
    useAsTitle: 'email',
  },
  access: {
    create: adminsOnly,
    delete: adminsOnly,
    read: adminsOnly,
    update: adminsOnly,
  },
  fields: [
    {
      name: 'name',
      type: 'text',
    },
  ],
}
