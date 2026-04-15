import { createSectionId } from '@/lib/presentations/schema'
import type { PresentationCreateInput, PresentationSection } from '@/types/presentations'

const DEFAULT_PRICING_DISCLAIMER =
  "Pricing is indicative, excludes GST unless noted otherwise, and remains subject to final design, quantity, and freight confirmation at order time."

const DEFAULT_COMMERCIAL_DISCLAIMER =
  'Shipping estimates can change with final quantities, carton configuration, and freight conditions. Final landed costs are confirmed once production specifications are locked.'

export const DEFAULT_PRESENTATION_TEMPLATE_KEY = 'print-room-proposal-v1'

export function createDefaultProposalSections(input: PresentationCreateInput): PresentationSection[] {
  const clientBrand = input.clientBrand || 'Client Brand'
  const seasonLabel = input.seasonLabel || 'Season'

  return [
    {
      id: createSectionId(),
      kind: 'cover',
      title: 'Proposed product range',
      body: `A focused merchandise proposal for ${clientBrand}, shaped for ${seasonLabel} and built to balance storytelling with commercial clarity.`,
      sortOrder: 0,
      isEnabled: true,
      payload: {},
    },
    {
      id: createSectionId(),
      kind: 'brand-intro',
      title: 'Print Room',
      body:
        'We create branded merchandise that feels considered, useful, and commercially defensible. The strongest proposals combine emotional resonance, repeat use, and production practicality.',
      sortOrder: 1,
      isEnabled: true,
      payload: {},
    },
    {
      id: createSectionId(),
      kind: 'brand-context',
      title: `${clientBrand} context`,
      body: `Summarise ${clientBrand}'s tone of voice, retail environment, core audience, and what makes ${seasonLabel} a relevant moment for branded product.`,
      sortOrder: 2,
      isEnabled: true,
      payload: {},
    },
    {
      id: createSectionId(),
      kind: 'product-story',
      title: 'Beach towel',
      body: 'Hero product story',
      sortOrder: 3,
      isEnabled: true,
      payload: {
        productName: 'Beach towel',
        tagline: 'Dry off in style',
        storyCopy:
          'Position this as a summer essential with broad family appeal. Focus on comfort, portability, and how the product keeps the brand present during relaxed, memorable moments.',
        mockupCaption: 'Lifestyle mockup direction',
        mockupNote: 'Use this slide to anchor the hero imagery and set the tone before the specs page.',
        featuredAsset: null,
        supportingAssets: [],
      },
    },
    {
      id: createSectionId(),
      kind: 'product-pricing',
      title: 'Beach towel pricing',
      body: 'Recommended construction and pricing',
      sortOrder: 4,
      isEnabled: true,
      payload: {
        productName: 'Beach towel',
        customisationOptions: [
          'Thread colours',
          'Size options',
          'Print method: jacquard or sublimation',
          'Edge finishing',
          'Packaging approach',
          'Cotton specification and GSM',
        ],
        leadTime: 'Lead time: allow approximately 12 weeks from final sign-off for sea freight production.',
        pricingTitle: 'Indicative pricing',
        pricingColumns: ['10,000', '20,000'],
        pricingRows: [
          {
            label: 'Sublimation beach towel',
            details: ['Velour front and back', 'Oversized format', '100% cotton'],
            values: ['$18.14', '$17.13'],
          },
          {
            label: 'Jacquard woven design',
            details: ['Velour front, terry reverse', 'Oversized format', '100% cotton'],
            values: ['$20.03', '$18.97'],
          },
          {
            label: 'Recommended: jacquard terry towel',
            details: ['Terry both sides', 'Oversized format', '500gsm ringspun cotton'],
            values: ['$17.87', '$16.87'],
          },
        ],
        pricingDisclaimer: DEFAULT_PRICING_DISCLAIMER,
        recommendationTitle: 'Our recommendation',
        recommendationBody:
          'Lead with the jacquard terry construction to keep the product tactile, premium-feeling, and better aligned to everyday repeat use.',
        retailNote: '',
        certifications: [],
      },
    },
    {
      id: createSectionId(),
      kind: 'product-story',
      title: 'Socks',
      body: 'Daily-wear staple',
      sortOrder: 5,
      isEnabled: true,
      payload: {
        productName: 'Socks',
        tagline: 'Sole mates for summer',
        storyCopy:
          'Frame socks as a practical product with high repeat wear. Emphasise comfort, subtle branding, and how easily the product integrates into the customer’s day.',
        mockupCaption: 'Optional sock mockup',
        mockupNote: 'Use this section when mockups or styled product photography are available.',
        featuredAsset: null,
        supportingAssets: [],
      },
    },
    {
      id: createSectionId(),
      kind: 'product-pricing',
      title: 'Socks pricing',
      body: 'Crew sock proposal',
      sortOrder: 6,
      isEnabled: true,
      payload: {
        productName: 'Socks',
        customisationOptions: [
          'Thread colours',
          'Crew or business sock profile',
          'Woven design or sublimation',
          'Construction details like cushioned sole or arch support',
          'Packaging and card wrap options',
        ],
        leadTime: 'Lead time: allow approximately 12 weeks from final sign-off for sea freight production.',
        pricingTitle: 'Indicative pricing',
        pricingColumns: ['1,000-1,999', '2,000-4,999', '5,000-9,999'],
        pricingRows: [
          {
            label: 'Custom sewn crew socks',
            details: ['24cm calf length', 'Cotton blend', 'Embroidery on outer cuff', 'Recycled card wrap'],
            values: ['$10.25', '$8.08', '$6.65'],
          },
        ],
        pricingDisclaimer: DEFAULT_PRICING_DISCLAIMER,
        recommendationTitle: 'Our recommendation',
        recommendationBody:
          'Use socks as a dependable lower-cost entry item in the range, especially when the brief needs a product with consistent everyday visibility.',
        retailNote: '',
        certifications: [],
      },
    },
    {
      id: createSectionId(),
      kind: 'product-story',
      title: 'Beach ball',
      body: 'Playful summer product',
      sortOrder: 7,
      isEnabled: true,
      payload: {
        productName: 'Beach ball',
        tagline: 'Have a ball',
        storyCopy:
          'Position the beach ball as a social, visible product that creates interaction around the brand. This is strongest when paired with packaging or activation ideas that extend use.',
        mockupCaption: 'Kick-off summer',
        mockupNote: 'Mockup for demonstrative purposes only.',
        featuredAsset: null,
        supportingAssets: [],
      },
    },
    {
      id: createSectionId(),
      kind: 'product-pricing',
      title: 'Beach ball pricing',
      body: 'Core product configuration',
      sortOrder: 8,
      isEnabled: true,
      payload: {
        productName: 'Beach ball',
        customisationOptions: [
          'Stock or custom Pantones',
          'Panel shape and panel count',
          'Screen print, full colour, or sublimation',
          'Inner bladder specification',
          'Packaging variations',
        ],
        leadTime: 'Lead time: approximately 3 months from final sign-off.',
        pricingTitle: 'Indicative pricing',
        pricingColumns: ['20,000'],
        pricingRows: [
          {
            label: 'Size 5 neoprene beach ball',
            details: ['2.7mm neoprene outer', 'Rubber bladder', 'Printed logo'],
            values: ['$7.40-$9.00'],
          },
          {
            label: 'Beach ball with premium pack',
            details: ['Mesh bag', 'Printed card header', 'Travel pump'],
            values: ['$10.00-$12.00'],
          },
        ],
        pricingDisclaimer: DEFAULT_PRICING_DISCLAIMER,
        recommendationTitle: 'Commercial note',
        recommendationBody:
          'This category benefits from storytelling beyond the ball itself. Packaging and in-store utility ideas help justify the offer.',
        retailNote: 'Comparable retail products can often sit in the $30-$45 range depending on final execution.',
        certifications: ['BSCI', 'SMETA/SEDEX', 'ISO', 'CE'],
      },
    },
    {
      id: createSectionId(),
      kind: 'product-packaging',
      title: 'Beach ball packaging',
      body: 'Packaging ideas that extend usefulness',
      sortOrder: 9,
      isEnabled: true,
      payload: {
        productName: 'Beach ball',
        intro: 'Use this section to show how packaging can carry extra value beyond transit and presentation.',
        packagingIdeas: [
          {
            title: 'Simple mesh bag',
            body: 'A lightweight reusable option with a printed card header and minimal added cost.',
          },
          {
            title: 'rPET drawstring bag',
            body: 'A stronger reusable format that gives the customer a second-use carry bag after purchase.',
          },
          {
            title: 'Loose supply',
            body: 'Best when price sensitivity is highest and the packaging story is not central to the pitch.',
          },
        ],
        footerNote: 'Reusable packaging works best when the client wants the proposal to feel thoughtful rather than purely promotional.',
      },
    },
    {
      id: createSectionId(),
      kind: 'supporting-idea',
      title: 'Supporting idea',
      body: 'Activation or usage extension',
      sortOrder: 10,
      isEnabled: true,
      payload: {
        eyebrow: 'Food for thought',
        headline: 'Layer in a utility idea around the product',
        body:
          'Use a short concept slide to show how the product could connect with in-store behavior, community moments, or other brand touchpoints beyond the item itself.',
      },
    },
    {
      id: createSectionId(),
      kind: 'product-story',
      title: 'Air freshener',
      body: 'Small-format impulse product',
      sortOrder: 11,
      isEnabled: true,
      payload: {
        productName: 'Air freshener',
        tagline: 'Smells like summer',
        storyCopy:
          'Use this product when the range needs a lighter-entry impulse item with strong thematic storytelling and easy gifting potential.',
        mockupCaption: 'Hangs with your mate',
        mockupNote: 'Mockup for demonstrative purposes only.',
        featuredAsset: null,
        supportingAssets: [],
      },
    },
    {
      id: createSectionId(),
      kind: 'product-pricing',
      title: 'Air freshener pricing',
      body: 'Indicative production model',
      sortOrder: 12,
      isEnabled: true,
      payload: {
        productName: 'Air freshener',
        customisationOptions: [
          'Shape',
          'Single or double-sided print',
          'Scent selection',
          'Packaging configuration',
          'Special finishes such as glow-in-the-dark',
        ],
        leadTime: 'Lead time: approximately 6-8 weeks from sign-off.',
        pricingTitle: 'Indicative pricing',
        pricingColumns: ['10,000', '15,000', '20,000'],
        pricingRows: [
          {
            label: 'Compostable-bag packed air freshener',
            details: ['2mm absorbent paper', 'Double-sided print', 'Backing card included'],
            values: ['$0.90', '$0.73', '$0.70'],
          },
        ],
        pricingDisclaimer: DEFAULT_PRICING_DISCLAIMER,
        recommendationTitle: 'Commercial note',
        recommendationBody:
          'This works well as an entry-level add-on item when the client wants a lower landed price point without losing brand expression.',
        retailNote: 'Comparable retail executions can reach a $5+ sell price depending on packaging and scent profile.',
        certifications: ['SMETA approved', 'FSC'],
      },
    },
    {
      id: createSectionId(),
      kind: 'product-packaging',
      title: 'Air freshener packaging',
      body: 'Back-of-pack messaging opportunity',
      sortOrder: 13,
      isEnabled: true,
      payload: {
        productName: 'Air freshener',
        intro: 'Packaging can do more than hold the product. It can carry a campaign line, care note, or extra brand story.',
        packagingIdeas: [
          {
            title: 'Compostable bag',
            body: 'Supports a sustainability message while keeping the product retail-ready.',
          },
          {
            title: 'Branded backing card',
            body: 'Use the reverse side for campaign messaging, scent notes, or a promotional call-to-action.',
          },
        ],
        footerNote: '',
      },
    },
    {
      id: createSectionId(),
      kind: 'commercial-terms',
      title: 'Commercial terms',
      body: 'Close with operational clarity so the client understands the commercial framework behind the proposal.',
      sortOrder: 14,
      isEnabled: true,
      payload: {
        shippingTerms: DEFAULT_COMMERCIAL_DISCLAIMER,
        paymentTerms:
          'Recommended payment terms: 50% deposit to commence production, with the balance due on the 20th of the month following delivery unless otherwise agreed.',
        disclaimer:
          'Final design approvals, confirmed quantities, and signed-off specifications are required before the order can move into production.',
      },
    },
  ]
}
