import type { Metadata } from 'next'
import '../../index.css'

export const metadata: Metadata = {
  title: 'Fence Cost Calculator',
  description: 'Estimate the cost of your fence project',
}

export default function SiteLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
