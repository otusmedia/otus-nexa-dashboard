import { supabase } from "@/lib/supabase";

export type PortfolioMediaType = "image" | "video";
export type PortfolioAspect = "portrait" | "landscape" | "square";

export type PortfolioNavItem = {
  id: string;
  label: string;
  anchor: string;
};

export type PortfolioHeroCta = {
  label: string;
  anchor: string;
};

export type PortfolioHeroStat = {
  id: string;
  value: string;
  label: string;
};

export type PortfolioHighlight = {
  id: string;
  title: string;
  description: string;
  coverMediaType: PortfolioMediaType | null;
  coverMediaUrl: string | null;
  /** Optional link to a portfolio project page */
  linkedItemId: string | null;
};

export type PortfolioImpactStat = {
  id: string;
  value: string;
  label: string;
  delta?: string;
};

export type PortfolioAboutBrand = {
  id: string;
  name: string;
  logoUrl: string | null;
};

export type PortfolioAboutTeamMember = {
  id: string;
  name: string;
  role: string;
  bio: string;
  photoUrl: string | null;
};

export type PortfolioAboutAward = {
  id: string;
  org: string;
  detail: string;
  count: string;
};

export type PortfolioAboutTestimonial = {
  id: string;
  quote: string;
  name: string;
  title: string;
  photoUrl: string | null;
};

export type PortfolioAboutInsight = {
  id: string;
  title: string;
  excerpt: string;
  imageUrl: string | null;
  meta: string;
};

export type PortfolioAboutPlan = {
  id: string;
  name: string;
  price: string;
  description: string;
  features: string[];
  ctaLabel: string;
  featured?: boolean;
};

export type PortfolioAboutFaq = {
  id: string;
  question: string;
  answer: string;
};

export type PortfolioAboutBlockKey =
  | "intro"
  | "gallery"
  | "feature"
  | "impact"
  | "brands"
  | "team"
  | "testimonials"
  | "cta"
  | "insights"
  | "pricing"
  | "faq";

export type PortfolioAboutBlocks = Record<PortfolioAboutBlockKey, boolean>;

/** Editor prefs: hide placeholder sample media after the user dismisses them. */
export type PortfolioSuppressedSamples = {
  gallery?: boolean;
  feature?: boolean;
  teamIds?: string[];
  testimonialIds?: string[];
  insightIds?: string[];
  /** Sample work tiles dismissed in the Work grid */
  workItemIds?: string[];
  /** Sample highlight slides dismissed */
  highlightIds?: string[];
  /** Project ids whose sample gallery fillers were cleared */
  projectGalleryItemIds?: string[];
};

export type PortfolioAboutContent = {
  eyebrow: string;
  title: string;
  lead: string;
  galleryUrls: string[];
  featureCaption: string;
  featureImageUrl: string | null;
  impactEyebrow: string;
  impactHeadline: string;
  impactBody: string;
  impactStats: PortfolioImpactStat[];
  brandsEyebrow: string;
  brandsHeadline: string;
  brandsBody: string;
  brands: PortfolioAboutBrand[];
  teamEyebrow: string;
  teamHeadline: string;
  teamMembers: PortfolioAboutTeamMember[];
  awards: PortfolioAboutAward[];
  teamCtaLabel: string;
  testimonialsEyebrow: string;
  testimonialsHeadline: string;
  testimonials: PortfolioAboutTestimonial[];
  ctaHeadline: string;
  ctaLabel: string;
  insightsEyebrow: string;
  insightsHeadline: string;
  insightsBody: string;
  insights: PortfolioAboutInsight[];
  pricingEyebrow: string;
  pricingHeadline: string;
  pricingBody: string;
  plans: PortfolioAboutPlan[];
  faqs: PortfolioAboutFaq[];
  blocks: PortfolioAboutBlocks;
  suppressedSamples?: PortfolioSuppressedSamples;
};

export type PortfolioSectionKey = "hero" | "work" | "highlights" | "about";

export type PortfolioSectionsVisibility = Record<PortfolioSectionKey, boolean>;

export type PortfolioPageContent = {
  logoUrl: string | null;
  navItems: PortfolioNavItem[];
  ctaLabel: string;
  /** @deprecated fullscreen cover — kept for publish compatibility */
  heroMediaType: PortfolioMediaType | null;
  heroMediaUrl: string | null;
  heroHeadline: string;
  heroPrimaryCta: PortfolioHeroCta;
  heroSecondaryCta: PortfolioHeroCta;
  heroStats: PortfolioHeroStat[];
  highlights: PortfolioHighlight[];
  bandTitle: string;
  bandTagline: string;
  aboutText: string;
  aboutImageUrl: string | null;
  about: PortfolioAboutContent;
  sections: PortfolioSectionsVisibility;
};

export type PortfolioGalleryBlock = {
  id: string;
  mediaType: PortfolioMediaType | null;
  mediaUrl: string | null;
};

export type PortfolioItemContent = {
  id: string;
  title: string;
  subtitle: string;
  role: string;
  client: string;
  year: string;
  coverMediaType: PortfolioMediaType | null;
  coverMediaUrl: string | null;
  description: string;
  aboutText: string;
  problem: string;
  solution: string;
  challenge: string;
  result: string;
  gallery: PortfolioGalleryBlock[];
  sortOrder: number;
  aspect: PortfolioAspect;
};

export type PortfolioSiteData = {
  accountId: string;
  publicSlug: string | null;
  kind: string;
  publishedAt: string | null;
  page: PortfolioPageContent;
  items: PortfolioItemContent[];
};

const DEFAULT_NAV: PortfolioNavItem[] = [
  { id: "work", label: "Work", anchor: "work" },
  { id: "about", label: "About", anchor: "about" },
];

