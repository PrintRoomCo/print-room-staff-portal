import { QuoteForm } from '@/components/quote-builder/QuoteForm'

export default async function EditQuotePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <QuoteForm mode="edit" quoteId={id} />
}
