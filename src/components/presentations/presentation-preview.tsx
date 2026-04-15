'use client'

import Image from 'next/image'
import styles from './presentation-preview.module.css'
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

const DECK = {
  blue: '#2A3D91',
  green: '#288241',
  lime: '#F1FFA5',
  white: '#FFFFFF',
}

export function PresentationPreview({ presentation }: PresentationPreviewProps) {
  const enabledSections = presentation.sections.filter(section => section.isEnabled)

  return (
    <div className={`presentation-preview space-y-6 ${styles.preview}`}>
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
    <div className="presentation-preview__slide space-y-2">
      <div className="presentation-preview__slideMeta flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <Badge variant="blue">Slide {index + 1}</Badge>
          <Badge variant="gray">{section.kind}</Badge>
        </div>
        <span className="text-xs text-muted-foreground">{section.title || 'Untitled section'}</span>
      </div>

      <Card className="presentation-preview__slideCard overflow-hidden rounded-[28px] border-[#DDD8CC] bg-[#F1EFE7] shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
        <div className="presentation-preview__canvas aspect-video bg-[#F1EFE7] p-4 md:p-5">
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
    <div
      className="presentation-preview__inner relative flex h-full flex-col items-center justify-between overflow-hidden rounded-[24px] px-8 py-8 text-center text-white md:px-12 md:py-10"
      style={{ backgroundColor: DECK.blue }}
    >
      <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-white/72">
        {proposalTitle || section.title || 'Proposed product range'}
      </p>

      <div className="flex flex-1 flex-col items-center justify-center">
        <h2 className="text-[clamp(3.4rem,8vw,5.8rem)] font-extrabold leading-[0.92] tracking-[-0.06em]">
          <span className="block">{clientBrand || 'Client Brand'}</span>
          <span className="block text-[0.8em] leading-none">x</span>
          <span className="block">Print Room</span>
        </h2>

        <p className="mt-7 text-[clamp(1.4rem,2.4vw,2rem)] font-semibold tracking-[-0.03em]">
          {seasonLabel || 'Season'}
        </p>

        {section.body && (
          <p className="mt-6 max-w-2xl text-sm leading-6 text-white/82">
            {section.body}
          </p>
        )}
      </div>

      <div className="flex w-full items-end justify-between gap-4">
        <p className="text-lg font-medium tracking-[-0.03em]">{coverDateLabel || 'Date'}</p>
        <DeckLogo tone="light" className="w-[92px]" />
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
  const isBrand = tone === 'brand'
  const [prefix, emphasis] = isBrand
    ? [section.body || section.title, '']
    : splitLastSentence(section.body || section.title)

  return (
    <div
      className="presentation-preview__inner relative flex h-full overflow-hidden rounded-[24px] px-10 py-10 md:px-14 md:py-12"
      style={{
        backgroundColor: isBrand ? DECK.blue : DECK.green,
        color: DECK.white,
      }}
    >
      <div className="m-auto max-w-5xl text-center">
        <p className="text-[clamp(1.9rem,3.3vw,2.95rem)] font-medium leading-[1.22] tracking-[-0.04em] whitespace-pre-line">
          {prefix}
          {emphasis && (
            <>
              {' '}
              <span className="font-bold">{emphasis}</span>
            </>
          )}
        </p>
      </div>

      {isBrand && <DeckLogo tone="light" className="absolute bottom-8 right-9 w-[88px]" />}
    </div>
  )
}

function ProductStorySlide({ section }: { section: PresentationSection }) {
  const payload = section.payload as ProductStoryPayload
  const paragraphs = splitParagraphs(payload.storyCopy || section.body)
  const columns = splitNarrativeColumns(paragraphs)
  const supportingAssets = payload.supportingAssets?.slice(0, 3) ?? []
  const featuredAsset = payload.featuredAsset || supportingAssets[0]
  const thumbnailAssets = payload.featuredAsset ? supportingAssets : supportingAssets.slice(1)

  return (
    <div className="presentation-preview__inner grid h-full gap-4 overflow-hidden rounded-[24px] bg-[#FAF9F4] p-4 md:grid-cols-[1.06fr_0.94fr] md:p-5">
      <div
        className="flex h-full flex-col rounded-[20px] px-7 py-7 text-black md:px-8 md:py-8"
        style={{ backgroundColor: DECK.lime }}
      >
        <h2 className="max-w-xl text-[clamp(2.75rem,5vw,4.45rem)] font-bold leading-[0.95] tracking-[-0.06em] text-black">
          {payload.tagline || section.title}
        </h2>

        <div className="mt-8 grid gap-5 text-[15px] leading-7 text-black/90 md:grid-cols-2">
          {columns.map((items, columnIndex) => (
            <div key={columnIndex} className="space-y-4">
              {items.map(paragraph => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          ))}
        </div>

        <p className="mt-auto pt-6 text-[11px] font-semibold uppercase tracking-[0.28em] text-black/58">
          {payload.productName || section.title}
        </p>
      </div>

      <div className="relative flex h-full flex-col justify-between rounded-[20px] border-2 border-dashed border-[#2A3D91]/18 bg-white px-7 py-7 md:px-8 md:py-8">
        <div
          className="absolute inset-x-0 top-0 h-2"
          style={{ backgroundColor: DECK.blue }}
        />

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#2A3D91]/62">
            Mockup direction
          </p>
          <h3 className="mt-5 max-w-sm text-[clamp(2.25rem,4.4vw,3.7rem)] font-bold leading-[0.96] tracking-[-0.05em] text-black">
            {payload.mockupCaption || 'Lifestyle mockup'}
          </h3>
          <p className="mt-5 max-w-md text-sm leading-6 text-black/60">
            {payload.mockupNote || 'Use this panel for the final visual concept, styled mockup, or generated product imagery.'}
          </p>
        </div>

        {featuredAsset ? (
          <div className="space-y-3">
            <div className="overflow-hidden rounded-[20px] border border-[#E4E7EF] bg-[#F8F9FC]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={featuredAsset.url}
                alt={featuredAsset.label}
                className="h-56 w-full object-cover"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              {thumbnailAssets.length > 0
                ? thumbnailAssets.map(asset => (
                    <div key={asset.assetId} className="overflow-hidden rounded-[18px] border border-[#E4E7EF] bg-[#F8F9FC]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={asset.url} alt={asset.label} className="h-24 w-full object-cover" />
                    </div>
                  ))
                : Array.from({ length: 3 }, (_, index) => (
                    <div
                      key={index}
                      className="rounded-[18px] border border-[#E4E7EF] bg-[#F8F9FC]"
                      style={{ height: index === 1 ? '7rem' : '5.75rem' }}
                    />
                  ))}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {Array.from({ length: 3 }, (_, index) => (
              <div
                key={index}
                className="rounded-[18px] border border-[#E4E7EF] bg-[#F8F9FC]"
                style={{ height: index === 1 ? '7rem' : '5.75rem' }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ProductPricingSlide({ section }: { section: PresentationSection }) {
  const payload = section.payload as ProductPricingPayload
  const pricingColumns = payload.pricingColumns.filter(Boolean).slice(0, 3)
  const tableColumns = Math.max(pricingColumns.length, 1)
  const gridTemplateColumns = `minmax(0, 1.7fr) repeat(${tableColumns}, minmax(0, 0.86fr))`

  return (
    <div className="presentation-preview__inner grid h-full gap-4 overflow-hidden rounded-[24px] bg-white p-4 md:grid-cols-[0.96fr_1.04fr] md:p-5">
      <div className="rounded-[20px] bg-white px-2 py-1 md:px-4">
        <HighlightHeading>{payload.productName || section.title}</HighlightHeading>

        <div className="mt-7 rounded-[20px] border border-[#E3E3DB] bg-[#FBFBF8] p-5">
          <p className="text-base font-semibold text-black">Customisation options. Some may affect pricing:</p>
          {payload.customisationOptions.length > 0 ? (
            <ul className="mt-4 space-y-2 pl-5 text-[15px] leading-6 text-black/88">
              {payload.customisationOptions.map(option => (
                <li key={option} className="list-disc">
                  {option}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm leading-6 text-black/55">
              Add customisation options to show the main pricing variables for this product.
            </p>
          )}
        </div>

        {payload.leadTime && (
          <p className="mt-4 text-sm leading-6 text-black/74">{payload.leadTime}</p>
        )}

        {payload.recommendationBody && (
          <div className="mt-4 rounded-[18px] border border-black/8 bg-[#F1FFA5] px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-black/70">
              {payload.recommendationTitle || 'Our recommendation'}
            </p>
            <p className="mt-2 text-sm leading-6 text-black/84">{payload.recommendationBody}</p>
          </div>
        )}
      </div>

      <div className="rounded-[20px] border border-[#D8D8D2] bg-white px-5 py-5">
        <div className="overflow-hidden rounded-[18px] border border-[#CCCCCC] bg-white">
          <div
            className="grid border-b border-[#CCCCCC]"
            style={{ gridTemplateColumns }}
          >
            <div className="bg-[#F7F7F2] px-4 py-4 text-xl font-bold tracking-[-0.03em] text-black">
              {payload.pricingTitle || 'Indicative pricing'}
            </div>
            {(pricingColumns.length > 0 ? pricingColumns : ['Price']).map(column => (
              <div
                key={column}
                className="border-l border-[#CCCCCC] bg-[#FBFBF8] px-4 py-4 text-right text-sm font-semibold text-black"
              >
                {column}
              </div>
            ))}
          </div>

          <div>
            {payload.pricingRows.slice(0, 4).map((row, rowIndex) => (
              <div
                key={`${row.label}-${rowIndex}`}
                className="grid border-b border-[#CCCCCC] last:border-b-0"
                style={{ gridTemplateColumns }}
              >
                <div className="px-4 py-4 text-black">
                  <p className="text-[15px] font-semibold leading-6">{row.label || 'Option'}</p>
                  {row.details.length > 0 && (
                    <div className="mt-2 space-y-1 text-xs leading-5 text-black/62">
                      {row.details.map(detail => (
                        <p key={detail}>{detail}</p>
                      ))}
                    </div>
                  )}
                </div>

                {(pricingColumns.length > 0 ? pricingColumns : ['Price']).map((column, valueIndex) => (
                  <div
                    key={`${column}-${valueIndex}`}
                    className="flex items-center justify-end border-l border-[#CCCCCC] px-4 py-4 text-sm font-medium text-black"
                  >
                    {row.values[valueIndex] || '—'}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {payload.retailNote && (
          <p className="mt-4 text-sm leading-6 text-black/72">{payload.retailNote}</p>
        )}

        {payload.certifications.length > 0 && (
          <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-black/55">
            Certifications: {payload.certifications.join(', ')}
          </p>
        )}

        {payload.pricingDisclaimer && (
          <p className="mt-4 text-[11px] leading-5 text-[#727272]">{payload.pricingDisclaimer}</p>
        )}
      </div>
    </div>
  )
}

function ProductPackagingSlide({ section }: { section: PresentationSection }) {
  const payload = section.payload as ProductPackagingPayload

  return (
    <div className="presentation-preview__inner flex h-full flex-col overflow-hidden rounded-[24px] bg-[#FAFAF7] px-8 py-8 md:px-10 md:py-9">
      <div className="max-w-4xl">
        <HighlightHeading>{section.title}</HighlightHeading>
        <p className="mt-7 text-lg leading-8 tracking-[-0.02em] text-black/84">
          {payload.intro || section.body}
        </p>
      </div>

      <div className="mt-8 grid flex-1 gap-4 md:grid-cols-3">
        {payload.packagingIdeas.map((idea, index) => (
          <div
            key={`${idea.title}-${index}`}
            className="rounded-[22px] border border-[#E5E5DE] bg-white p-6 shadow-[0_10px_24px_rgba(15,23,42,0.04)]"
          >
            <p className="text-[22px] font-bold leading-tight tracking-[-0.04em] text-black">
              {idea.title || `Idea ${index + 1}`}
            </p>
            <p className="mt-4 text-sm leading-6 text-black/66">{idea.body}</p>
          </div>
        ))}
      </div>

      {payload.footerNote && (
        <p className="mt-6 text-sm leading-6 text-black/64">{payload.footerNote}</p>
      )}
    </div>
  )
}

function SupportingIdeaSlide({ section }: { section: PresentationSection }) {
  const payload = section.payload as SupportingIdeaPayload

  return (
    <div
      className="presentation-preview__inner flex h-full overflow-hidden rounded-[24px] px-9 py-9 text-white md:px-12 md:py-11"
      style={{ backgroundColor: DECK.blue }}
    >
      <div className="my-auto max-w-4xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/65">
          {payload.eyebrow || section.title}
        </p>
        <h2 className="mt-5 text-[clamp(3rem,5.6vw,5rem)] font-bold leading-[0.94] tracking-[-0.06em]">
          {payload.headline || section.title}
        </h2>
        {payload.body && (
          <p className="mt-6 max-w-3xl text-lg leading-8 text-white/86">{payload.body}</p>
        )}
      </div>
    </div>
  )
}

function CommercialTermsSlide({ section }: { section: PresentationSection }) {
  const payload = section.payload as CommercialTermsPayload

  return (
    <div className="presentation-preview__inner grid h-full gap-4 overflow-hidden rounded-[24px] bg-[#FAFAF7] p-4 md:grid-cols-[1.03fr_0.97fr] md:p-5">
      <div className="rounded-[20px] bg-white px-7 py-7">
        <div className="h-px w-full bg-black/70" />
        <p className="mt-7 text-[11px] font-semibold uppercase tracking-[0.28em] text-black/60">
          Shipping
        </p>
        <h2 className="mt-4 text-[clamp(2.2rem,4.4vw,3.7rem)] font-bold leading-[0.96] tracking-[-0.05em] text-black">
          Commercial terms
        </h2>
        <p className="mt-6 whitespace-pre-wrap text-sm leading-7 text-black/75">
          {payload.shippingTerms}
        </p>
      </div>

      <div
        className="flex flex-col rounded-[20px] px-7 py-7 text-white"
        style={{ backgroundColor: DECK.blue }}
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/66">
          Payment terms
        </p>
        <p className="mt-6 whitespace-pre-wrap text-sm leading-7 text-white/88">
          {payload.paymentTerms}
        </p>
        {payload.disclaimer && (
          <p className="mt-auto pt-6 text-xs leading-5 text-white/68">{payload.disclaimer}</p>
        )}
      </div>
    </div>
  )
}

function DeckLogo({
  tone,
  className,
}: {
  tone: 'light' | 'default'
  className?: string
}) {
  return (
    <Image
      src="/print-room-logo.png"
      alt=""
      aria-hidden="true"
      width={132}
      height={104}
      className={[
        'h-auto',
        tone === 'light' ? 'brightness-0 invert' : '',
        className || '',
      ].join(' ').trim()}
    />
  )
}

function HighlightHeading({ children }: { children: string }) {
  return (
    <h2 className="inline-block rounded-[8px] bg-[#F1FFA5] px-4 py-2 text-[clamp(2.8rem,5vw,4.8rem)] font-bold leading-[0.95] tracking-[-0.06em] text-black">
      {children}
    </h2>
  )
}

function splitParagraphs(value: string) {
  return value
    .split(/\n+/)
    .map(item => item.trim())
    .filter(Boolean)
}

function splitNarrativeColumns(paragraphs: string[]) {
  if (paragraphs.length <= 1) {
    return [paragraphs, []]
  }

  const midpoint = Math.ceil(paragraphs.length / 2)
  return [paragraphs.slice(0, midpoint), paragraphs.slice(midpoint)]
}

function splitLastSentence(value: string) {
  const cleaned = value.trim()
  if (!cleaned) return ['', '']

  const matches = cleaned.match(/[^.!?]+[.!?]?/g)?.map(item => item.trim()).filter(Boolean) || []
  if (matches.length <= 1) return [cleaned, '']

  const lastSentence = matches[matches.length - 1]
  const leading = matches.slice(0, -1).join(' ')
  return [leading, lastSentence]
}
