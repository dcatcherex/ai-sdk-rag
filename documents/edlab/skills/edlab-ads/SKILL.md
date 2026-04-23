---
name: edlab-ads
description: Creates social media ad image prompts and Thai Facebook/Instagram captions for EdLab Experience. Use this skill whenever someone asks to create a post, social post, advertisement, Facebook post, IG post, banner, or any promotional content for EdLab Experience — including short requests like "สร้าง social post", "social post", "สร้างโพสต์", "สร้าง ad", or "โพสต์ใหม่". Also activate when the user provides an activity photo and wants to turn it into an ad.
---

# EdLab Experience — Social Ad Creator

## Fixed Brand Identity (never ask for these)

| Field | Value |
|-------|-------|
| Brand | EdLab Experience |
| Colors | `#085d6e` teal · `#81d2c7` cyan · `#fa824c` orange · white |
| Logo | top-right corner, do not distort — **automatically included as reference image by the platform** |
| Image footer | `LINE OA: @edlab \| 081-985-7217 \| www.edlabexperience.com` |
| Caption contact | see contact block below |
| Audience | Students aged 13–18 interested in medicine |

## Using Brand Photos and Logo

### Photos — call `get_brand_photos` with the right tag

When the user has not attached a photo, call `get_brand_photos` before presenting options. Each content set maps to a primary tag and a fallback:

| Set | Primary tag | Fallback tag |
|-----|-------------|--------------|
| 1 — Aspiration | `group` | *(no tag — balanced sample)* |
| 2 — Portfolio | `group` | `or` |
| 3 — Urgency | `round-latest` | *(no tag)* |
| 4 — Why Choose | `group` | `cpr` |
| 5 — Real Experience | `or` | `group` |
| 6 — CPR | `cpr` | `hands-on` |
| 7 — Premium | `or` | `group` |
| 8 — Parents | `group` | *(no tag)* |
| 9 — Announcement | `round-latest` | `group` |
| 10 — Lab | `lab` | `microscope` |

**Calling convention** (follows the system-level photo fallback chain):
1. Normal single-photo post: call `get_brand_photos(tags: [primary_tag], limit: 1)`
2. If empty → retry `get_brand_photos(limit: 1)` with no tags
3. Only when the concept truly needs 2 real photos: call `get_brand_photos(tags: [primary_tag, secondary_tag], limit: 2)` or make two separate `limit: 1` calls
4. If still empty → proceed without photo reference (text-to-image)

Important:
- `get_brand_photos` returns activity photos in `photos`
- When a brand is active, `get_brand_photos` may also append the official logo as the last item in `imageUrls`
- Treat `photos` as activity-photo choices, and treat `imageUrls` as the full reference list for generation
- The tool default is now `limit: 1`, but you should still set `limit` explicitly for EdLab posts
- For most EdLab ads, use exactly 1 activity photo
- Use 2 activity photos only when the user explicitly wants a two-photo composition or the concept clearly benefits from hero + inset
- Never pass 3 activity photos into the EdLab ad layout flow

When 2 content sets are selected, fetch photos for both tags in a single call only if you also set `limit: 2`, then match each photo to its set. Show which photo would be used in each option.

If the returned photos have empty `tags`, treat them as generic fallback photos and prefer a single-photo layout unless the user explicitly wants two-photo storytelling.

### Logo — passed automatically as the last reference image

The platform appends the brand logo URL to `imageUrls` automatically when a brand is active. You do not need to call any tool to fetch it.

Important reference order rules:
- If there is 1 activity photo, the model receives 2 images total: `Image A = activity photo`, `Image B = logo`
- If there are 2 activity photos, the model receives 3 images total: `Image A = hero activity photo`, `Image B = secondary activity photo`, `Image C = logo`
- Never describe the logo as `Image B` when two activity photos are present
- Always describe the logo as the last reference image

In the image generation prompt, include one of these exact patterns:

If there is only 1 activity photo:
```
Image B is the official EdLab Experience logo (last reference image). Place it neatly in the top-right corner, preserving its recognizable shape, colors, and proportions. Do not distort it.
```

If there are 2 activity photos:
```
Image B is a secondary real activity photo. Use it as a smaller inset image or supporting photo card, not equal in size to the hero image.
Image C is the official EdLab Experience logo (last reference image). Place it neatly in the top-right corner, preserving its recognizable shape, colors, and proportions. Do not distort it.
```

The logo renders cleanly as a top-right brand mark — it does not distort the composition when instructed this way.

---

## Workflow

**Step 1 — Pick 2 content sets and present them**

