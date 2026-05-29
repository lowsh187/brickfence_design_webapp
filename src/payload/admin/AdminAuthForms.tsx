'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, type CSSProperties, type FormEvent, type ReactNode } from 'react'

import {
  SUPER_ADMIN_ANIMAL_QUESTION,
  SUPER_ADMIN_FOOD_QUESTION,
} from '../adminSecurityQuestions'

const fieldStyle = {
  border: '1px solid #cbd5e1',
  borderRadius: '0.75rem',
  fontSize: '1rem',
  padding: '0.95rem 1rem',
  width: '100%',
} satisfies CSSProperties

const labelStyle = {
  color: '#0f172a',
  display: 'block',
  fontSize: '1rem',
  fontWeight: 600,
  marginBottom: '0.5rem',
} satisfies CSSProperties

const helperStyle = {
  color: '#64748b',
  fontSize: '0.95rem',
  lineHeight: 1.5,
  marginTop: '0.5rem',
} satisfies CSSProperties

const buttonStyle = {
  background: '#222222',
  border: 0,
  borderRadius: '0.75rem',
  color: '#fff',
  cursor: 'pointer',
  fontSize: '1rem',
  fontWeight: 600,
  padding: '0.95rem 1rem',
  width: '100%',
} satisfies CSSProperties

const secondaryButtonStyle = {
  ...buttonStyle,
  background: '#ffffff',
  border: '1px solid #cbd5e1',
  color: '#0f172a',
} satisfies CSSProperties

type SubmitState = {
  error: string | null
  isSubmitting: boolean
}

function useSubmitState(): [SubmitState, (value: SubmitState) => void] {
  return useState<SubmitState>({
    error: null,
    isSubmitting: false,
  })
}

async function readJsonMessage(response: Response, fallback: string): Promise<string> {
  const body = await response.json().catch(() => null)

  return typeof body?.message === 'string' ? body.message : fallback
}

export function CreateFirstSuperAdminForm() {
  const router = useRouter()
  const [state, setState] = useSubmitState()

  async function onSubmit(formData: FormData) {
    setState({ error: null, isSubmitting: true })
    const response = await fetch('/api/admin-auth/first-user', {
      body: JSON.stringify({
        confirmPassword: formData.get('confirmPassword'),
        email: formData.get('email'),
        name: formData.get('name'),
        password: formData.get('password'),
        securityQuestionAnimalAnswer: formData.get('securityQuestionAnimalAnswer'),
        securityQuestionFoodAnswer: formData.get('securityQuestionFoodAnswer'),
      }),
      headers: {
        'Content-Type': 'application/json',
      },
      method: 'POST',
    })

    if (!response.ok) {
      setState({
        error: await readJsonMessage(response, 'Unable to create the super admin account.'),
        isSubmitting: false,
      })

      return
    }

    router.push('/admin/login')
    router.refresh()
  }

  return (
    <AuthForm
      error={state.error}
      isSubmitting={state.isSubmitting}
      onSubmit={onSubmit}
      submitLabel="Create"
    >
      <LabeledField label="Email *" name="email" type="email" />
      <LabeledField label="New Password *" name="password" type="password" />
      <LabeledField label="Confirm Password *" name="confirmPassword" type="password" />
      <LabeledField label="Name" name="name" type="text" />
      <div>
        <label style={labelStyle}>Role *</label>
        <input
          disabled
          readOnly
          style={{ ...fieldStyle, background: '#f8fafc', color: '#334155' }}
          type="text"
          value="super_admin"
        />
      </div>
      <LabeledField
        helper={SUPER_ADMIN_ANIMAL_QUESTION}
        label="Security Question 1 *"
        name="securityQuestionAnimalAnswer"
        type="text"
      />
      <LabeledField
        helper={SUPER_ADMIN_FOOD_QUESTION}
        label="Security Question 2 *"
        name="securityQuestionFoodAnswer"
        type="text"
      />
    </AuthForm>
  )
}

export function ForgotPasswordChooser() {
  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <Link href="/admin/forgot/super-admin" style={{ textDecoration: 'none' }}>
        <div style={{ ...secondaryButtonStyle, textAlign: 'center' }}>Recover super_admin password</div>
      </Link>
      <Link href="/admin/create-admin" style={{ textDecoration: 'none' }}>
        <div style={{ ...buttonStyle, textAlign: 'center' }}>Create a new admin account</div>
      </Link>
      <p style={{ ...helperStyle, marginTop: 0 }}>
        The admin option creates a brand-new admin account and does not change the old one.
      </p>
    </div>
  )
}

