import { Badge } from '@/components/ui/badge'

export function ShopifyLiveBadge({ shopifyId }: { shopifyId: string | null }) {
  if (!shopifyId) return null
  return <Badge variant="info">Shopify</Badge>
}
