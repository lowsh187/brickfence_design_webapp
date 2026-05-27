export async function readJsonResponse<T>(
  response: Response,
  fallback: T,
): Promise<T> {
  const text = await response.text()
  if (!text.trim()) return fallback

  try {
    return JSON.parse(text) as T
  } catch {
    throw new Error('Server returned an invalid JSON response.')
  }
}
