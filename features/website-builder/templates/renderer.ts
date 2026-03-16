import type { SiteDataJson, SiteSection } from '../types';
import { portfolioTemplate } from './portfolio';
import { serviceLandingTemplate } from './service-landing';
import { consultingTemplate } from './consulting';
import { personalTemplate } from './personal';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderSection(section: SiteSection): string {
  if (!section.visible) return '';

  switch (section.type) {
    case 'hero': {
      const { headline, subtext, ctaText, ctaUrl } = section.data;
      return `
<section id="hero" style="background: var(--primary); color: #fff; padding: 100px 0; text-align: center;">
  <div class="container">
    <h1 style="font-size: 3rem; font-weight: 800; line-height: 1.15; margin-bottom: 20px;">${escapeHtml(headline)}</h1>
    <p style="font-size: 1.25rem; opacity: 0.85; max-width: 600px; margin: 0 auto 36px;">${escapeHtml(subtext)}</p>
    <a href="${escapeHtml(ctaUrl)}" class="btn" style="background:#fff; color: var(--primary); font-weight: 700;">${escapeHtml(ctaText)}</a>
  </div>
</section>`;
    }

    case 'features': {
      const { heading, features } = section.data;
      const cards = features.map(f => `
    <div style="flex: 1 1 280px; background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 28px;">
      <h3 style="font-size: 1.1rem; font-weight: 700; margin-bottom: 10px; color: var(--primary);">${escapeHtml(f.title)}</h3>
      <p style="color: #6b7280; font-size: 0.95rem;">${escapeHtml(f.description)}</p>
    </div>`).join('');
      return `
<section id="features" style="background: #f9fafb;">
  <div class="container">
    <div class="section-heading" style="text-align: center; margin-bottom: 48px;">
      <h2 style="font-size: 2rem; font-weight: 700;">${escapeHtml(heading)}</h2>
    </div>
    <div style="display: flex; flex-wrap: wrap; gap: 24px;">${cards}</div>
  </div>
</section>`;
    }

    case 'about': {
      const { heading, body } = section.data;
      return `
<section id="about">
  <div class="container" style="max-width: 760px;">
    <h2 style="font-size: 2rem; font-weight: 700; margin-bottom: 20px;">${escapeHtml(heading)}</h2>
    <p style="color: #374151; font-size: 1.05rem; line-height: 1.8;">${escapeHtml(body)}</p>
  </div>
</section>`;
    }

    case 'testimonials': {
      const { heading, testimonials } = section.data;
      const cards = testimonials.map(t => `
    <div style="flex: 1 1 280px; background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 28px;">
      <p style="color: #374151; font-style: italic; margin-bottom: 16px;">"${escapeHtml(t.quote)}"</p>
      <p style="font-weight: 600; color: var(--primary);">— ${escapeHtml(t.author)}${t.role ? `, <span style="font-weight: 400; color: #6b7280;">${escapeHtml(t.role)}</span>` : ''}</p>
    </div>`).join('');
      return `
<section id="testimonials" style="background: #f9fafb;">
  <div class="container">
    <div style="text-align: center; margin-bottom: 48px;">
      <h2 style="font-size: 2rem; font-weight: 700;">${escapeHtml(heading)}</h2>
    </div>
    <div style="display: flex; flex-wrap: wrap; gap: 24px;">${cards}</div>
  </div>
</section>`;
    }

    case 'pricing': {
      const { heading, plans } = section.data;
      const cards = plans.map(p => `
    <div style="flex: 1 1 240px; border: 2px solid ${p.highlighted ? 'var(--primary)' : '#e5e7eb'}; border-radius: 12px; padding: 32px; text-align: center; ${p.highlighted ? 'background: var(--primary); color: #fff;' : 'background: #fff;'}">
      <h3 style="font-size: 1.1rem; font-weight: 700; margin-bottom: 8px;">${escapeHtml(p.name)}</h3>
      <p style="font-size: 2rem; font-weight: 800; margin-bottom: 20px;">${escapeHtml(p.price)}</p>
      <ul style="list-style: none; text-align: left; margin-bottom: 24px;">
        ${p.features.map(f => `<li style="padding: 6px 0; border-bottom: 1px solid ${p.highlighted ? 'rgba(255,255,255,0.2)' : '#f3f4f6'};">&#10003; ${escapeHtml(f)}</li>`).join('')}
      </ul>
      <a href="#contact" class="btn" style="${p.highlighted ? 'background:#fff; color: var(--primary);' : 'background: var(--primary); color: #fff;'}">Get started</a>
    </div>`).join('');
      return `
<section id="pricing">
  <div class="container">
    <div style="text-align: center; margin-bottom: 48px;">
      <h2 style="font-size: 2rem; font-weight: 700;">${escapeHtml(heading)}</h2>
    </div>
    <div style="display: flex; flex-wrap: wrap; gap: 24px; justify-content: center;">${cards}</div>
  </div>
</section>`;
    }

    case 'faq': {
      const { heading, items } = section.data;
      const faqs = items.map(item => `
    <div style="border-bottom: 1px solid #e5e7eb; padding: 20px 0;">
      <h3 style="font-size: 1rem; font-weight: 600; margin-bottom: 8px; color: var(--primary);">${escapeHtml(item.question)}</h3>
      <p style="color: #6b7280; font-size: 0.95rem;">${escapeHtml(item.answer)}</p>
    </div>`).join('');
      return `
<section id="faq" style="background: #f9fafb;">
  <div class="container" style="max-width: 760px;">
    <div style="text-align: center; margin-bottom: 48px;">
      <h2 style="font-size: 2rem; font-weight: 700;">${escapeHtml(heading)}</h2>
    </div>
    ${faqs}
  </div>
</section>`;
    }

    case 'contact': {
      const { heading, email, phone, address } = section.data;
      const items = [
        email ? `<p>&#9993; <a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></p>` : '',
        phone ? `<p>&#9742; ${escapeHtml(phone)}</p>` : '',
        address ? `<p>&#128205; ${escapeHtml(address)}</p>` : '',
      ].filter(Boolean).join('');
      return `
<section id="contact">
  <div class="container" style="max-width: 600px; text-align: center;">
    <h2 style="font-size: 2rem; font-weight: 700; margin-bottom: 20px;">${escapeHtml(heading)}</h2>
    <div style="color: #374151; font-size: 1rem; line-height: 2.2;">${items}</div>
  </div>
</section>`;
    }

    case 'cta': {
      const { heading, subtext, ctaText, ctaUrl } = section.data;
      return `
<section id="cta" style="background: var(--accent); color: #fff; text-align: center;">
  <div class="container">
    <h2 style="font-size: 2.25rem; font-weight: 800; margin-bottom: 16px;">${escapeHtml(heading)}</h2>
    <p style="font-size: 1.1rem; opacity: 0.9; margin-bottom: 32px;">${escapeHtml(subtext)}</p>
    <a href="${escapeHtml(ctaUrl)}" class="btn" style="background: #fff; color: var(--accent); font-weight: 700;">${escapeHtml(ctaText)}</a>
  </div>
</section>`;
    }
  }
}