const DEFAULT_HEADLINE =
  "Films and visual stories for brands that want work that looks good and feels effortless.";

const DEFAULT_PRIMARY_CTA: PortfolioHeroCta = { label: "View work", anchor: "work" };
const DEFAULT_SECONDARY_CTA: PortfolioHeroCta = { label: "Get in touch", anchor: "about" };

const DEFAULT_STATS: PortfolioHeroStat[] = [
  { id: "s1", value: "50+", label: "Projects" },
  { id: "s2", value: "10+", label: "Years" },
  { id: "s3", value: "Worldwide", label: "Clients" },
  { id: "s4", value: "Cinema", label: "Craft" },
];

const DEFAULT_SECTIONS: PortfolioSectionsVisibility = {
  hero: true,
  work: true,
  highlights: true,
  about: true,
};

const DEFAULT_ABOUT_BLOCKS: PortfolioAboutBlocks = {
  intro: true,
  gallery: true,
  feature: true,
  impact: true,
  brands: true,
  team: true,
  testimonials: true,
  cta: true,
  insights: true,
  pricing: true,
  faq: true,
};

const DEFAULT_ABOUT: PortfolioAboutContent = {
  eyebrow: "Welcome to",
  title: "Studio",
  lead: "We are a collective of filmmakers and visual storytellers driven by purpose, not just profit. We transform complex visions into powerful cinematic realities, crafting films that are as beautiful as they are impactful.",
  galleryUrls: [],
  featureCaption: "Designing the future, today.",
  featureImageUrl: null,
  impactEyebrow: "Our real impact",
  impactHeadline:
    "We craft visual pathways that elevate brands, designing films that captivate audiences and secure long-term success.",
  impactBody:
    "Our methodology is built on the intersection of craft and narrative. We don't just shoot content — we architect comprehensive cinematic ecosystems that drive real brand growth. By combining human-centric storytelling with rigorous production, we empower brands to connect deeply with their audiences.",
  impactStats: [
    { id: "a1", value: "72+", label: "Projects shipped globally", delta: "+5%" },
    { id: "a2", value: "98%", label: "Client satisfaction score", delta: "+5%" },
    { id: "a3", value: "40+", label: "Brand partners", delta: "+5%" },
    { id: "a4", value: "12", label: "Countries reached", delta: "+5%" },
  ],
  brandsEyebrow: "/Trusted",
  brandsHeadline: "Brands.",
  brandsBody: "From early startups to global enterprises, we help ambitious brands find their own true voice.",
  brands: [
    { id: "b1", name: "Revo", logoUrl: null },
    { id: "b2", name: "Tenxa", logoUrl: null },
    { id: "b3", name: "Loop", logoUrl: null },
    { id: "b4", name: "Aries", logoUrl: null },
    { id: "b5", name: "Bioscale", logoUrl: null },
    { id: "b6", name: "Northbyte", logoUrl: null },
    { id: "b7", name: "NextLayer", logoUrl: null },
    { id: "b8", name: "Silvergrid", logoUrl: null },
    { id: "b9", name: "Metrion", logoUrl: null },
    { id: "b10", name: "Horizon", logoUrl: null },
    { id: "b11", name: "Lumix", logoUrl: null },
    { id: "b12", name: "Strive", logoUrl: null },
  ],
  teamEyebrow: "Meet the creators",
  teamHeadline: "We are the explorers, the dreamers, and the builders who guide your brand to its next destination.",
  teamMembers: [
    {
      id: "t1",
      name: "Jonathan Reed",
      role: "CEO & Founder",
      bio: "Your film is most likely the first point of contact someone will have with your brand.",
      photoUrl: null,
    },
    {
      id: "t2",
      name: "Michael Williams",
      role: "Creative Director",
      bio: "Your film is most likely the first point of contact someone will have with your brand.",
      photoUrl: null,
    },
    {
      id: "t3",
      name: "Emily Dawson",
      role: "Producer",
      bio: "Your film is most likely the first point of contact someone will have with your brand.",
      photoUrl: null,
    },
  ],
  awards: [
    { id: "aw1", org: "Awwwards", detail: "Developer Award, Site of the Day", count: "x03 Awards" },
    { id: "aw2", org: "Behance", detail: "Website of the Day, Special Mention", count: "x07 Awards" },
    { id: "aw3", org: "One Page Love", detail: "Featured Website, Honorable Mention", count: "x12 Awards" },
    { id: "aw4", org: "CSS Winner", detail: "Site of the Day", count: "x05 Awards" },
    { id: "aw5", org: "Site Inspire", detail: "Featured UX/UI and XD Design", count: "x26 Awards" },
    { id: "aw6", org: "CSS Light", detail: "Site of the Day, Special Mention", count: "x03 Awards" },
  ],
  teamCtaLabel: "Be the next one",
  testimonialsEyebrow: "Voices of partners",
  testimonialsHeadline:
    "We build the relationships that empower brands to grow, scaling their impact beyond every boundary.",
  testimonials: [
    {
      id: "tm1",
      quote:
        "They transformed our unclear vision into a cohesive brand film, allowing us to communicate with clarity and confidence.",
      name: "Ethan Carter",
      title: "Operations Lead — Revo®",
      photoUrl: null,
    },
    {
      id: "tm2",
      quote:
        "The level of visibility we now have was unimaginable before. It fundamentally changed how we present the brand.",
      name: "Charles Davis",
      title: "Head of Strategy — Loop®",
      photoUrl: null,
    },
    {
      id: "tm3",
      quote:
        "Collaborating used to be a major challenge. Alignment has become our default mode of operation.",
      name: "Jhonny Ross",
      title: "CEO — Aries Studio®",
      photoUrl: null,
    },
  ],
  ctaHeadline: "Ready to start your new journey?",
  ctaLabel: "Get in touch",
  insightsEyebrow: "Our posts",
  insightsHeadline: "Explore more insights",
  insightsBody:
    "The exploration never ends. Dive into more case studies and discover how we help brands navigate the digital landscape.",
  insights: [
    {
      id: "i1",
      title: "Launching faster: the competitive edge of rapid production.",
      excerpt: "How speed and craft can coexist without compromise.",
      imageUrl: null,
      meta: "Insight",
    },
    {
      id: "i2",
      title: "Why minimalism still wins in cinematic design.",
      excerpt: "Less noise, more presence — framing that holds attention.",
      imageUrl: null,
      meta: "Insight",
    },
    {
      id: "i3",
      title: "Motion as strategy: films that move people to act.",
      excerpt: "Designing experiences that convert attention into action.",
      imageUrl: null,
      meta: "Insight",
    },
  ],
  pricingEyebrow: "Start your journey",
  pricingHeadline: "Pricing for Visionaries",
  pricingBody:
    "Every great journey starts with a single step. We provide the map and the gear you need to reach the summit.",
  plans: [
    {
      id: "p1",
      name: "Project Based",
      price: "U$ 5,000.00",
      description: "Ideal for those who need a specific project completed with precision, speed, and high-end aesthetics.",
      features: [
        "Custom Strategy & Direction",
        "High-End Motion Design",
        "Color & Finishing",
        "Global Delivery",
      ],
      ctaLabel: "Let's work together",
      featured: true,
    },
    {
      id: "p2",
      name: "Subscription",
      price: "U$ 10,000.00",
      description: "Designed for those who need ongoing support, continuous evolution, and a dedicated creative partner.",
      features: [
        "Unlimited Design & Dev Sprints",
        "Priority Async Support",
        "Bi-Weekly Sync Meetings",
        "Pause At Any Time",
      ],
      ctaLabel: "Let's work together",
      featured: false,
    },
  ],
  faqs: [
    {
      id: "f1",
      question: "What is the Design Process?",
      answer:
        "The process typically involves research, brainstorming, concept development, production, and revisions. Clear communication throughout ensures the final film meets expectations.",
    },
    {
      id: "f2",
      question: "How Much Does It Cost to Hire a Film Studio?",
      answer:
        "Cost varies by scope, experience, and complexity. Expect anywhere from a few thousand to several tens of thousands depending on the brief.",
    },
    {
      id: "f3",
      question: "What Services Do You Offer?",
      answer:
        "Direction, cinematography, editing, motion design, brand films, campaign content, and ongoing creative partnership.",
    },
    {
      id: "f4",
      question: "How to Choose a Studio?",
      answer:
        "Evaluate portfolio, process, and communication style. Find a partner that aligns with your vision and can deliver the quality you expect.",
    },
  ],
  blocks: { ...DEFAULT_ABOUT_BLOCKS },
};