export function SuperAdminRecoveryForm() {
  const router = useRouter()
  const [state, setState] = useSubmitState()

  async function onSubmit(formData: FormData) {
    setState({ error: null, isSubmitting: true })
    const response = await fetch('/api/admin-auth/verify-super-admin-recovery', {
      body: JSON.stringify({
        email: formData.get('email'),
        securityQuestionAnimalAnswer: formData.get('securityQuestionAnimalAnswer'),
        securityQuestionFoodAnswer: formData.get('securityQuestionFoodAnswer'),
      }),
      headers: {
        'Content-Type': 'application/json',
      },
      method: 'POST',
    })

    if (!response.ok) {
      setState({
        error: await readJsonMessage(response, 'Unable to verify the super admin identity.'),
        isSubmitting: false,
      })

      return
    }

    const body = await response.json()
    const token =
      typeof body?.token === 'string' ? encodeURIComponent(body.token) : ''

    router.push(`/admin/reset-super-admin?token=${token}`)
  }

  return (
    <AuthForm
      error={state.error}
      isSubmitting={state.isSubmitting}
      onSubmit={onSubmit}
      submitLabel="Verify answers"
    >
      <LabeledField label="Email *" name="email" type="email" />
      <LabeledField
        helper={SUPER_ADMIN_ANIMAL_QUESTION}
        label="Security Question 1 *"
        name="securityQuestionAnimalAnswer"
        type="text"
      />
      <LabeledField
        helper={SUPER_ADMIN_FOOD_QUESTION}
        label="Security Question 2 *"
        name="securityQuestionFoodAnswer"
        type="text"
      />
    </AuthForm>
  )
}

export function ResetSuperAdminPasswordForm({ token }: { token: string }) {
  const router = useRouter()
  const [state, setState] = useSubmitState()

  async function onSubmit(formData: FormData) {
    setState({ error: null, isSubmitting: true })
    const response = await fetch('/api/admin-auth/reset-super-admin', {
      body: JSON.stringify({
        confirmPassword: formData.get('confirmPassword'),
        password: formData.get('password'),
        token,
      }),
      headers: {
        'Content-Type': 'application/json',
      },
      method: 'POST',
    })

    if (!response.ok) {
      setState({
        error: await readJsonMessage(response, 'Unable to reset the password.'),
        isSubmitting: false,
      })

      return
    }

    router.push('/admin/login')
    router.refresh()
  }

  return (
    <AuthForm
      error={state.error}
      isSubmitting={state.isSubmitting}
      onSubmit={onSubmit}
      submitLabel="Reset password"
    >
      <LabeledField label="New Password *" name="password" type="password" />
      <LabeledField label="Confirm Password *" name="confirmPassword" type="password" />
    </AuthForm>
  )
}

export function PublicAdminRegistrationForm() {
  const router = useRouter()
  const [state, setState] = useSubmitState()

  async function onSubmit(formData: FormData) {
    setState({ error: null, isSubmitting: true })
    const response = await fetch('/api/admin-auth/register-admin', {
      body: JSON.stringify({
        confirmPassword: formData.get('confirmPassword'),
        email: formData.get('email'),
        name: formData.get('name'),
        password: formData.get('password'),
      }),
      headers: {
        'Content-Type': 'application/json',
      },
      method: 'POST',
    })

    if (!response.ok) {
      setState({
        error: await readJsonMessage(response, 'Unable to create the admin account.'),
        isSubmitting: false,
      })

      return
    }

    router.push('/admin/login')
    router.refresh()
  }

  return (
    <AuthForm
      error={state.error}
      isSubmitting={state.isSubmitting}
      onSubmit={onSubmit}
      submitLabel="Create admin account"
    >
      <LabeledField label="Email *" name="email" type="email" />
      <LabeledField label="New Password *" name="password" type="password" />
      <LabeledField label="Confirm Password *" name="confirmPassword" type="password" />
      <LabeledField label="Name" name="name" type="text" />
    </AuthForm>
  )
}

function AuthForm({
  children,
  error,
  isSubmitting,
  onSubmit,
  submitLabel,
}: {
  children: ReactNode
  error: string | null
  isSubmitting: boolean
  onSubmit: (formData: FormData) => Promise<void>
  submitLabel: string
}) {
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)

    await onSubmit(formData)
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '1.25rem' }}>
      {children}
      {error ? (
        <p style={{ color: '#b42318', margin: 0 }}>{error}</p>
      ) : null}
      <button disabled={isSubmitting} style={buttonStyle} type="submit">
        {isSubmitting ? 'Please wait...' : submitLabel}
      </button>
    </form>
  )
}

function LabeledField({
  helper,
  label,
  name,
  type,
}: {
  helper?: string
  label: string
  name: string
  type: string
}) {
  return (
    <div>
      <label htmlFor={name} style={labelStyle}>
        {label}
      </label>
      <input id={name} name={name} required={label.includes('*')} style={fieldStyle} type={type} />
      {helper ? <p style={helperStyle}>{helper}</p> : null}
    </div>
  )
}
