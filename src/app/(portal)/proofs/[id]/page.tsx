import { ProofEditor } from '@/components/proofs/proof-editor'

export default async function ProofDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return <ProofEditor proofId={id} />
}