function parseSections(raw: unknown): PortfolioSectionsVisibility {
  const base = { ...DEFAULT_SECTIONS };
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Record<string, unknown>;
  (Object.keys(base) as PortfolioSectionKey[]).forEach((key) => {
    if (typeof r[key] === "boolean") base[key] = r[key] as boolean;
  });
  return base;
}

function parseAboutBlocks(raw: unknown): PortfolioAboutBlocks {
  const base = { ...DEFAULT_ABOUT_BLOCKS };
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Record<string, unknown>;
  (Object.keys(base) as PortfolioAboutBlockKey[]).forEach((key) => {
    if (typeof r[key] === "boolean") base[key] = r[key] as boolean;
  });
  return base;
}

function parseImpactStats(raw: unknown): PortfolioImpactStat[] {
  if (!Array.isArray(raw) || !raw.length) return DEFAULT_ABOUT.impactStats.map((s) => ({ ...s }));
  const out: PortfolioImpactStat[] = [];
  for (let i = 0; i < raw.length; i++) {
    const row = raw[i];
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const value = String(r.value ?? "").trim();
    const label = String(r.label ?? "").trim();
    if (!value && !label) continue;
    out.push({
      id: String(r.id ?? `a${i}`).trim() || `a${i}`,
      value: value || "—",
      label: label || "—",
      delta: r.delta != null && String(r.delta).trim() ? String(r.delta).trim() : undefined,
    });
  }
  return out.length ? out : DEFAULT_ABOUT.impactStats.map((s) => ({ ...s }));
}

function strOr(raw: unknown, fallback: string): string {
  return raw != null && String(raw).trim() ? String(raw).trim() : fallback;
}

