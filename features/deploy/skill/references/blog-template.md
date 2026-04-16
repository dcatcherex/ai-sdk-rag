# Blog Post Template

> Edit this file to match your MDX setup and frontmatter requirements.
> This is injected into the AI context when writing blog posts.

## File Location

```
content/blog/{slug}.mdx
```

Slug rules:
- Lowercase, hyphens only, no spaces
- Descriptive but concise (3–6 words)
- Example: `thai-farmers-using-ai`, `how-vaja-works`, `team-credit-sharing`

## MDX Frontmatter

```mdx
---
title: "Full Title of the Post"
slug: "url-safe-slug"
date: "YYYY-MM-DD"
excerpt: "One or two sentences that summarize the post. Shown in blog listings and social previews."
tags: ["tag1", "tag2"]
author: "Author Name"
coverImage: "/images/blog/{slug}/cover.jpg"
---
```

## Content Structure

```mdx
## Introduction

Open with a hook — the problem, the story, or the question being answered.

## Main Section

Use ## for main sections, ### for sub-sections.

Keep paragraphs short (3–4 sentences max).

## Key Points / How It Works

- Bullet points for lists
- Bold **key terms** for emphasis
- Use `code` for technical terms

## Conclusion

Summarize the key takeaway.
End with a clear call to action if appropriate.
```

## Formatting Rules

- Use plain, clear language — avoid jargon
- Write for the target audience (see style guide)
- Include 3–6 tags per post
- Excerpt should be 1–2 sentences, under 160 characters
- Do not embed images directly — reference paths only

## Example Post

```mdx
---
title: "How AI Helps Thai Farmers Spot Crop Disease Early"
slug: "ai-crop-disease-detection-thai-farmers"
date: "2026-04-16"
excerpt: "A short guide to how AI-powered pest and disease consultation is changing farming in Thailand."
tags: ["agriculture", "AI", "Thailand", "farming"]
author: "Vaja Team"
---

## The Problem Every Farmer Knows

Spotting leaf blight early can save an entire harvest. But knowing exactly what to look for...

## How the Skill Works

When a farmer asks about yellowing leaves on their cassava plants, the AI...

## Getting Started

1. Open Vaja AI via your LINE OA
2. Type a description or send a photo of the affected plant
3. The pest-disease skill activates automatically

## What's Next

We're adding regional pesticide availability data for all 77 provinces...
```
