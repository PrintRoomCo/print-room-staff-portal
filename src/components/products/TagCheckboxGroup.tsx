'use client'

import { PRODUCT_TYPE_TAGS, PRODUCT_TYPE_TAG_LABELS, type ProductTypeTag } from '@/lib/products/tags'

interface Props {
  value: ProductTypeTag[]
  onChange: (next: ProductTypeTag[]) => void
  legend?: string
}

export function TagCheckboxGroup({ value, onChange, legend = 'Type' }: Props) {
  const set = new Set(value)

  function toggle(tag: ProductTypeTag) {
    const next = new Set(set)
    if (next.has(tag)) next.delete(tag)
    else next.add(tag)
    onChange(PRODUCT_TYPE_TAGS.filter(t => next.has(t)))
  }

  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="text-xs font-medium text-gray-600">{legend}</legend>
      <div className="flex flex-wrap gap-3">
        {PRODUCT_TYPE_TAGS.map(tag => (
          <label key={tag} className="inline-flex items-center gap-2 text-sm text-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={set.has(tag)}
              onChange={() => toggle(tag)}
              className="h-4 w-4 rounded border-gray-300"
            />
            {PRODUCT_TYPE_TAG_LABELS[tag]}
          </label>
        ))}
      </div>
    </fieldset>
  )
}