function parseAboutContent(
  raw: unknown,
  legacyText: string,
  legacyImage: string | null,
  version: "draft" | "live",
): PortfolioAboutContent {
  const emptyLive = version === "live";
  const fallback: PortfolioAboutContent = emptyLive
    ? {
        ...DEFAULT_ABOUT,
        eyebrow: "",
        title: "",
        lead: legacyText.trim() || "",
        featureImageUrl: legacyImage,
        galleryUrls: legacyImage ? [legacyImage] : [],
        brands: [],
        teamMembers: [],
        awards: [],
        testimonials: [],
        insights: [],
        plans: [],
        faqs: [],
      }
    : {
        ...DEFAULT_ABOUT,
        lead: legacyText.trim() || DEFAULT_ABOUT.lead,
        featureImageUrl: legacyImage,
        galleryUrls: legacyImage ? [legacyImage] : [],
      };

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return fallback;
  const r = raw as Record<string, unknown>;
  const gallery = Array.isArray(r.galleryUrls)
    ? r.galleryUrls.map((u) => String(u ?? "").trim()).filter(Boolean).slice(0, 6)
    : fallback.galleryUrls;

  const brands: PortfolioAboutBrand[] = Array.isArray(r.brands)
    ? r.brands
        .map((row, i) => {
          if (!row || typeof row !== "object") return null;
          const b = row as Record<string, unknown>;
          const name = String(b.name ?? "").trim();
          if (!name) return null;
          return {
            id: String(b.id ?? `b${i}`),
            name,
            logoUrl: b.logoUrl != null && String(b.logoUrl).trim() ? String(b.logoUrl).trim() : null,
          };
        })
        .filter((x): x is PortfolioAboutBrand => Boolean(x))
    : fallback.brands;

  const teamMembers: PortfolioAboutTeamMember[] = Array.isArray(r.teamMembers)
    ? r.teamMembers
        .map((row, i) => {
          if (!row || typeof row !== "object") return null;
          const t = row as Record<string, unknown>;
          const name = String(t.name ?? "").trim();
          if (!name) return null;
          return {
            id: String(t.id ?? `t${i}`),
            name,
            role: String(t.role ?? ""),
            bio: String(t.bio ?? ""),
            photoUrl: t.photoUrl != null && String(t.photoUrl).trim() ? String(t.photoUrl).trim() : null,
          };
        })
        .filter((x): x is PortfolioAboutTeamMember => Boolean(x))
    : fallback.teamMembers;

  const awards: PortfolioAboutAward[] = Array.isArray(r.awards)
    ? r.awards
        .map((row, i) => {
          if (!row || typeof row !== "object") return null;
          const a = row as Record<string, unknown>;
          const org = String(a.org ?? "").trim();
          if (!org) return null;
          return {
            id: String(a.id ?? `aw${i}`),
            org,
            detail: String(a.detail ?? ""),
            count: String(a.count ?? ""),
          };
        })
        .filter((x): x is PortfolioAboutAward => Boolean(x))
    : fallback.awards;

  const testimonials: PortfolioAboutTestimonial[] = Array.isArray(r.testimonials)
    ? r.testimonials
        .map((row, i) => {
          if (!row || typeof row !== "object") return null;
          const t = row as Record<string, unknown>;
          const quote = String(t.quote ?? "").trim();
          const name = String(t.name ?? "").trim();
          if (!quote && !name) return null;
          return {
            id: String(t.id ?? `tm${i}`),
            quote: quote || "—",
            name: name || "—",
            title: String(t.title ?? ""),
            photoUrl: t.photoUrl != null && String(t.photoUrl).trim() ? String(t.photoUrl).trim() : null,
          };
        })
        .filter((x): x is PortfolioAboutTestimonial => Boolean(x))
    : fallback.testimonials;

  const insights: PortfolioAboutInsight[] = Array.isArray(r.insights)
    ? r.insights
        .map((row, i) => {
          if (!row || typeof row !== "object") return null;
          const item = row as Record<string, unknown>;
          const title = String(item.title ?? "").trim();
          if (!title) return null;
          return {
            id: String(item.id ?? `i${i}`),
            title,
            excerpt: String(item.excerpt ?? ""),
            imageUrl:
              item.imageUrl != null && String(item.imageUrl).trim() ? String(item.imageUrl).trim() : null,
            meta: String(item.meta ?? ""),
          };
        })
        .filter((x): x is PortfolioAboutInsight => Boolean(x))
    : fallback.insights;

  const plans: PortfolioAboutPlan[] = [];
  if (Array.isArray(r.plans)) {
    for (let i = 0; i < r.plans.length; i++) {
      const row = r.plans[i];
      if (!row || typeof row !== "object") continue;
      const p = row as Record<string, unknown>;
      const name = String(p.name ?? "").trim();
      if (!name) continue;
      plans.push({
        id: String(p.id ?? `p${i}`),
        name,
        price: String(p.price ?? ""),
        description: String(p.description ?? ""),
        features: Array.isArray(p.features)
          ? p.features.map((f) => String(f ?? "").trim()).filter(Boolean)
          : [],
        ctaLabel: String(p.ctaLabel ?? "Let's work together"),
        featured: Boolean(p.featured) || undefined,
      });
    }
  }
  const resolvedPlans = plans.length ? plans : fallback.plans;

  const faqs: PortfolioAboutFaq[] = Array.isArray(r.faqs)
    ? r.faqs
        .map((row, i) => {
          if (!row || typeof row !== "object") return null;
          const f = row as Record<string, unknown>;
          const question = String(f.question ?? "").trim();
          if (!question) return null;
          return {
            id: String(f.id ?? `f${i}`),
            question,
            answer: String(f.answer ?? ""),
          };
        })
        .filter((x): x is PortfolioAboutFaq => Boolean(x))
    : fallback.faqs;

  return {
    eyebrow: strOr(r.eyebrow, fallback.eyebrow),
    title: strOr(r.title, fallback.title),
    lead: strOr(r.lead, fallback.lead),
    galleryUrls: gallery,
    featureCaption: strOr(r.featureCaption, fallback.featureCaption),
    featureImageUrl:
      r.featureImageUrl != null && String(r.featureImageUrl).trim()
        ? String(r.featureImageUrl).trim()
        : fallback.featureImageUrl,
    impactEyebrow: strOr(r.impactEyebrow, fallback.impactEyebrow),
    impactHeadline: strOr(r.impactHeadline, fallback.impactHeadline),
    impactBody: strOr(r.impactBody, fallback.impactBody),
    impactStats: parseImpactStats(r.impactStats),
    brandsEyebrow: strOr(r.brandsEyebrow, fallback.brandsEyebrow),
    brandsHeadline: strOr(r.brandsHeadline, fallback.brandsHeadline),
    brandsBody: strOr(r.brandsBody, fallback.brandsBody),
    brands: brands.length ? brands : fallback.brands,
    teamEyebrow: strOr(r.teamEyebrow, fallback.teamEyebrow),
    teamHeadline: strOr(r.teamHeadline, fallback.teamHeadline),
    teamMembers: teamMembers.length ? teamMembers : fallback.teamMembers,
    awards: awards.length ? awards : fallback.awards,
    teamCtaLabel: strOr(r.teamCtaLabel, fallback.teamCtaLabel),
    testimonialsEyebrow: strOr(r.testimonialsEyebrow, fallback.testimonialsEyebrow),
    testimonialsHeadline: strOr(r.testimonialsHeadline, fallback.testimonialsHeadline),
    testimonials: testimonials.length ? testimonials : fallback.testimonials,
    ctaHeadline: strOr(r.ctaHeadline, fallback.ctaHeadline),
    ctaLabel: strOr(r.ctaLabel, fallback.ctaLabel),
    insightsEyebrow: strOr(r.insightsEyebrow, fallback.insightsEyebrow),
    insightsHeadline: strOr(r.insightsHeadline, fallback.insightsHeadline),
    insightsBody: strOr(r.insightsBody, fallback.insightsBody),
    insights: insights.length ? insights : fallback.insights,
    pricingEyebrow: strOr(r.pricingEyebrow, fallback.pricingEyebrow),
    pricingHeadline: strOr(r.pricingHeadline, fallback.pricingHeadline),
    pricingBody: strOr(r.pricingBody, fallback.pricingBody),
    plans: resolvedPlans,
    faqs: faqs.length ? faqs : fallback.faqs,
    blocks: parseAboutBlocks(r.blocks),
    suppressedSamples: parseSuppressedSamples(r.suppressedSamples),
  };
}

