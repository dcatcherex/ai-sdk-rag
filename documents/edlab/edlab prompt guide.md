Create a [VISUAL_STYLE] social media advertisement for [BRAND_NAME] promoting [PROGRAM_NAME].

Reference handling:
Image A is the real activity photo. [HERO_IMAGE_ROLE]
Image B is the official logo of [BRAND_NAME]. Place it neatly in the [LOGO_PLACEMENT], preserving its recognizable shape and colors.
[OPTIONAL_IMAGE_C_LINE]

Visual direction:
Use a real-photo-based premium ad style, not a synthetic-looking poster. The result should feel authentic, polished, trustworthy, and aspirational. Preserve the reality of the hospital or learning environment while improving the image for advertising use.

Photo content:
The hero photo shows [PHOTO_TYPE].
Apply [PHOTO_EDITING_STYLE] while keeping the people, activity, and medical context believable and real.

Brand style:
[BRAND_STYLE]

Color palette:
[BRAND_COLORS]

Mood:
[MOOD]

Layout:
Create a clean, premium composition suitable for [FORMAT].
Use the activity photo as the main focus.
Keep typography elegant and easy to read.
Use [TEXT_DENSITY].
Allow room for headline, subheadline, highlights, badge, and CTA.
Avoid clutter and avoid a cheap flyer look.

Text to include:
Headline: "[HEADLINE]"
Subheadline: "[SUBHEADLINE]"
Highlight 1: "[HIGHLIGHT_1]"
Highlight 2: "[HIGHLIGHT_2]"
Highlight 3: "[HIGHLIGHT_3]"
[OPTIONAL_HIGHLIGHT_4]
[OPTIONAL_HIGHLIGHT_5]
Badge / callout: "[BADGE_TEXT]"
CTA: "[CTA]"
Footer contact: "[CONTACT_LINE]"

Design notes:
Use subtle healthcare-themed visual accents only if helpful, such as soft geometric overlays, clean dividers, or a small certificate badge.
Do not overcrowd the design.
Do not distort the logo.
Do not replace the real activity with fake imagery.
Keep the final ad premium, modern, and conversion-focused.

# Global Prompt System for EdLab Experience Ad Posts

---

## 1) Core idea of the system

The best-performing structure for your kind of ads is usually:

- **1 real hero activity photo**
- **1 logo**
- **optional 1 supporting photo**
- **short premium text**
- **clean healthcare/education branding**
- **authentic but polished look**

So this system is built around that.

---

# 2) Placeholder Library

Use these placeholders in your prompts.

---

## A. Brand / Program placeholders

- `[BRAND_NAME]`
Example: `EdLab Experience`
- `[PROGRAM_NAME]`
Example: `Medical Shadowing Program`
- `[PROGRAM_SHORT]`
Example: `Medical Shadowing`
- `[TARGET_AUDIENCE]`
Example: `students age 13–18`
- `[BRAND_STYLE]`
Example: `premium healthcare education, trustworthy, aspirational, polished`
- `[BRAND_COLORS]`
Example: `deep navy, teal, white, soft cyan accents`
- `[LOGO_PLACEMENT]`
Example: `top right`, `top left`, `footer`

---

## B. Image placeholders

- `[PHOTO_TYPE]`
    
    Describes what kind of real activity image is used as the main visual.
    
    Example values:
    
    - `OR observation`
    - `hospital learning activity`
    - `lab demonstration`
    - `student using microscope`
    - `CPR training`
    - `group learning in hospital`
    - `real medical equipment exposure`
- `[HERO_IMAGE_ROLE]`
Example:`Use the real activity photo as the main hero image. Clean, crop, and enhance it for a premium ad while preserving authenticity.`
- `[SUPPORT_IMAGE_ROLE]`
Example:`Use the secondary photo as a smaller inset image or supporting tile, not equal in size to the hero image.`
- `[PHOTO_EDITING_STYLE]`
Example:
    - `clean and enhance`
    - `crop for better composition`
    - `reduce distractions`
    - `improve lighting`
    - `refine clarity`
    - `preserve realism`

---

## C. Text placeholders

