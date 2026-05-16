"use client"

import { createContext, useContext, type ReactNode } from 'react'

type Navigate = (path: string) => void

const NavigationContext = createContext<Navigate | null>(null)

export function NavigationProvider({
  navigate,
  children,
}: {
  navigate: Navigate
  children: ReactNode
}) {
  return (
    <NavigationContext.Provider value={navigate}>
      {children}
    </NavigationContext.Provider>
  )
}

export function useAppNavigate(): Navigate {
  const injectedNavigate = useContext(NavigationContext)
  if (!injectedNavigate) {
    throw new Error('useAppNavigate must be used inside NavigationProvider')
  }

  return injectedNavigate
}
