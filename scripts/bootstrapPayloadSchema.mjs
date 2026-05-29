export const script = async (config) => {
  if (process.env.PAYLOAD_DB_PUSH !== 'true') {
    console.log('Payload schema bootstrap skipped. Set PAYLOAD_DB_PUSH=true to initialize the database.')
    return
  }

  const originalNodeEnv = process.env.NODE_ENV
  process.env.NODE_ENV = 'development'

  let payload
  let bootstrapError

  try {
    const { getPayload } = await import('payload')

    payload = await getPayload({ config })
    console.log('Payload database schema bootstrap completed.')
  } catch (error) {
    bootstrapError = error
    console.error('Payload database schema bootstrap failed.')
    console.error(error)
  } finally {
    if (payload) {
      await payload.destroy()
    }

    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV
    } else {
      process.env.NODE_ENV = originalNodeEnv
    }
  }

  if (bootstrapError) {
    process.exit(1)
  }
}