- `[HEADLINE]`
Main title. Keep short.
- `[SUBHEADLINE]`
Supporting line under headline.
- `[HIGHLIGHT_1]`
- `[HIGHLIGHT_2]`
- `[HIGHLIGHT_3]`
- `[HIGHLIGHT_4]`
- `[HIGHLIGHT_5]`
- `[BADGE_TEXT]`
Example:
    - `Certificate Included`
    - `Ages 13–18`
    - `Limited Seats`
    - `Real Hospital Experience`
- `[CTA]`
Example:
    - `Apply Now`
    - `Register Today`
    - `Limited Seats`
    - `Join the Next Round`
    - `Scan to Apply`
- `[CONTACT_LINE]`
Example:`LINE OA: @460zcthc | 081-985-7217 | www.edlabexperience.com`

---

## D. Layout / design placeholders

- `[FORMAT]`
Example:
    - `1080x1350 4:5 portrait`
    - `1024x1024 1:1 square`
- `[TEXT_DENSITY]`
Example:
    - `minimal text`
    - `medium text`
    - `short headline plus 3 highlights`
- `[VISUAL_STYLE]`
Example:
    - `premium social media ad`
    - `luxury education campaign`
    - `clean modern hospital marketing`
    - `high-trust healthcare branding`
- `[MOOD]`
Example:
    - `aspirational`
    - `trustworthy`
    - `prestigious`
    - `future doctor journey`
    - `professional and warm`

---

# 3) Global Master Prompt Template

This is your main reusable template.

```
Create a [VISUAL_STYLE] social media advertisement for [BRAND_NAME] promoting [PROGRAM_NAME].

Reference handling:
Image A is the real activity photo. [HERO_IMAGE_ROLE]
Image B is the official logo of [BRAND_NAME]. Place it neatly in the [LOGO_PLACEMENT], preserving its recognizable shape and colors.
[OPTIONAL_IMAGE_C_LINE]

Visual direction:
Use a real-photo-based premium ad style, not a synthetic-looking poster. The result should feel authentic, polished, trustworthy, and aspirational. Preserve the reality of the hospital or learning environment while improving the image for advertising use.

Photo content:
The hero photo shows [PHOTO_TYPE].
Apply [PHOTO_EDITING_STYLE] while keeping the people, activity, and medical context believable and real.

Brand style:
[BRAND_STYLE]

Color palette:
[BRAND_COLORS]

Mood:
[MOOD]

Layout:
Create a clean, premium composition suitable for [FORMAT].
Use the activity photo as the main focus.
Keep typography elegant and easy to read.
Use [TEXT_DENSITY].
Allow room for headline, subheadline, highlights, badge, and CTA.
Avoid clutter and avoid a cheap flyer look.

Text to include:
Headline: "[HEADLINE]"
Subheadline: "[SUBHEADLINE]"
Highlight 1: "[HIGHLIGHT_1]"
Highlight 2: "[HIGHLIGHT_2]"
Highlight 3: "[HIGHLIGHT_3]"
[OPTIONAL_HIGHLIGHT_4]
[OPTIONAL_HIGHLIGHT_5]
Badge / callout: "[BADGE_TEXT]"
CTA: "[CTA]"
Footer contact: "[CONTACT_LINE]"

Design notes:
Use subtle healthcare-themed visual accents only if helpful, such as soft geometric overlays, clean dividers, or a small certificate badge.
Do not overcrowd the design.
Do not distort the logo.
Do not replace the real activity with fake imagery.
Keep the final ad premium, modern, and conversion-focused.
```

---

# 4) Optional helper lines for Image C

Use one of these only when you have a second supporting image.

### If using a supporting image:

```
Image C is a secondary real activity photo. Use it as a smaller supporting inset image, photo card, or secondary visual tile, while keeping Image A as the dominant hero image.
```

### If not using a supporting image:

Leave it out completely.

---

# 5) Prompt Variants by Ad Type

You can use the same master structure, but swap the intent.

---

## Variant A — Single Hero Premium Ad

Best for:

- one strong real photo
- clean premium look
- performance ad

