'use client'

import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type {
  CommercialTermsPayload,
  PresentationDetail,
  PresentationSection,
  ProductPackagingPayload,
  ProductPricingPayload,
  ProductStoryPayload,
  SupportingIdeaPayload,
} from '@/types/presentations'

interface PresentationPreviewProps {
  presentation: PresentationDetail
}

export function PresentationPreview({ presentation }: PresentationPreviewProps) {
  const enabledSections = presentation.sections.filter(section => section.isEnabled)

  return (
    <div className="space-y-6">
      {enabledSections.map((section, index) => (
        <PreviewSlide
          key={section.id}
          index={index}
          section={section}
          clientBrand={presentation.clientBrand}
          proposalTitle={presentation.proposalTitle}
          seasonLabel={presentation.seasonLabel}
          coverDateLabel={presentation.coverDateLabel}
        />
      ))}
    </div>
  )
}

function PreviewSlide({
  index,
  section,
  clientBrand,
  proposalTitle,
  seasonLabel,
  coverDateLabel,
}: {
  index: number
  section: PresentationSection
  clientBrand: string
  proposalTitle: string
  seasonLabel: string
  coverDateLabel: string
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <Badge variant="blue">Slide {index + 1}</Badge>
          <Badge variant="gray">{section.kind}</Badge>
        </div>
        <span className="text-xs text-muted-foreground">{section.title || 'Untitled section'}</span>
      </div>

      <Card className="overflow-hidden rounded-[28px] border-gray-200">
        <div className="aspect-video bg-[#f8f8f3] p-6 md:p-8">
          {section.kind === 'cover' && (
            <CoverSlide
              clientBrand={clientBrand}
              proposalTitle={proposalTitle}
              seasonLabel={seasonLabel}
              coverDateLabel={coverDateLabel}
              section={section}
            />
          )}
          {section.kind === 'brand-intro' && <TextSlide section={section} tone="brand" />}
          {section.kind === 'brand-context' && <TextSlide section={section} tone="context" />}
          {section.kind === 'product-story' && <ProductStorySlide section={section} />}
          {section.kind === 'product-pricing' && <ProductPricingSlide section={section} />}
          {section.kind === 'product-packaging' && <ProductPackagingSlide section={section} />}
          {section.kind === 'supporting-idea' && <SupportingIdeaSlide section={section} />}
          {section.kind === 'commercial-terms' && <CommercialTermsSlide section={section} />}
        </div>
      </Card>
    </div>
  )
}

function CoverSlide({
  clientBrand,
  proposalTitle,
  seasonLabel,
  coverDateLabel,
  section,
}: {
  clientBrand: string
  proposalTitle: string
  seasonLabel: string
  coverDateLabel: string
  section: PresentationSection
}) {
  return (
    <div className="flex h-full flex-col justify-between rounded-[24px] bg-[linear-gradient(135deg,#13334c_0%,#1c4f73_60%,#f4e2a3_100%)] p-6 text-white md:p-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-white/75">Print Room x {clientBrand}</p>
          <h2 className="mt-4 max-w-xl text-3xl font-semibold leading-tight md:text-5xl">
            {proposalTitle || section.title || 'Proposed product range'}
          </h2>
        </div>
        <Badge variant="yellow" className="self-start">
          {seasonLabel || 'Season'}
        </Badge>
      </div>

      <div className="max-w-2xl space-y-4">
        {section.body && (
          <p className="text-sm leading-6 text-white/90 md:text-base">
            {section.body}
          </p>
        )}
        <p className="text-sm font-medium text-white/80">{coverDateLabel}</p>
      </div>
    </div>
  )
}

function TextSlide({
  section,
  tone,
}: {
  section: PresentationSection
  tone: 'brand' | 'context'
}) {
  const palette =
    tone === 'brand'
      ? 'bg-[#132c3b] text-white'
      : 'bg-[#f5f2e9] text-[#16232f]'

  return (
    <div className={`flex h-full rounded-[24px] p-6 md:p-10 ${palette}`}>
      <div className="my-auto max-w-3xl space-y-5">
        <p className="text-xs uppercase tracking-[0.18em] opacity-70">
          {tone === 'brand' ? 'Why Print Room' : 'Client context'}
        </p>
        <h2 className="text-3xl font-semibold leading-tight md:text-5xl">
          {section.title}
        </h2>
        <p className="whitespace-pre-wrap text-sm leading-7 opacity-90 md:text-lg">
          {section.body}
        </p>
      </div>
    </div>
  )
}

