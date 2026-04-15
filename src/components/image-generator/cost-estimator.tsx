import { Card } from '@/components/ui/card'

interface CostEstimatorProps {
  totalImages: number
  includeBackgroundRemoval?: boolean
}

export function CostEstimator({ totalImages, includeBackgroundRemoval = true }: CostEstimatorProps) {
  if (totalImages === 0) return null

  const generationLow = totalImages * 0.02
  const generationHigh = totalImages * 0.04
  const bgCost = includeBackgroundRemoval ? totalImages * 0.003 : 0

  return (
    <Card className="bg-muted p-4 text-sm">
      <div className="flex justify-between">
        <span className="text-muted-foreground">Outputs planned:</span>
        <span className="font-medium">{totalImages}</span>
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-muted-foreground">Estimated processing:</span>
        <span className="font-medium">
          ${(generationLow + bgCost).toFixed(2)} - ${(generationHigh + bgCost).toFixed(2)} USD
        </span>
      </div>
      {includeBackgroundRemoval && (
        <p className="text-xs text-muted-foreground mt-2">
          Includes ~${bgCost.toFixed(3)} for background clean-up on white-background outputs
        </p>
      )}
    </Card>
  )
}