```
Create a premium healthcare education social media ad for [BRAND_NAME] promoting [PROGRAM_NAME].

Image A is the real activity photo. Use it as the hero image. Clean, crop, and enhance it for a polished ad while preserving the authenticity of the activity and participants.
Image B is the official logo. Place it neatly in the [LOGO_PLACEMENT].

The hero photo shows [PHOTO_TYPE].

Style:
real-photo-based, premium, trustworthy, aspirational, clean modern design.

Colors:
[BRAND_COLORS]

Format:
[FORMAT]

Text:
"[HEADLINE]"
"[SUBHEADLINE]"
"[HIGHLIGHT_1]"
"[HIGHLIGHT_2]"
"[HIGHLIGHT_3]"
"[BADGE_TEXT]"
"[CTA]"
"[CONTACT_LINE]"

Keep the design minimal, elegant, and not crowded.
```

---

## Variant B — Hero Photo + Supporting Inset

Best for:

- showing 2 aspects of the program
- keeping one main focus plus one extra proof point

```
Create a premium branded social media ad for [BRAND_NAME] promoting [PROGRAM_NAME].

Image A is the hero real activity photo. Use it as the main visual and enhance it for a polished premium advertisement.
Image B is the official logo. Place it cleanly in the [LOGO_PLACEMENT].
Image C is a secondary real activity photo. Use it as a small inset image or supporting photo card.

The main activity focus is [PHOTO_TYPE].

Style:
high-trust healthcare education marketing, premium, aspirational, clean, modern.

Layout:
main hero photo dominant, smaller inset photo secondary, elegant text placement, clean CTA area.

Text:
"[HEADLINE]"
"[SUBHEADLINE]"
"[HIGHLIGHT_1]"
"[HIGHLIGHT_2]"
"[HIGHLIGHT_3]"
"[HIGHLIGHT_4]"
"[BADGE_TEXT]"
"[CTA]"
"[CONTACT_LINE]"
```

---

## Variant C — Minimal Luxury Ad

Best for:

- strongest premium look
- very little text
- sophisticated brand feel

```
Create a luxury-style educational healthcare ad for [BRAND_NAME] promoting [PROGRAM_NAME].

Image A is the real activity photo. Use it as a clean elegant hero image, with subtle enhancement, refined composition, and realistic detail.
Image B is the logo. Place it neatly in the [LOGO_PLACEMENT].

Style:
minimal luxury, premium medical education branding, clean typography, elegant spacing, documentary authenticity.

Colors:
[BRAND_COLORS]

Text:
"[HEADLINE]"
"[SUBHEADLINE]"
"[BADGE_TEXT]"
"[CTA]"

Keep text minimal. The visual should do most of the work.
```

---

## Variant D — Offer / Urgency Ad

Best for:

- conversion
- registration pushes
- limited-seat campaigns

```
Create a high-converting premium social media ad for [BRAND_NAME] promoting [PROGRAM_NAME].

Image A is the real activity photo and should be used as the hero image. Enhance it while preserving authenticity.
Image B is the logo and should appear clearly but not too large.

Use a premium but slightly more action-oriented layout.
The hero image shows [PHOTO_TYPE].

Text:
"[HEADLINE]"
"[SUBHEADLINE]"
"[HIGHLIGHT_1]"
"[HIGHLIGHT_2]"
"[HIGHLIGHT_3]"
"[BADGE_TEXT]"
"[CTA]"
"[CONTACT_LINE]"

Make the CTA and urgency visually clear, but keep the overall look premium and trustworthy.
```

---

## Variant E — Portfolio / Certificate Ad

Best for:

- parents
- portfolio angle
- older students preparing applications

```
Create a premium educational ad for [BRAND_NAME] promoting [PROGRAM_NAME].

Image A is the real activity photo. Use it as the hero visual and refine it for ad use.
Image B is the logo.
Optionally include a subtle certificate badge or portfolio-themed graphic element.

Style:
premium, aspirational, achievement-focused, trustworthy healthcare education branding.

Text:
"[HEADLINE]"
"[SUBHEADLINE]"
"[HIGHLIGHT_1]"
"[HIGHLIGHT_2]"
"[HIGHLIGHT_3]"
"[BADGE_TEXT]"
"[CTA]"
"[CONTACT_LINE]"

Make the design feel valuable, credible, and portfolio-worthy.
```

---

# 6) Text Placeholder Bank

Here’s a reusable bank you can swap in.