When the user sends a minimal request ("สร้าง social post", "social post", "โพสต์ใหม่"), do not ask them to fill blanks. Instead:

1. **Read context clues** in the user's message (photo described? date? urgency? CPR? portfolio? parents?).
2. **Pick 2 sets using the Pool Selection Rules below** — always one set from Pool A and one from Pool B, chosen based on context.
3. Present them as **ตัวเลือก A** and **ตัวเลือก B**.
4. **If 2 photos are mentioned**, add a per-option photo layout note showing which photo would be hero and which would be inset — and swap the roles between A and B so the user sees both arrangements.
5. Ask: **"เลือก A หรือ B? หรืออยากแก้ไขอะไรบ้าง เช่น headline, highlight, หรือใส่วันที่?"**

Do NOT generate the image prompt or caption yet — wait for the user to confirm.

---

## Pool Selection Rules

The 10 sets are grouped into 4 pools. **Always pick one set from Pool A (emotion/hook) and one from Pool B (value/action).** Never pick two sets from the same pool.

| Pool | Sets | Theme | When to weight heavily |
|------|------|-------|----------------------|
| **Emotion** | 1, 5, 9 | Aspiration, real experience, new round | No strong context clues; general posts |
| **Value** | 2, 7, 10 | Portfolio, premium, lab/science | User mentions certificate, portfolio, parents, lab |
| **Action** | 3, 4, 6 | Urgency, why-choose, CPR/hands-on | User mentions urgency, ที่นั่งใกล้เต็ม, registration, CPR photos |
| **Audience** | 8 | Parents-focused | User mentions parents, ผู้ปกครอง, family |

**Context → Pool pairing guide:**

| Context clue | Pool A pick | Pool B pick |
|-------------|-------------|-------------|
| No clues at all | Rotate through Emotion (1→5→9→1…) | Rotate through Action (3→4→6→3…) |
| Urgency / limited seats | Set 3 (Urgency) | Set 5 or 9 (Real experience / Announcement) |
| Portfolio / certificate | Set 2 (Portfolio) | Set 1 or 7 (Aspiration / Premium) |
| CPR photo available | Set 6 (CPR+Hands-on) | Set 3 or 4 (Urgency / Why-choose) |
| 2 photos available | Set that highlights both activities | Set with different photo-as-hero arrangement |
| Parents keyword | Set 8 (Parents) | Set 2 (Portfolio) |
| Lab photo | Set 10 (Lab) | Set 7 (Premium) |
| New round announcement | Set 9 (Announcement) | Set 3 (Urgency) |

**Rotation rule for "no clues" case:** To avoid always defaulting to Set 1 + Set 3, treat each new conversation as a fresh pick. Consider what angles haven't been shown recently. When genuinely free to choose, prefer sets 4, 5, 6, 7, 8, 9, 10 — they're underused compared to 1 and 3.

**Step 2 — Refine (if needed)**

The user may:
- Say "A" → proceed with set A as-is
- Say "B แต่เปลี่ยน headline เป็น…" → apply the edit
- Say "A แต่ใส่วันที่ 20 กันยายน" → inject date into caption

Accept partial edits naturally — if they only say "A", treat everything else as confirmed.

**Step 3 — Generate the image and return the caption**

Once confirmed, produce:
1. Build the full image generation prompt internally from the chosen set
2. Call `generate_image` with that final prompt instead of printing the prompt into chat
3. Return the Thai Facebook/Instagram caption in chat
4. Return only a short user-facing status message about the image generation, not the raw prompt

Important:
- Do **not** display the full image prompt in the assistant message unless the user explicitly asks to see it
- Do **not** print raw reference image URLs in chat
- Prefer actually calling `generate_image` over handing the user a prompt to copy
- If the tool call fails, briefly explain the failure and then offer the fallback prompt only if needed

---

## Presenting the 2 Options

Use this format when presenting options:

