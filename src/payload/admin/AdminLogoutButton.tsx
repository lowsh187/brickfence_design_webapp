'use client'

import React, { useState } from 'react'

function getAdminBasePath(): string {
  return '/admin'
}

function getLogoutEndpoint(): string {
  return '/api/admins/logout'
}

export function AdminLogoutButton() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleLogout() {
    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch(getLogoutEndpoint(), {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error('Logout failed')
      }

      window.location.assign(`${getAdminBasePath()}/login`)
    } catch {
      setError('Logout failed. Please try again.')
      setIsSubmitting(false)
    }
  }

  return (
    <div
      style={{
        borderTop: '1px solid rgba(0, 0, 0, 0.12)',
        marginTop: '0.75rem',
        paddingTop: '0.75rem',
      }}
    >
      <button
        onClick={handleLogout}
        type="button"
        disabled={isSubmitting}
        style={{
          background: isSubmitting ? '#8a8a8a' : '#1f1f1f',
          border: 0,
          borderRadius: '0.5rem',
          color: '#fff',
          cursor: isSubmitting ? 'not-allowed' : 'pointer',
          fontSize: '0.95rem',
          fontWeight: 600,
          padding: '0.7rem 1rem',
          width: '100%',
        }}
      >
        {isSubmitting ? 'Logging out...' : 'Logout'}
      </button>
      {error ? (
        <p
          style={{
            color: '#b42318',
            fontSize: '0.85rem',
            margin: '0.5rem 0 0',
          }}
        >
          {error}
        </p>
      ) : null}
    </div>
  )
}