---

## Headline ideas `[HEADLINE]`

### Dream / aspiration

- `Dreaming of Becoming a Doctor?`
- `Start Your Medical Journey Here`
- `See Real Medicine in Action`
- `Step Into Real Hospital Experience`

### Premium / authority

- `MEDICAL SHADOWING PROGRAM`
- `Exclusive Medical Shadowing Experience`
- `Real Hospital Learning Experience`

### Portfolio / value

- `Build Your Medical Portfolio`
- `Real Experience for Future Medical Students`
- `Learn Beyond the Classroom`

### Urgency

- `Limited Seats Open Now`
- `Applications Now Open`
- `Join the Next Medical Shadowing Round`

---

## Subheadline ideas `[SUBHEADLINE]`

- `Observe real medical practice in a real hospital environment`
- `Explore hospital departments and discover the reality of medicine`
- `A premium learning experience for students interested in medicine`
- `Real exposure. Real learning. Real inspiration for future doctors.`

---

## Highlight ideas `[HIGHLIGHT_1..5]`

- `Observe real medical practice`
- `Explore OR, ICU, ER, OPD, and Lab`
- `Hands-on learning activities`
- `CPR Training included`
- `Certificate for Portfolio`
- `Designed for students age 13–18`
- `Learn from real hospital professionals`
- `See healthcare careers up close`

---

## Badge ideas `[BADGE_TEXT]`

- `Certificate Included`
- `Ages 13–18`
- `Real Hospital Experience`
- `Portfolio Ready`
- `Limited Seats`
- `Hands-On Learning`

---

## CTA ideas `[CTA]`

- `Apply Now`
- `Register Today`
- `Join the Next Round`
- `Scan to Apply`
- `Reserve Your Seat`
- `Learn More`

---

## Contact line `[CONTACT_LINE]`

You can keep one standard version:

- `LINE OA: @edlab | 081-985-7217 | www.edlabexperience.com`

Or a shorter one:

- `EdLab Experience | @edlab | edlabexperience.com`

---

# 7) Photo Type Bank `[PHOTO_TYPE]`

Use this to match the ad to the image.

- `students observing a surgical or procedure-related demonstration`
- `students learning in a real hospital activity setting`
- `students touring and learning in a medical laboratory`
- `a student using a microscope in a real lab setting`
- `students practicing CPR training`
- `students observing medical equipment and procedures`
- `a group of students learning from hospital staff`

---

# 8) Photo Editing Instruction Bank `[PHOTO_EDITING_STYLE]`

You can reuse these lines:

### General premium polish

- `clean and enhance the photo, improve lighting, refine clarity, and crop for a premium ad composition`
- `crop and reframe the image for social media use, reduce distractions, and improve focus on the learning activity`
- `preserve realism while making the photo polished, clear, and visually strong for advertising`

### If background is busy

- `reduce clutter and visually simplify distracting background details while preserving authenticity`

### If photo needs subject emphasis

- `make the main participants more visually prominent while keeping the environment believable`

---

# 9) Best-practice rules to include in prompts

These are very useful because they improve results.

Add lines like these:

- `Use the real photo authentically; do not replace it with a fake synthetic scene.`
- `Do not distort the logo.`
- `Do not overcrowd the design.`
- `Do not make it look like a cheap flyer.`
- `Keep typography premium, modern, and highly readable.`
- `Use short, high-impact text only.`
- `The final result should feel like a premium campaign ad, not an event collage.`

---

# 10) Suggested prompt assembly workflow

This is how you should build each prompt.

---

## Step 1 — choose the photo angle

Pick one:

- OR / procedure observation
- Lab
- Microscope
- CPR

---

## Step 2 — choose the ad objective

Pick one:

- aspiration
- portfolio
- urgency
- premium trust
- real experience

---

## Step 3 — choose the text amount

Pick one:

- minimal
- medium
- short headline + 3 highlights

---

## Step 4 — fill the placeholders

Swap:

- `[HEADLINE]`
- `[SUBHEADLINE]`
- `[HIGHLIGHT_1..3]`
- `[CTA]`

---

## Step 5 — keep it focused

Best result = **1 hero image + 1 clear message**

---

