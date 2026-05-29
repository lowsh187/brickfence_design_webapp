import type { ReactNode } from 'react'

type Props = {
  children: ReactNode
  description?: string
  title: string
}

export function AdminAuthShell({ children, description, title }: Props) {
  return (
    <main
      style={{
        alignItems: 'center',
        background: '#f7f7f8',
        display: 'flex',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: '2rem 1rem',
      }}
    >
      <section
        style={{
          background: '#fff',
          borderRadius: '1rem',
          boxShadow: '0 24px 60px rgba(15, 23, 42, 0.12)',
          maxWidth: '46rem',
          padding: '2.5rem',
          width: '100%',
        }}
      >
        <h1
          style={{
            color: '#0f172a',
            fontSize: '2.5rem',
            lineHeight: 1.1,
            margin: 0,
          }}
        >
          {title}
        </h1>
        {description ? (
          <p
            style={{
              color: '#475569',
              fontSize: '1rem',
              lineHeight: 1.6,
              margin: '1rem 0 0',
            }}
          >
            {description}
          </p>
        ) : null}
        <div style={{ marginTop: '2rem' }}>{children}</div>
      </section>
    </main>
  )
}