```
นี่คือ 2 แนวทางสำหรับโพสต์นี้ 👇

**ตัวเลือก A — [ANGLE_LABEL]**
📌 Headline: [HEADLINE_TH]
📝 Subheadline: [SUBHEADLINE_TH]
✅ [HIGHLIGHT_1_TH]
✅ [HIGHLIGHT_2_TH]
✅ [HIGHLIGHT_3_TH]
🏷 Badge: [BADGE_TH] · CTA: [CTA_TH]
[IF 2 photos: 📷 Layout: [PHOTO_A] เป็น hero หลัก / [PHOTO_B] เป็น inset เล็ก]

---

**ตัวเลือก B — [ANGLE_LABEL]**
📌 Headline: [HEADLINE_TH]
📝 Subheadline: [SUBHEADLINE_TH]
✅ [HIGHLIGHT_1_TH]
✅ [HIGHLIGHT_2_TH]
✅ [HIGHLIGHT_3_TH]
🏷 Badge: [BADGE_TH] · CTA: [CTA_TH]
[IF 2 photos: 📷 Layout: [PHOTO_B] เป็น hero หลัก / [PHOTO_A] เป็น inset เล็ก ← สลับจาก A]

---
เลือก A หรือ B? หรืออยากแก้ไขอะไรบ้างไหม? 🎨
```

When 2 photos are provided, the `📷 Layout` line lets the user see both photo arrangements before deciding — swap hero/inset between A and B so each option gives a different visual lead.

---

## Ready-to-Use Content Bank (10 Sets)

Pick 2 from these. Mix angles. Each set is complete and ready to use — no blanks.

---

**Set 1 — อยากเป็นหมอ (Aspiration)**
- Headline: `อยากเป็นหมอ…แต่ยังไม่รู้ว่าชีวิตหมอจริงเป็นอย่างไร?`
- Subheadline: `เปิดประสบการณ์จริงในโรงพยาบาล กับ Medical Shadowing Program`
- Highlight 1: `ตามรอยแพทย์จริงในวอร์ด โดยวิทยากรจากโรงพยาบาล`
- Highlight 2: `เจาะลึก OR, ICU, OPD, ER, Nursery`
- Highlight 3: `รับ Certificate จากโรงพยาบาล เสริม Portfolio`
- Badge: `Ages 13–18`
- CTA: `สมัครเลย ที่นั่งมีจำนวนจำกัด`

---

**Set 2 — Portfolio / Certificate**
- Headline: `เสริม Portfolio สมัครคณะแพทย์ ด้วยประสบการณ์จริง`
- Subheadline: `รับ Certificate ออกโดยโรงพยาบาล ใช้เป็นหลักฐานประสบการณ์ทางการแพทย์`
- Highlight 1: `Certificate ออกโดยโรงพยาบาลจริง`
- Highlight 2: `ตามรอยแพทย์และเข้าวอร์ดจริง`
- Highlight 3: `เหมาะสำหรับน้องที่เตรียมสมัครคณะแพทย์`
- Highlight 4 (optional): `เจาะลึก OR, ICU, OPD, ER, Nursery`
- Badge: `Certificate Included`
- CTA: `Apply Now`

---

**Set 3 — ที่นั่งใกล้เต็ม (Urgency)**
- Headline: `ที่นั่งใกล้เต็มแล้ว! Medical Shadowing รอบใหม่`
- Subheadline: `โอกาสสุดท้ายสำหรับรอบนี้ สมัครก่อนที่นั่งหมด`
- Highlight 1: `ที่นั่งจำกัด เปิดรับสมัครแล้ววันนี้`
- Highlight 2: `ตามรอยแพทย์จริงในโรงพยาบาล`
- Highlight 3: `รับ Certificate สำหรับ Portfolio`
- Badge: `Limited Seats`
- CTA: `สมัครด่วน!`

---

**Set 4 — ทำไมต้องเลือก (Why Choose)**
- Headline: `ทำไมต้องเลือกค่ายหมอ Medical Shadowing?`
- Subheadline: `ค่ายนี้คือโอกาสทอง สำหรับน้องที่ฝันอยากเป็นหมอ ✨`
- Highlight 1: `เรียนรู้จากวิทยากรโรงพยาบาลจริง ไม่ใช่แค่ห้องเรียน`
- Highlight 2: `ฝึก CPR Training กับผู้เชี่ยวชาญ`
- Highlight 3: `รับ Certificate เก็บเข้า Portfolio`
- Badge: `Real Hospital Experience`
- CTA: `สมัครเลย`

---

**Set 5 — ประสบการณ์จริง (Real Experience)**
- Headline: `เปิดประสบการณ์จริง สู่ฝันอาชีพแพทย์`
- Subheadline: `ตามติดชีวิตหมอจริงในโรงพยาบาล ประสบการณ์ที่ห้องเรียนให้ไม่ได้`
- Highlight 1: `ตามรอยการทำงานในวอร์ดจริง ทุกขั้นตอน`
- Highlight 2: `เรียนรู้ แผนก ER & รถพยาบาลจริง`
- Highlight 3: `ได้ประสบการณ์ที่ไม่มีใครสอนในห้องเรียน`
- Badge: `Real Hospital Experience`
- CTA: `Join the Next Round`

