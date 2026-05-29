import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'

import { countAdmins } from '../../../../payload/adminSecurity'
import { CreateFirstSuperAdminForm } from '../../../../payload/admin/AdminAuthForms'
import { AdminAuthShell } from '../../../../payload/admin/AdminAuthShell'

export default async function CreateFirstUserPage() {
  const payload = await getPayload({ config })
  const adminCount = await countAdmins(payload)

  if (adminCount > 0) {
    redirect('/admin/login')
  }

  return (
    <AdminAuthShell
      description="To begin, create your first user. The first account is always created as a super_admin."
      title="Welcome"
    >
      <CreateFirstSuperAdminForm />
    </AdminAuthShell>
  )
}