function ProductStorySlide({ section }: { section: PresentationSection }) {
  const payload = section.payload as ProductStoryPayload

  return (
    <div className="grid h-full gap-5 md:grid-cols-[1.25fr_0.9fr]">
      <div className="rounded-[24px] bg-[#10354d] p-6 text-white md:p-8">
        <p className="text-xs uppercase tracking-[0.18em] text-white/70">{payload.productName || section.title}</p>
        <h2 className="mt-4 text-3xl font-semibold leading-tight md:text-5xl">
          {payload.tagline || section.title}
        </h2>
        <p className="mt-6 whitespace-pre-wrap text-sm leading-7 text-white/88 md:text-base">
          {payload.storyCopy || section.body}
        </p>
      </div>
      <div className="flex flex-col justify-between rounded-[24px] border border-dashed border-[#b7c6cf] bg-white p-6 md:p-8">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-[#5b6c78]">Mockup direction</p>
          <h3 className="mt-4 text-2xl font-semibold text-[#16232f]">
            {payload.mockupCaption || 'Lifestyle mockup'}
          </h3>
        </div>
        <p className="text-sm leading-6 text-[#4a5d6a]">
          {payload.mockupNote || 'Use this space for mockups, styled visuals, or concept renders.'}
        </p>
      </div>
    </div>
  )
}

function ProductPricingSlide({ section }: { section: PresentationSection }) {
  const payload = section.payload as ProductPricingPayload

  return (
    <div className="grid h-full gap-5 md:grid-cols-[0.88fr_1.12fr]">
      <div className="rounded-[24px] bg-white p-6 md:p-8">
        <p className="text-xs uppercase tracking-[0.18em] text-[#657784]">{payload.productName || section.title}</p>
        <h2 className="mt-4 text-3xl font-semibold text-[#16232f]">{section.title}</h2>
        {payload.customisationOptions.length > 0 && (
          <div className="mt-6">
            <p className="text-sm font-medium text-[#16232f]">Customisation options</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {payload.customisationOptions.map(option => (
                <Badge key={option} variant="gray" className="px-3 py-1">
                  {option}
                </Badge>
              ))}
            </div>
          </div>
        )}
        {payload.leadTime && (
          <p className="mt-6 text-sm leading-6 text-[#52606d]">{payload.leadTime}</p>
        )}
        {payload.recommendationBody && (
          <div className="mt-6 rounded-[22px] bg-[#f0f6fb] p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-[#4b697d]">{payload.recommendationTitle}</p>
            <p className="mt-2 text-sm leading-6 text-[#1f3544]">{payload.recommendationBody}</p>
          </div>
        )}
      </div>

      <div className="rounded-[24px] bg-[#f7f4ea] p-6 md:p-8">
        <div className="overflow-hidden rounded-[20px] border border-[#dfd6bf] bg-white">
          <div className="grid grid-cols-[1.3fr_repeat(3,minmax(0,1fr))] bg-[#f4ecd7] px-4 py-3 text-xs font-semibold uppercase tracking-[0.15em] text-[#5d5a4d]">
            <div>{payload.pricingTitle || 'Indicative pricing'}</div>
            {payload.pricingColumns.slice(0, 3).map(column => (
              <div key={column} className="text-right">{column}</div>
            ))}
          </div>
          <div className="divide-y divide-[#ebe4d4]">
            {payload.pricingRows.slice(0, 4).map((row, rowIndex) => (
              <div key={`${row.label}-${rowIndex}`} className="grid grid-cols-[1.3fr_repeat(3,minmax(0,1fr))] gap-3 px-4 py-4 text-sm text-[#22323d]">
                <div>
                  <p className="font-medium">{row.label}</p>
                  {row.details.length > 0 && (
                    <div className="mt-2 space-y-1 text-xs leading-5 text-[#5b6770]">
                      {row.details.map(detail => (
                        <p key={detail}>{detail}</p>
                      ))}
                    </div>
                  )}
                </div>
                {payload.pricingColumns.slice(0, 3).map((column, valueIndex) => (
                  <div key={`${column}-${valueIndex}`} className="text-right font-medium">
                    {row.values[valueIndex] || '—'}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {payload.retailNote && (
          <p className="mt-4 text-sm leading-6 text-[#4f5b64]">{payload.retailNote}</p>
        )}
        {payload.certifications.length > 0 && (
          <p className="mt-3 text-xs uppercase tracking-[0.15em] text-[#6d6a5d]">
            Certifications: {payload.certifications.join(', ')}
          </p>
        )}
        {payload.pricingDisclaimer && (
          <p className="mt-4 text-xs leading-5 text-[#6a6a61]">{payload.pricingDisclaimer}</p>
        )}
      </div>
    </div>
  )
}

function ProductPackagingSlide({ section }: { section: PresentationSection }) {
  const payload = section.payload as ProductPackagingPayload

  return (
    <div className="flex h-full flex-col rounded-[24px] bg-[#f9f5ee] p-6 md:p-8">
      <div className="max-w-3xl">
        <p className="text-xs uppercase tracking-[0.18em] text-[#7a705b]">{payload.productName || section.title}</p>
        <h2 className="mt-4 text-3xl font-semibold text-[#16232f] md:text-5xl">{section.title}</h2>
        <p className="mt-4 text-sm leading-7 text-[#52606d]">
          {payload.intro || section.body}
        </p>
      </div>

      <div className="mt-8 grid flex-1 gap-4 md:grid-cols-3">
        {payload.packagingIdeas.map((idea, index) => (
          <div key={`${idea.title}-${index}`} className="rounded-[22px] bg-white p-5 shadow-sm">
            <p className="text-lg font-semibold text-[#16232f]">{idea.title}</p>
            <p className="mt-3 text-sm leading-6 text-[#55636e]">{idea.body}</p>
          </div>
        ))}
      </div>

      {payload.footerNote && (
        <p className="mt-6 text-sm leading-6 text-[#5b6770]">{payload.footerNote}</p>
      )}
    </div>
  )
}

function SupportingIdeaSlide({ section }: { section: PresentationSection }) {
  const payload = section.payload as SupportingIdeaPayload

  return (
    <div className="flex h-full rounded-[24px] bg-[#18262d] p-6 text-white md:p-10">
      <div className="my-auto max-w-3xl">
        <p className="text-xs uppercase tracking-[0.18em] text-white/60">{payload.eyebrow || section.title}</p>
        <h2 className="mt-5 text-3xl font-semibold leading-tight md:text-5xl">
          {payload.headline || section.title}
        </h2>
        <p className="mt-6 whitespace-pre-wrap text-base leading-7 text-white/85">
          {payload.body || section.body}
        </p>
      </div>
    </div>
  )
}

function CommercialTermsSlide({ section }: { section: PresentationSection }) {
  const payload = section.payload as CommercialTermsPayload

  return (
    <div className="grid h-full gap-5 md:grid-cols-2">
      <div className="rounded-[24px] bg-[#f4ecd7] p-6 md:p-8">
        <p className="text-xs uppercase tracking-[0.18em] text-[#7a705b]">Shipping</p>
        <h2 className="mt-4 text-3xl font-semibold text-[#16232f] md:text-4xl">Commercial clarity</h2>
        <p className="mt-5 whitespace-pre-wrap text-sm leading-7 text-[#53616c]">
          {payload.shippingTerms}
        </p>
      </div>
      <div className="flex flex-col justify-between rounded-[24px] bg-[#12344a] p-6 text-white md:p-8">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-white/65">Payment terms</p>
          <p className="mt-5 whitespace-pre-wrap text-sm leading-7 text-white/88">
            {payload.paymentTerms}
          </p>
        </div>
        {payload.disclaimer && (
          <p className="mt-6 text-xs leading-5 text-white/70">{payload.disclaimer}</p>
        )}
      </div>
    </div>
  )
}
