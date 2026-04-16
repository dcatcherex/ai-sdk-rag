# Site Structure

> Edit this file to match your actual website pages and file paths.
> This is injected into the AI context when the web-publisher skill is active.

## Main Pages

| Page | File Path | Notes |
|------|-----------|-------|
| Homepage | `app/page.tsx` | Hero, features, CTA sections |
| About | `app/about/page.tsx` | Team, mission, story |
| Features | `app/features/page.tsx` | Product features overview |
| Pricing | `app/pricing/page.tsx` | Plans and pricing table |
| Contact | `app/contact/page.tsx` | Contact form and info |

## Blog

| Item | Path |
|------|------|
| Blog listing | `app/blog/page.tsx` |
| Blog posts directory | `content/blog/` |
| Post format | `content/blog/{slug}.mdx` |

## Good Pages to Clone

These pages have clean layouts suitable for creating new pages with different content:

- `app/features/page.tsx` → clone for new feature sections or use-case pages
- `app/blog/[slug]/page.tsx` → already handles MDX rendering

## Notes for AI

- When the user mentions "the homepage" → `app/page.tsx`
- When the user mentions "a blog post" → new file in `content/blog/`
- When the user mentions "a new page like X" → clone the source page
- File paths are relative to the repository root
- Use forward slashes even on Windows
