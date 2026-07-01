'use client'

import { useEffect, type ReactNode } from 'react'

export function ThemeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    localStorage.removeItem('theme')
    document.documentElement.classList.remove('dark')
    document.documentElement.classList.add('light')
  }, [])

  return <>{children}</>
}
