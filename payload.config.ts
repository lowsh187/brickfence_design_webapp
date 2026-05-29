import { postgresAdapter } from '@payloadcms/db-postgres'
import { buildConfig } from 'payload'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { Admins } from './src/payload/collections/Admins'
import { PricingItems } from './src/payload/collections/PricingItems'
import { SupplierPriceSources } from './src/payload/collections/SupplierPriceSources'
import { seedDefaultPricingItems } from './src/payload/seedDefaultPricing'

function loadLocalEnv() {
  const envPath = resolve(process.cwd(), '.env.local')
  if (!existsSync(envPath)) return

  const lines = readFileSync(envPath, 'utf8').split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const separatorIndex = trimmed.indexOf('=')
    if (separatorIndex === -1) continue

    const key = trimmed.slice(0, separatorIndex)
    const value = trimmed.slice(separatorIndex + 1)
    process.env[key] ??= value
  }
}

loadLocalEnv()

const databaseUrl = process.env.DATABASE_URL
const payloadSecret = process.env.PAYLOAD_SECRET
const shouldPushDatabaseSchema =
  process.env.PAYLOAD_DB_PUSH === 'true' || process.env.NODE_ENV !== 'production'

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required. Add it to .env.local before opening Payload Admin.')
}

if (!payloadSecret) {
  throw new Error('PAYLOAD_SECRET is required. Add it to .env.local before opening Payload Admin.')
}

export default buildConfig({
  admin: {
    user: Admins.slug,
  },
  collections: [
    Admins,
    PricingItems,
    SupplierPriceSources,
  ],
  db: postgresAdapter({
    pool: {
      connectionString: databaseUrl,
    },
    push: shouldPushDatabaseSchema,
  }),
  onInit: async (payload) => {
    try {
      await seedDefaultPricingItems(payload)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      payload.logger.warn(`Default pricing seed skipped: ${message}`)
    }
  },
  secret: payloadSecret,
})
