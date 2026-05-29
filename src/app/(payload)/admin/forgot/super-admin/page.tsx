import { AdminAuthShell } from '../../../../../payload/admin/AdminAuthShell'
import { SuperAdminRecoveryForm } from '../../../../../payload/admin/AdminAuthForms'

export default function SuperAdminRecoveryPage() {
  return (
    <AdminAuthShell
      description="Enter the super_admin email and answer both security questions correctly before resetting the password."
      title="Recover super_admin"
    >
      <SuperAdminRecoveryForm />
    </AdminAuthShell>
  )
}
