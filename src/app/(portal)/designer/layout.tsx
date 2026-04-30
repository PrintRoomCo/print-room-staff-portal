import { redirect } from 'next/navigation'
import { requireDesignerStaffAccess } from '@/lib/designer/server'

export default async function DesignerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const access = await requireDesignerStaffAccess()
  if ('error' in access) {
    redirect('/sign-in?next=/designer/catalog')
  }
  return <>{children}</>
}