---

**Set 6 — CPR + Hands-On**
- Headline: `ฝึก CPR จริง เรียนรู้ในโรงพยาบาลจริง`
- Subheadline: `ประสบการณ์ hands-on ที่น้องๆ จะไม่ลืม`
- Highlight 1: `ฝึก CPR Training กับผู้เชี่ยวชาญจากโรงพยาบาล`
- Highlight 2: `เจาะลึก OR, ICU, OPD, ER, Nursery`
- Highlight 3: `รับ Certificate จากโรงพยาบาล เก็บเข้าพอร์ต`
- Badge: `Hands-On Learning`
- CTA: `สมัครเลย`

---

**Set 7 — Premium / Exclusive**
- Headline: `MEDICAL SHADOWING PROGRAM`
- Subheadline: `Exclusive Real Hospital Experience สำหรับน้องที่มุ่งมั่นสู่อาชีพแพทย์`
- Highlight 1: `ตามรอยแพทย์จริง โดยวิทยากรจากโรงพยาบาล`
- Highlight 2: `เจาะลึกทุกวอร์ดสำคัญ OR, ICU, OPD, ER`
- Highlight 3: `Certificate เสริม Portfolio สมัครคณะแพทย์`
- Badge: `Ages 13–18`
- CTA: `Reserve Your Seat`

---

**Set 8 — สำหรับผู้ปกครอง (Parents Audience)**
- Headline: `เตรียมความพร้อมลูกสู่อาชีพแพทย์ อย่างถูกทาง`
- Subheadline: `ประสบการณ์จริงในโรงพยาบาล + Certificate สำหรับ Portfolio ของลูก`
- Highlight 1: `วิทยากรจากโรงพยาบาลคอยดูแลตลอดกิจกรรม`
- Highlight 2: `เจาะลึกทุกแผนกสำคัญ ปลอดภัย เรียนรู้ในสภาพแวดล้อมจริง`
- Highlight 3: `Certificate ออกโดยโรงพยาบาล ใช้ได้จริงใน Portfolio`
- Highlight 4 (optional): `เหมาะสำหรับน้องอายุ 13–18 ปี ที่สนใจเส้นทางแพทย์`
- Badge: `Portfolio Ready`
- CTA: `สอบถามเพิ่มเติม`

---

**Set 9 — ประกาศรอบใหม่ (New Round Announcement)**
- Headline: `ค่ายหมอ Medical Shadowing มาแล้ว! 🩻`
- Subheadline: `น้องๆ อายุ 13–18 ปี ที่ฝันอยากเป็นหมอ มาลองตามติดชีวิตจริงของหมอกัน`
- Highlight 1: `ตามรอยแพทย์จริง โดยวิทยากรจากโรงพยาบาลนวมินทร์ 9`
- Highlight 2: `เจาะลึก OR, ICU, OPD, ER, Nursery ฯลฯ`
- Highlight 3: `รับ Certificate เก็บเข้า Portfolio`
- Badge: `Ages 13–18`
- CTA: `สมัครเลย`

---

**Set 10 — Lab / วิทยาศาสตร์การแพทย์**
- Headline: `สำรวจโลกการแพทย์จริง ตั้งแต่วอร์ดถึงห้อง Lab`
- Subheadline: `เรียนรู้วิทยาศาสตร์การแพทย์จากผู้เชี่ยวชาญในโรงพยาบาลจริง`
- Highlight 1: `เรียนรู้ในห้อง Lab และ Medical Laboratory จริง`
- Highlight 2: `ตามรอยแพทย์และนักวิทย์การแพทย์ในทุกวอร์ด`
- Highlight 3: `รับ Certificate สำหรับ Portfolio สมัครคณะแพทย์`
- Badge: `Real Hospital Experience`
- CTA: `สมัครเลย`

---

## Image Generation Prompt Template

Use this template to assemble the final prompt **internally** before calling `generate_image`. Do not paste this filled prompt into the normal user-facing reply unless the user explicitly asks for the prompt text.

Fill this template after the user confirms a set. All `[BRACKETS]` must be replaced — zero brackets in the final output.