function parseSuppressedSamples(raw: unknown): PortfolioSuppressedSamples | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const r = raw as Record<string, unknown>;
  const ids = (v: unknown) =>
    Array.isArray(v) ? v.map((x) => String(x ?? "").trim()).filter(Boolean) : undefined;
  const out: PortfolioSuppressedSamples = {};
  if (r.gallery === true) out.gallery = true;
  if (r.feature === true) out.feature = true;
  const teamIds = ids(r.teamIds);
  if (teamIds?.length) out.teamIds = teamIds;
  const testimonialIds = ids(r.testimonialIds);
  if (testimonialIds?.length) out.testimonialIds = testimonialIds;
  const insightIds = ids(r.insightIds);
  if (insightIds?.length) out.insightIds = insightIds;
  const workItemIds = ids(r.workItemIds);
  if (workItemIds?.length) out.workItemIds = workItemIds;
  const highlightIds = ids(r.highlightIds);
  if (highlightIds?.length) out.highlightIds = highlightIds;
  const projectGalleryItemIds = ids(r.projectGalleryItemIds);
  if (projectGalleryItemIds?.length) out.projectGalleryItemIds = projectGalleryItemIds;
  return Object.keys(out).length ? out : undefined;
}

function parseNav(raw: unknown): PortfolioNavItem[] {
  if (!Array.isArray(raw)) return [...DEFAULT_NAV];
  const items = raw
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const r = row as Record<string, unknown>;
      const id = String(r.id ?? "").trim();
      const label = String(r.label ?? "").trim();
      const anchor = String(r.anchor ?? "").trim();
      if (!id || !label || !anchor) return null;
      return { id, label, anchor };
    })
    .filter((x): x is PortfolioNavItem => Boolean(x));
  return items.length ? items : [...DEFAULT_NAV];
}

function parseCta(raw: unknown, fallback: PortfolioHeroCta): PortfolioHeroCta {
  if (!raw || typeof raw !== "object") return { ...fallback };
  const r = raw as Record<string, unknown>;
  const label = String(r.label ?? "").trim();
  const anchor = String(r.anchor ?? "").trim();
  if (!label) return { ...fallback };
  return { label, anchor: anchor || fallback.anchor };
}

function parseStats(raw: unknown): PortfolioHeroStat[] {
  if (!Array.isArray(raw)) return DEFAULT_STATS.map((s) => ({ ...s }));
  const stats = raw
    .map((row, i) => {
      if (!row || typeof row !== "object") return null;
      const r = row as Record<string, unknown>;
      const value = String(r.value ?? "").trim();
      const label = String(r.label ?? "").trim();
      if (!value && !label) return null;
      return {
        id: String(r.id ?? `s${i}`).trim() || `s${i}`,
        value: value || "—",
        label: label || "—",
      };
    })
    .filter((x): x is PortfolioHeroStat => Boolean(x));
  return stats.length ? stats : DEFAULT_STATS.map((s) => ({ ...s }));
}

function parseHighlights(raw: unknown): PortfolioHighlight[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row, i) => {
      if (!row || typeof row !== "object") return null;
      const r = row as Record<string, unknown>;
      const id = String(r.id ?? `h${i}`).trim() || `h${i}`;
      const title = String(r.title ?? "").trim();
      const coverMediaUrl =
        r.coverMediaUrl != null && String(r.coverMediaUrl).trim()
          ? String(r.coverMediaUrl).trim()
          : null;
      const mediaTypeRaw = String(r.coverMediaType ?? "");
      const coverMediaType: PortfolioMediaType | null =
        mediaTypeRaw === "image" || mediaTypeRaw === "video" ? mediaTypeRaw : coverMediaUrl ? "image" : null;
      const linked =
        r.linkedItemId != null && String(r.linkedItemId).trim() ? String(r.linkedItemId).trim() : null;
      if (!title && !coverMediaUrl) return null;
      return {
        id,
        title: title || "Untitled",
        description: String(r.description ?? ""),
        coverMediaType,
        coverMediaUrl,
        linkedItemId: linked,
      };
    })
    .filter((x): x is PortfolioHighlight => Boolean(x));
}

function parseAspect(raw: unknown): PortfolioAspect {
  const v = String(raw ?? "");
  if (v === "portrait" || v === "square" || v === "landscape") return v;
  return "landscape";
}

