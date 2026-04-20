import { redirect } from 'next/navigation'
import { requireOrdersStaffAccess } from '@/lib/orders/server'
import { OrderFormClient } from '@/components/orders/OrderFormClient'

export const dynamic = 'force-dynamic'

export default async function NewOrderPage() {
  const auth = await requireOrdersStaffAccess()
  if ('error' in auth) redirect('/dashboard')
  return <OrderFormClient />
}
