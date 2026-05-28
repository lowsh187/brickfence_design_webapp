import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

const storage = new Map<string, string>()
const sessionStorageValues = new Map<string, string>()

Object.defineProperty(globalThis, 'localStorage', {
  value: {
    get length() {
      return storage.size
    },
    clear: () => storage.clear(),
    getItem: (key: string) => storage.get(key) ?? null,
    key: (index: number) => Array.from(storage.keys())[index] ?? null,
    removeItem: (key: string) => storage.delete(key),
    setItem: (key: string, value: string) => storage.set(key, String(value)),
  },
  configurable: true,
})

Object.defineProperty(globalThis, 'sessionStorage', {
  value: {
    get length() {
      return sessionStorageValues.size
    },
    clear: () => sessionStorageValues.clear(),
    getItem: (key: string) => sessionStorageValues.get(key) ?? null,
    key: (index: number) => Array.from(sessionStorageValues.keys())[index] ?? null,
    removeItem: (key: string) => sessionStorageValues.delete(key),
    setItem: (key: string, value: string) =>
      sessionStorageValues.set(key, String(value)),
  },
  configurable: true,
})

afterEach(() => {
  cleanup()
  localStorage.clear()
  sessionStorage.clear()
  document.cookie = 'CookieConsent=true'
})