function parseMediaType(raw: unknown): PortfolioMediaType | null {
  const v = String(raw ?? "");
  if (v === "image" || v === "video") return v;
  return null;
}

function pageFromRow(row: Record<string, unknown>, version: "draft" | "live"): PortfolioPageContent {
  const p = version === "draft" ? "draft" : "live";
  const headlineRaw = row[`${p}_hero_headline`];
  const headline =
    headlineRaw != null && String(headlineRaw).trim()
      ? String(headlineRaw).trim()
      : version === "draft"
        ? DEFAULT_HEADLINE
        : "";

  return {
    logoUrl: row[`${p}_logo_url`] != null && String(row[`${p}_logo_url`]).trim() ? String(row[`${p}_logo_url`]) : null,
    navItems: parseNav(row[`${p}_nav_items`]),
    ctaLabel: String(row[`${p}_cta_label`] ?? "Get in touch").trim() || "Get in touch",
    heroMediaType: parseMediaType(row[`${p}_hero_media_type`]),
    heroMediaUrl:
      row[`${p}_hero_media_url`] != null && String(row[`${p}_hero_media_url`]).trim()
        ? String(row[`${p}_hero_media_url`])
        : null,
    heroHeadline: headline,
    heroPrimaryCta: parseCta(row[`${p}_hero_primary_cta`], DEFAULT_PRIMARY_CTA),
    heroSecondaryCta: parseCta(row[`${p}_hero_secondary_cta`], DEFAULT_SECONDARY_CTA),
    heroStats: parseStats(row[`${p}_hero_stats`]),
    highlights: parseHighlights(row[`${p}_highlights`]),
    bandTitle:
      row[`${p}_band_title`] != null && String(row[`${p}_band_title`]).trim()
        ? String(row[`${p}_band_title`]).trim()
        : version === "draft"
          ? "Studio."
          : "",
    bandTagline:
      row[`${p}_band_tagline`] != null && String(row[`${p}_band_tagline`]).trim()
        ? String(row[`${p}_band_tagline`]).trim()
        : version === "draft"
          ? "Films and visual stories for brands that want work that looks good and feels effortless."
          : "",
    aboutText: String(row[`${p}_about_text`] ?? ""),
    aboutImageUrl:
      row[`${p}_about_image_url`] != null && String(row[`${p}_about_image_url`]).trim()
        ? String(row[`${p}_about_image_url`])
        : null,
    about: parseAboutContent(
      row[`${p}_about_content`],
      String(row[`${p}_about_text`] ?? ""),
      row[`${p}_about_image_url`] != null && String(row[`${p}_about_image_url`]).trim()
        ? String(row[`${p}_about_image_url`])
        : null,
      version,
    ),
    sections: parseSections(row[`${p}_sections`]),
  };
}

function parseGallery(raw: unknown): PortfolioGalleryBlock[] {
  if (!Array.isArray(raw)) return [];
  const out: PortfolioGalleryBlock[] = [];
  for (let i = 0; i < raw.length; i++) {
    const row = raw[i];
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const mediaUrl =
      r.mediaUrl != null && String(r.mediaUrl).trim()
        ? String(r.mediaUrl).trim()
        : r.coverMediaUrl != null && String(r.coverMediaUrl).trim()
          ? String(r.coverMediaUrl).trim()
          : null;
    if (!mediaUrl) continue;
    const mediaTypeRaw = String(r.mediaType ?? r.coverMediaType ?? "");
    const mediaType: PortfolioMediaType | null =
      mediaTypeRaw === "image" || mediaTypeRaw === "video" ? mediaTypeRaw : "image";
    out.push({
      id: String(r.id ?? `g${i}`).trim() || `g${i}`,
      mediaType,
      mediaUrl,
    });
  }
  return out;
}

function itemFromRow(row: Record<string, unknown>, version: "draft" | "live"): PortfolioItemContent | null {
  if (version === "live" && row.in_live !== true) return null;
  const p = version === "draft" ? "draft" : "live";
  const title = String(row[`${p}_title`] ?? "").trim();
  const coverUrl =
    row[`${p}_cover_media_url`] != null && String(row[`${p}_cover_media_url`]).trim()
      ? String(row[`${p}_cover_media_url`])
      : null;
  const description = String(row[`${p}_description`] ?? "");
  const aboutRaw = row[`${p}_about_text`];
  const aboutText =
    aboutRaw != null && String(aboutRaw).trim() ? String(aboutRaw) : description;
  return {
    id: String(row.id ?? ""),
    title: title || (version === "draft" ? "Untitled" : ""),
    subtitle: String(row[`${p}_subtitle`] ?? "").trim(),
    role: String(row[`${p}_role`] ?? "").trim(),
    client: String(row[`${p}_client`] ?? "").trim(),
    year: String(row[`${p}_year`] ?? "").trim(),
    coverMediaType: parseMediaType(row[`${p}_cover_media_type`]),
    coverMediaUrl: coverUrl,
    description,
    aboutText,
    problem: String(row[`${p}_problem`] ?? "").trim(),
    solution: String(row[`${p}_solution`] ?? "").trim(),
    challenge: String(row[`${p}_challenge`] ?? "").trim(),
    result: String(row[`${p}_result`] ?? "").trim(),
    gallery: parseGallery(row[`${p}_gallery`]),
    sortOrder: Number(row[`${p}_sort_order`] ?? 0) || 0,
    aspect: parseAspect(row[`${p}_aspect`]),
  };
}

