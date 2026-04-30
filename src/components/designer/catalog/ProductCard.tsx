'use client'

import { useRouter } from 'next/navigation'
import Image from 'next/image'

interface Props {
  productId: string
  name: string
  brandName: string | null
  imageUrl: string | null
}

export function ProductCard({ productId, name, brandName, imageUrl }: Props) {
  const router = useRouter()
  function handleClick() {
    const instanceId = crypto.randomUUID()
    router.push(`/designer/design/${productId}/${instanceId}`)
  }
  return (
    <button
      type="button"
      onClick={handleClick}
      className="group flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white text-left transition hover:border-pr-blue hover:shadow-md"
    >
      <div className="relative aspect-square w-full bg-gray-50">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={name}
            fill
            sizes="(min-width:1024px) 25vw, (min-width:640px) 33vw, 50vw"
            className="object-contain p-4 transition group-hover:scale-105"
            unoptimized
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-gray-300">No image</div>
        )}
      </div>
      <div className="p-3">
        <p className="truncate text-sm font-medium text-gray-900">{name}</p>
        {brandName && <p className="truncate text-xs text-gray-500">{brandName}</p>}
      </div>
    </button>
  )
}
