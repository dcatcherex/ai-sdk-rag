# EdLab Ads Skill — User Guide

How to install, set up, and use the `edlab-ads` skill to create social media ads efficiently.

---

## Install the skill

1. Go to **Settings → Skills**
2. Click **Import Skill**
3. Paste the path:
   ```
   D:\vscode2\nextjs\ai-sdk\documents\edlab\skills\edlab-ads
   ```
4. Click **Import**
5. The skill `edlab-ads` will appear in your skill list

---

## One-time setup (do this before first use)

This setup determines how well the AI picks photos and logos automatically. Spend 15–20 minutes here — you only do it once.

---

### Step 1 — Upload logo variants (Brand Settings → Assets)

Upload each logo version with a clear title so the AI knows which one to use in which context.

| Upload | Set Kind to | Set Title to |
|--------|-------------|-------------|
| Teal logo on white background | Logo | `EdLab Logo — Dark (use on light backgrounds)` |
| White logo (transparent/white) | Logo | `EdLab Logo — White (use on dark/teal backgrounds)` |
| Icon only (no text, square) | Logo | `EdLab Logo — Icon compact` |

> The platform appends the **first logo** to every image generation automatically. Upload the most versatile version first (typically the dark teal version).

---

### Step 2 — Upload and tag brand photos (Brand Settings → Photos)

This is the most important setup step. The AI uses tags to pick the right photo for each ad angle.

**Tag taxonomy — use these exact tag names:**

| Tag | When to use |
|-----|-------------|
| `group` | Any photo showing a group of students together |
| `or` | Students observing in the operating room or procedure area |
| `cpr` | CPR training session |
| `lab` | Medical lab or microscope activity |
| `er` | Emergency room or ambulance learning |
| `hands-on` | Close-up of students doing something hands-on |
| `microscope` | Student using microscope specifically |
| `round-latest` | **Update this tag** on your most recent round's photos — replace old `round-latest` tags before each new round |

**Photo quality checklist before uploading:**
- [ ] Faces clearly visible (students look engaged, not distracted)
- [ ] Hospital/medical environment obvious in the frame
- [ ] Good natural lighting — no harsh shadows or overexposure
- [ ] No blurry or motion-blurred shots
- [ ] At least 1080px wide (portrait preferred: 1080×1350 or taller)
- [ ] Minimum 3–4 photos per activity type for variety

**Recommended minimum photo library:**

| Activity | Min photos | Tags |
|----------|-----------|------|
| OR observation / procedure | 4–6 | `or`, `group` |
| CPR training | 3–4 | `cpr`, `hands-on` |
| Lab / microscope | 2–3 | `lab`, `microscope` |
| Group learning shots | 4–6 | `group` |
| Latest round (any activity) | 3–5 | `round-latest` |

---

### Step 3 — Attach skill to the Marketing AI agent

1. Go to **Settings → AI Coworkers** (or Agents)
2. Open the **Marketing AI** agent
3. Under **Skills**, find `edlab-ads` and enable it
4. Save

---

## Day-to-day workflow

Once set up, this is the full flow for creating a post.

---

### Typical session (5–7 minutes)

```
1. Open chat with Marketing AI agent
2. Type: "สร้าง social post"
3. AI picks 2 content sets and calls get_brand_photos automatically
4. You see: ตัวเลือก A + B — each with headline, highlights, badge, CTA, and photo preview
5. Reply: "A" (or "B" or with edits)
6. AI starts image generation automatically and returns the Thai caption
7. Wait for the generated image to appear in chat
8. Copy caption → paste into Facebook/Instagram
```

---

### What you can say to trigger the skill

Minimal (AI picks everything):
- `สร้าง social post`
- `social post`
- `สร้างโพสต์`
- `โพสต์ใหม่`

With context (AI adapts its picks):
- `สร้าง social post urgency ที่นั่งใกล้เต็ม`
- `สร้างโพสต์ สำหรับรอบ กันยายน วันที่ 20`
- `social post โฟกัส portfolio และ certificate`
- `สร้าง ad รูปน้องๆ ทำ CPR`
- `social post สำหรับผู้ปกครอง`

---

### Editing options after the AI presents choices

You can mix and match — accept most of option A but change one thing:

| What you want to change | What to say |
|------------------------|------------|
| Different headline | `A แต่เปลี่ยน headline เป็น "…"` |
| Add date + location | `A ใส่วันที่ 20 กันยายน โรงพยาบาลนวมินทร์ 9` |
| More highlights | `A แต่เพิ่ม highlight เรื่อง ER และรถพยาบาล` |
| Different photo | `A แต่ใช้รูป CPR แทน` |
| Different format | `A แต่ทำเป็น square 1:1` |
| See more options | `ขอดูแนวทางอื่นอีก` |

---

### Two-photo layout (Variant B)

When you have 2 activity photos (e.g. OR + CPR):

```
สร้าง social post มีรูปน้องๆ ใน OR กับรูป CPR สองรูป
```

The AI will:
- Show Option A: OR as hero, CPR as inset
- Show Option B: CPR as hero, OR as inset
- You pick which arrangement looks better

---

## For best image generation results

After confirming a content set, the AI should call image generation automatically. Tips for getting the best output:

**Before running the image prompt:**
- Attach the activity photo you want as Image A (drag into chat or the image tool)
- The logo is attached automatically by the platform — don't add it manually

**In the image generation tool:**
- Use `quality: high` for social media posts that will be published
- Use `quality: medium` for quick previews/drafts
- Format: `1080×1350` for Feed, `1080×1920` for Stories, `1080×1080` for square

**If the logo placement is off:**
Ask the AI to regenerate with this instruction:
*"Place the last reference image as the brand logo in the top-right corner. Size it to roughly 10–12% of image width. Do not distort or stretch it."*

**If the text is hard to read:**
Ask the AI to regenerate with this instruction:
*"Use high contrast text with a semi-transparent overlay behind the text area. Thai characters must be clearly legible at mobile screen size."*

---

## Updating for a new round

Before launching content for a new program round:

1. **Upload new round photos** with tag `round-latest`
2. **Remove `round-latest` tag from old photos** (or replace with `round-sep-2025` etc. to archive)
3. If the hospital or dates changed, update the contact line in the skill's SKILL.md

---

## File locations

| File | Path |
|------|------|
| Skill definition | `documents/edlab/skills/edlab-ads/SKILL.md` |
| Caption examples | `documents/edlab/skills/edlab-ads/references/caption-examples.md` |
| Prompt guide | `documents/edlab/edlab prompt guide.md` |
| This guide | `documents/edlab/edlab-ads-user-guide.md` |