function getBaseTemplate(templateSlug: string): string {
  switch (templateSlug) {
    case 'portfolio': return portfolioTemplate;
    case 'service-landing': return serviceLandingTemplate;
    case 'consulting': return consultingTemplate;
    case 'personal': return personalTemplate;
    default: return serviceLandingTemplate;
  }
}

export function renderSiteToHtml(data: SiteDataJson): string {
  const sectionHtml = data.sections.map(renderSection).join('\n');
  const currentYear = new Date().getFullYear().toString();

  const base = getBaseTemplate(data.templateSlug);

  return base
    .replace(/\{\{siteName\}\}/g, escapeHtml(data.siteName))
    .replace(/\{\{tagline\}\}/g, escapeHtml(data.tagline))
    .replace(/\{\{heroHeadline\}\}/g, escapeHtml(data.heroHeadline))
    .replace(/\{\{heroSubtext\}\}/g, escapeHtml(data.heroSubtext))
    .replace(/\{\{primaryColor\}\}/g, escapeHtml(data.primaryColor))
    .replace(/\{\{accentColor\}\}/g, escapeHtml(data.accentColor))
    .replace(/\{\{fontHeading\}\}/g, encodeURIComponent(data.fontHeading))
    .replace(/\{\{fontBody\}\}/g, encodeURIComponent(data.fontBody))
    .replace(/\{\{ctaText\}\}/g, escapeHtml(data.ctaText))
    .replace(/\{\{ctaUrl\}\}/g, escapeHtml(data.ctaUrl))
    .replace(/\{\{metaTitle\}\}/g, escapeHtml(data.meta.title))
    .replace(/\{\{metaDescription\}\}/g, escapeHtml(data.meta.description))
    .replace(/\{\{currentYear\}\}/g, currentYear)
    .replace(/\{\{sections\}\}/g, sectionHtml);
}
