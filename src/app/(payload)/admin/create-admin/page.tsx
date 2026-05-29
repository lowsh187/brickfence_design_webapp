import { getPayload } from 'payload'
import config from '@payload-config'
import { redirect } from 'next/navigation'

import { PublicAdminRegistrationForm } from '../../../../payload/admin/AdminAuthForms'
import { AdminAuthShell } from '../../../../payload/admin/AdminAuthShell'
import { countAdmins } from '../../../../payload/adminSecurity'

export default async function CreateAdminPage() {
  const payload = await getPayload({ config })
  const adminCount = await countAdmins(payload)

  if (adminCount === 0) {
    redirect('/admin/create-first-user')
  }

  return (
    <AdminAuthShell
      description="This creates a new independent admin account. The old admin account remains unchanged."
      title="Create admin account"
    >
      <PublicAdminRegistrationForm />
    </AdminAuthShell>
  )
}