# 11) Example filled prompt using your Medical Shadowing campaign

Here is a fully filled example.

```
Create a premium healthcare education social media advertisement for EdLab Experience promoting Medical Shadowing Program.

Image A is the real activity photo. Use it as the hero image. Clean, crop, and enhance it for a polished ad while preserving the authenticity of the activity and participants.
Image B is the official EdLab Experience logo. Place it neatly in the top right, preserving its recognizable form and colors.

Visual direction:
Use a real-photo-based premium ad style, not a synthetic-looking poster. The result should feel authentic, polished, trustworthy, and aspirational. Preserve the reality of the medical learning environment while improving the image for advertising use.

Photo content:
The hero photo shows students observing a real hospital learning activity.
Apply clean and enhance the photo, improve lighting, refine clarity, and crop for a premium ad composition while keeping the people and medical context believable and real.

Brand style:
premium healthcare education, trustworthy, aspirational, polished commercial quality

Color palette:
deep navy, teal, white, soft cyan accents

Mood:
aspirational, professional, high-trust, future doctor journey

Layout:
Create a clean, premium composition suitable for 1080x1350 portrait.
Use the activity photo as the main focus.
Keep typography elegant and easy to read.
Use short headline plus 3 highlights.
Allow room for headline, subheadline, highlights, badge, and CTA.
Avoid clutter and avoid a cheap flyer look.

Text to include:
Headline: "MEDICAL SHADOWING PROGRAM"
Subheadline: "Step Into Real Hospital Experience"
Highlight 1: "Observe real medical practice"
Highlight 2: "Explore OR, ICU, ER, OPD, and Lab"
Highlight 3: "Certificate for Portfolio"
Badge / callout: "Ages 13–18"
CTA: "Apply Now"
Footer contact: "LINE OA: @460zcthc | 081-985-7217 | www.edlabexperience.com"

Design notes:
Use subtle healthcare-themed visual accents only if helpful, such as soft geometric overlays or clean dividers.
Do not overcrowd the design.
Do not distort the logo.
Do not replace the real activity with fake imagery.
Keep the final ad premium, modern, and conversion-focused.
```

---

# 12) Super-short reusable template

If you want a shorter copy-paste version:

```
Create a premium social media ad for [BRAND_NAME] promoting [PROGRAM_NAME].

Image A is the real activity photo. Use it as the hero image. Clean, crop, enhance, and recompose it for a polished ad while preserving authenticity.
Image B is the official logo. Place it neatly in the [LOGO_PLACEMENT].
[Optional: Image C is a supporting real activity photo used as a smaller inset image.]

Style:
[VISUAL_STYLE], real-photo-based, trustworthy, aspirational, premium, modern.

Photo:
The hero image shows [PHOTO_TYPE].
Apply [PHOTO_EDITING_STYLE].

Colors:
[BRAND_COLORS]

Mood:
[MOOD]

Format:
[FORMAT]

Text:
Headline: "[HEADLINE]"
Subheadline: "[SUBHEADLINE]"
Highlight 1: "[HIGHLIGHT_1]"
Highlight 2: "[HIGHLIGHT_2]"
Highlight 3: "[HIGHLIGHT_3]"
Badge: "[BADGE_TEXT]"
CTA: "[CTA]"
Footer: "[CONTACT_LINE]"

Important:
Keep the design clean and premium. Do not make it crowded. Do not distort the logo. Use the real photo authentically.
```

---

# 13) My recommendation for your campaign system

To keep everything consistent, build your ad prompts with this fixed structure:

### Fixed elements

- `[BRAND_NAME] = EdLab Experience`
- `[BRAND_COLORS] = #085d6e-Primary #81d2c7-Secondary #fa824c-Accent #e0e0e2-Background #ffffff-Text`
- `[LOGO_PLACEMENT] = top (right, middle, left)`
- `[CONTACT_LINE] = LINE OA: @edlab | 081-985-7217 | www.edlabexperience.com`

### Variable elements

- `[PHOTO_TYPE]`
- `[HEADLINE]`
- `[SUBHEADLINE]`
- `[HIGHLIGHT_1..3]`
- `[BADGE_TEXT]`
- `[CTA]`

That way all your ads feel like one branded campaign.