async function ensurePortfolioPage(accountId: string): Promise<Record<string, unknown>> {
  const { data: existing, error: readErr } = await supabase
    .from("portfolio_pages")
    .select("*")
    .eq("account_id", accountId)
    .maybeSingle();
  if (readErr) throw new Error(readErr.message);
  if (existing) return existing as Record<string, unknown>;

  const { error: insErr } = await supabase
    .from("portfolio_pages")
    .upsert({ account_id: accountId }, { onConflict: "account_id", ignoreDuplicates: true });

  if (insErr) throw new Error(insErr.message);

  const { data: again, error: againErr } = await supabase
    .from("portfolio_pages")
    .select("*")
    .eq("account_id", accountId)
    .maybeSingle();
  if (againErr) throw new Error(againErr.message);
  if (!again) throw new Error("Could not create portfolio page.");
  return again as Record<string, unknown>;
}

export async function loadPortfolioSite(
  accountId: string,
  version: "draft" | "live",
): Promise<PortfolioSiteData> {
  const { data: account, error: accErr } = await supabase
    .from("accounts")
    .select("id, kind, public_slug")
    .eq("id", accountId)
    .maybeSingle();
  if (accErr) throw new Error(accErr.message);
  if (!account) throw new Error("Account not found");

  const pageRow = await ensurePortfolioPage(accountId);

  const { data: itemRows, error: itemsErr } = await supabase
    .from("portfolio_items")
    .select("*")
    .eq("account_id", accountId)
    .order(version === "draft" ? "draft_sort_order" : "live_sort_order", { ascending: true });
  if (itemsErr) throw new Error(itemsErr.message);

  const items = ((itemRows as Array<Record<string, unknown>> | null) ?? [])
    .map((row) => itemFromRow(row, version))
    .filter((x): x is PortfolioItemContent => Boolean(x && x.id))
    .sort((a, b) => a.sortOrder - b.sortOrder);

  return {
    accountId,
    publicSlug:
      account.public_slug != null && String(account.public_slug).trim()
        ? String(account.public_slug).trim()
        : null,
    kind: String(account.kind ?? ""),
    publishedAt: pageRow.published_at != null ? String(pageRow.published_at) : null,
    page: pageFromRow(pageRow, version),
    items,
  };
}

export async function loadPublicPortfolioBySlug(slug: string): Promise<PortfolioSiteData | null> {
  const normalized = slug.trim().toLowerCase();
  if (!normalized) return null;

  const { data: account, error } = await supabase
    .from("accounts")
    .select("id, kind, public_slug")
    .eq("kind", "filmmaker")
    .ilike("public_slug", normalized)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!account?.id) return null;

  return loadPortfolioSite(String(account.id), "live");
}

export async function loadPortfolioItem(
  accountId: string,
  itemId: string,
  version: "draft" | "live",
): Promise<PortfolioItemContent | null> {
  const { data, error } = await supabase
    .from("portfolio_items")
    .select("*")
    .eq("account_id", accountId)
    .eq("id", itemId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return itemFromRow(data as Record<string, unknown>, version);
}

export async function updatePortfolioPageDraft(
  accountId: string,
  patch: Partial<PortfolioPageContent>,
): Promise<void> {
  await ensurePortfolioPage(accountId);
  const db: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.logoUrl !== undefined) db.draft_logo_url = patch.logoUrl;
  if (patch.navItems !== undefined) db.draft_nav_items = patch.navItems;
  if (patch.ctaLabel !== undefined) db.draft_cta_label = patch.ctaLabel;
  if (patch.heroMediaType !== undefined) db.draft_hero_media_type = patch.heroMediaType;
  if (patch.heroMediaUrl !== undefined) db.draft_hero_media_url = patch.heroMediaUrl;
  if (patch.heroHeadline !== undefined) db.draft_hero_headline = patch.heroHeadline;
  if (patch.heroPrimaryCta !== undefined) db.draft_hero_primary_cta = patch.heroPrimaryCta;
  if (patch.heroSecondaryCta !== undefined) db.draft_hero_secondary_cta = patch.heroSecondaryCta;
  if (patch.heroStats !== undefined) db.draft_hero_stats = patch.heroStats;
  if (patch.highlights !== undefined) db.draft_highlights = patch.highlights;
  if (patch.bandTitle !== undefined) db.draft_band_title = patch.bandTitle;
  if (patch.bandTagline !== undefined) db.draft_band_tagline = patch.bandTagline;
  if (patch.aboutText !== undefined) db.draft_about_text = patch.aboutText;
  if (patch.aboutImageUrl !== undefined) db.draft_about_image_url = patch.aboutImageUrl;
  if (patch.about !== undefined) {
    db.draft_about_content = patch.about;
    if (patch.about.lead !== undefined) db.draft_about_text = patch.about.lead;
    if (patch.about.featureImageUrl !== undefined) {
      db.draft_about_image_url = patch.about.featureImageUrl;
    }
  }
  if (patch.sections !== undefined) db.draft_sections = patch.sections;

  const { error } = await supabase.from("portfolio_pages").update(db).eq("account_id", accountId);
  if (error) throw new Error(error.message);
}