```
Create a [VISUAL_STYLE] social media advertisement for EdLab Experience promoting Medical Shadowing Program.

Reference handling:
Image A is the real activity photo. Use it as the hero image. Clean, crop, and enhance it for a premium ad while preserving the authenticity of the activity and participants.
[ONLY IF no second photo is provided: Image B is the official EdLab Experience logo (last reference image). Place it neatly in the top-right corner, preserving its recognizable shape, colors, and proportions. Do not distort it.]
[ONLY IF second photo is provided: Image B is a secondary real activity photo. Use it as a smaller inset image or supporting photo card, not equal in size to the hero image.]
[ONLY IF second photo is provided: Image C is the official EdLab Experience logo (last reference image). Place it neatly in the top-right corner, preserving its recognizable shape, colors, and proportions. Do not distort it.]

Visual direction:
Use a real-photo-based premium ad style, not a synthetic-looking poster. The result should feel authentic, polished, trustworthy, and aspirational. Preserve the reality of the medical learning environment while improving the image for advertising use.

Photo content:
The hero photo shows [PHOTO_TYPE — infer from context, default: "students learning in a real hospital activity setting"].
Clean and enhance the photo, improve lighting, refine clarity, and crop for a premium ad composition while keeping the people and medical context believable and real.

Brand style:
Premium healthcare education, trustworthy, aspirational, polished commercial quality.

Color palette:
Deep teal (#085d6e), soft cyan (#81d2c7), warm orange accent (#fa824c), white, light grey.

Mood:
[aspirational / urgency / prestigious / professional — match the chosen set's angle]

Layout:
Create a clean, premium composition suitable for [FORMAT — default: 1080x1350 portrait (4:5)].
Use the activity photo as the main focus.
Keep typography elegant and easy to read.
Use short headline plus [2 or 3] highlights.
Allow room for headline, subheadline, highlights, badge, and CTA.
Avoid clutter and avoid a cheap flyer look.

Text to include:
Headline: "[HEADLINE from chosen set]"
Subheadline: "[SUBHEADLINE from chosen set]"
Highlight 1: "[HIGHLIGHT_1]"
Highlight 2: "[HIGHLIGHT_2]"
Highlight 3: "[HIGHLIGHT_3]"
[ONLY IF set includes it: Highlight 4: "[HIGHLIGHT_4]"]
Badge / callout: "[BADGE]"
CTA: "[CTA]"
Footer contact: "LINE OA: @edlab | 081-985-7217 | www.edlabexperience.com"

Design notes:
Use subtle healthcare-themed visual accents only if helpful (soft geometric overlays, clean dividers, small certificate badge).
Do not overcrowd the design.
Treat the logo only as a brand mark reference to place cleanly in the corner. Do not redesign it, reinterpret it, or generate a new logo.
Do not distort the logo.
Do not replace the real activity with fake imagery.
Keep the final ad premium, modern, and conversion-focused.
```

---

## Thai Caption Template

Write a Thai caption based on the chosen set's text. Always include the full contact block.

**Structure:**
1. Opening hook (emoji + headline or question, 1 line)
2. Program/experience description (1–2 lines)
3. Bullet highlights — use 🔹 or ✅ (match the chosen set's highlights)
4. Date/location line — 🗓 🏥 (only if user provided it)
5. CTA line
6. **Contact block** (always verbatim):
```
Contact us
💬 Line: @460zcthc (https://line.me/R/ti/p/@460zcthc)
📞 081-985-7217
🌐 https://www.edlabexperience.com
📌 Facebook/IG/TikTok/YouTube: Edlab Experience
```
7. Hashtags: `#EdlabExperience #MedicalShadowing #ค่ายหมอ #ค่ายตามรอยหมอจริง #dek68 #dek69 #dek70`

See `references/caption-examples.md` for tone reference.

---

## Tool Call Rules (after user confirms)

After the user confirms A/B or confirms edits:

1. Assemble the complete image prompt from the chosen set
2. Call `generate_image`
3. Use `taskHint: "social_post"` when generating a new branded ad
4. Use `taskHint: "edit"` when real activity photos are being passed in `imageUrls`
5. Use `aspectRatio: "4:5"` by default unless the user requested another format
6. Include the chosen real activity photo(s) in `imageUrls` when available
7. If a brand is active and the platform supports it, rely on the platform to append the logo as the last reference image
8. Do not echo the raw prompt, JSON payload, or image URLs back to the user

## Output Format (after user confirms)

---
### 📝 Facebook/Instagram Caption
*(Thai, ready to post)*

---

### Image Status
Write one short line such as:
`กำลังสร้างภาพโฆษณาให้แล้ว เดี๋ยวภาพจะขึ้นในแชตนี้ค่ะ`

If the user explicitly asks for the prompt text, then you may additionally provide:

---
### 🖼 Image Generation Prompt
*(complete, zero brackets)*

---
