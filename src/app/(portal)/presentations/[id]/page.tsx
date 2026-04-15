import { PresentationEditor } from '@/components/presentations/presentation-editor'

export default async function PresentationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return <PresentationEditor presentationId={id} />
}
