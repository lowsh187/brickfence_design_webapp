import { redirect } from 'next/navigation'

import { AdminAuthShell } from '../../../../payload/admin/AdminAuthShell'
import { ResetSuperAdminPasswordForm } from '../../../../payload/admin/AdminAuthForms'

export default async function ResetSuperAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const params = await searchParams
  const token = typeof params.token === 'string' ? params.token : ''

  if (!token) {
    redirect('/admin/forgot/super-admin')
  }

  return (
    <AdminAuthShell
      description="Set a new password for the verified super_admin account."
      title="Reset super_admin password"
    >
      <ResetSuperAdminPasswordForm token={token} />
    </AdminAuthShell>
  )
}
