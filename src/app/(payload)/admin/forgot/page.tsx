import { AdminAuthShell } from '../../../../payload/admin/AdminAuthShell'
import { ForgotPasswordChooser } from '../../../../payload/admin/AdminAuthForms'

export default function ForgotPasswordPage() {
  return (
    <AdminAuthShell
      description="Choose whether you need to recover a super_admin password or create a brand-new admin account."
      title="Forgot Password"
    >
      <ForgotPasswordChooser />
    </AdminAuthShell>
  )
}