export async function upsertPortfolioItemDraft(
  accountId: string,
  input: {
    id?: string;
    title: string;
    coverMediaType: PortfolioMediaType | null;
    coverMediaUrl: string | null;
    description?: string;
    subtitle?: string;
    role?: string;
    client?: string;
    year?: string;
    aboutText?: string;
    problem?: string;
    solution?: string;
    challenge?: string;
    result?: string;
    gallery?: PortfolioGalleryBlock[];
    aspect?: PortfolioAspect;
  },
): Promise<PortfolioItemContent> {
  if (input.id) {
    const patch: Record<string, unknown> = {
      draft_title: input.title.trim() || "Untitled",
      draft_cover_media_type: input.coverMediaType,
      draft_cover_media_url: input.coverMediaUrl,
      draft_description: input.description ?? "",
      draft_aspect: input.aspect ?? "landscape",
      updated_at: new Date().toISOString(),
    };
    if (input.subtitle !== undefined) patch.draft_subtitle = input.subtitle;
    if (input.role !== undefined) patch.draft_role = input.role;
    if (input.client !== undefined) patch.draft_client = input.client;
    if (input.year !== undefined) patch.draft_year = input.year;
    if (input.aboutText !== undefined) patch.draft_about_text = input.aboutText;
    if (input.problem !== undefined) patch.draft_problem = input.problem;
    if (input.solution !== undefined) patch.draft_solution = input.solution;
    if (input.challenge !== undefined) patch.draft_challenge = input.challenge;
    if (input.result !== undefined) patch.draft_result = input.result;
    if (input.gallery !== undefined) patch.draft_gallery = input.gallery;

    const { data, error } = await supabase
      .from("portfolio_items")
      .update(patch)
      .eq("id", input.id)
      .eq("account_id", accountId)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    const item = itemFromRow(data as Record<string, unknown>, "draft");
    if (!item) throw new Error("Failed to map item");
    return item;
  }

  const { data: existing } = await supabase
    .from("portfolio_items")
    .select("draft_sort_order")
    .eq("account_id", accountId)
    .order("draft_sort_order", { ascending: false })
    .limit(1);
  const nextOrder = existing?.[0] ? Number(existing[0].draft_sort_order ?? 0) + 1 : 0;

  const aspects: PortfolioAspect[] = ["landscape", "portrait", "square"];
  const aspect = input.aspect ?? aspects[nextOrder % aspects.length]!;

  const { data, error } = await supabase
    .from("portfolio_items")
    .insert({
      account_id: accountId,
      draft_title: input.title.trim() || "Untitled",
      draft_cover_media_type: input.coverMediaType,
      draft_cover_media_url: input.coverMediaUrl,
      draft_description: input.description ?? "",
      draft_subtitle: input.subtitle ?? "",
      draft_role: input.role ?? "",
      draft_client: input.client ?? "",
      draft_year: input.year ?? "",
      draft_about_text: input.aboutText ?? input.description ?? "",
      draft_problem: input.problem ?? "",
      draft_solution: input.solution ?? "",
      draft_challenge: input.challenge ?? "",
      draft_result: input.result ?? "",
      draft_gallery: input.gallery ?? [],
      draft_sort_order: nextOrder,
      draft_aspect: aspect,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  const item = itemFromRow(data as Record<string, unknown>, "draft");
  if (!item) throw new Error("Failed to map item");
  return item;
}

export async function deletePortfolioItemDraft(accountId: string, itemId: string): Promise<void> {
  const { error } = await supabase.from("portfolio_items").delete().eq("id", itemId).eq("account_id", accountId);
  if (error) throw new Error(error.message);
}

/** Copy draft → live for page + items. Visitor only ever sees live. */
export async function publishPortfolio(accountId: string): Promise<void> {
  const pageRow = await ensurePortfolioPage(accountId);
  const now = new Date().toISOString();

  const { error: pageErr } = await supabase
    .from("portfolio_pages")
    .update({
      live_logo_url: pageRow.draft_logo_url ?? null,
      live_nav_items: pageRow.draft_nav_items ?? DEFAULT_NAV,
      live_cta_label: pageRow.draft_cta_label ?? "Get in touch",
      live_hero_media_type: pageRow.draft_hero_media_type ?? null,
      live_hero_media_url: pageRow.draft_hero_media_url ?? null,
      live_hero_headline: pageRow.draft_hero_headline ?? DEFAULT_HEADLINE,
      live_hero_primary_cta: pageRow.draft_hero_primary_cta ?? DEFAULT_PRIMARY_CTA,
      live_hero_secondary_cta: pageRow.draft_hero_secondary_cta ?? DEFAULT_SECONDARY_CTA,
      live_hero_stats: pageRow.draft_hero_stats ?? DEFAULT_STATS,
      live_highlights: pageRow.draft_highlights ?? [],
      live_band_title: pageRow.draft_band_title ?? "Studio.",
      live_band_tagline:
        pageRow.draft_band_tagline ??
        "Films and visual stories for brands that want work that looks good and feels effortless.",
      live_about_text: pageRow.draft_about_text ?? "",
      live_about_image_url: pageRow.draft_about_image_url ?? null,
      live_about_content: pageRow.draft_about_content ?? {},
      live_sections: pageRow.draft_sections ?? DEFAULT_SECTIONS,
      published_at: now,
      updated_at: now,
    })
    .eq("account_id", accountId);
  if (pageErr) throw new Error(pageErr.message);

  const { data: items, error: itemsErr } = await supabase
    .from("portfolio_items")
    .select("*")
    .eq("account_id", accountId);
  if (itemsErr) throw new Error(itemsErr.message);

  for (const row of items ?? []) {
    const r = row as Record<string, unknown>;
    const { error } = await supabase
      .from("portfolio_items")
      .update({
        live_title: r.draft_title,
        live_cover_media_type: r.draft_cover_media_type,
        live_cover_media_url: r.draft_cover_media_url,
        live_description: r.draft_description,
        live_subtitle: r.draft_subtitle ?? "",
        live_role: r.draft_role ?? "",
        live_client: r.draft_client ?? "",
        live_year: r.draft_year ?? "",
        live_about_text: r.draft_about_text ?? r.draft_description ?? "",
        live_problem: r.draft_problem ?? "",
        live_solution: r.draft_solution ?? "",
        live_challenge: r.draft_challenge ?? "",
        live_result: r.draft_result ?? "",
        live_gallery: r.draft_gallery ?? [],
        live_sort_order: r.draft_sort_order,
        live_aspect: r.draft_aspect,
        in_live: true,
        updated_at: now,
      })
      .eq("id", r.id)
      .eq("account_id", accountId);
    if (error) throw new Error(error.message);
  }
}
