# AgriSpark 5-Minute Pitch Plan

Purpose: one rehearsal-ready plan for slides, speech, live demo, and fallback evidence.

Positioning: Vaja AI is a skill-first AI cowork platform. Vaja: Kaset is the agriculture pilot delivered through LINE OA and an agricultural skill pack.

## Current App Audit

Verified on current workspace:

- TypeScript check passed: `pnpm exec tsc --noEmit`.
- Focused tests passed: 45/45 across weather, LINE intent routing, Flex template linking, response formatting, domain profiles, record schema, and agent run helpers.
- Real weather is implemented with Open-Meteo in `lib/tools/weather.ts`.
- LINE text, photo, and voice paths are wired into the canonical agent run path through `features/line-oa/webhook/events/message.ts` and `media-handlers.ts`.
- AgriSpark Flex templates exist and are mapped for diagnosis, weather risk, record confirmation, record entry, weekly summary, and officer broadcast.
- Generated demo evidence exists, but committee-ready screenshot evidence is still incomplete.

Demo readiness:

- Code readiness: good enough for internal rehearsal.
- Live committee readiness: not yet, until the real LINE channel/rich menu is confirmed on phone and screenshot backup is captured.

Highest-risk live items:

1. Real LINE OA channel and rich menu deployment.
2. Photo diagnosis output stability.
3. Voice note stability on mobile network.
4. Screenshot backup for all six core scenarios.
5. Avoiding claims of proven yield improvement or fully automated outbreak forecasting.

## Slide Plan

### Slide 1 - The Advisory Gap

Visual: one farmer on LINE, one overwhelmed extension officer, simple ratio callout.

Message: Thai farmers make urgent crop decisions every week, but expert help cannot reach everyone in time.

Say:

> Small farmers do not need another complicated app. They need timely advice in the channel they already use. In Thailand, that channel is LINE. Vaja: Kaset gives farmers a first layer of structured advisory, while extension officers stay in the loop for severe or uncertain cases.

### Slide 2 - The Solution

Visual: LINE OA chat on left, Vaja AI platform on right.

Message: AI Farm Advisor on LINE, powered by agricultural skills.

Say:

> Vaja AI is a skill-first AI cowork platform. For AgriSpark, we package agriculture as four skills: pest and disease triage, weather-to-farm-risk advice, market decision support, and farm record keeping. The farmer just chats naturally, sends a photo, or sends a voice note.

### Slide 3 - Why It Is Different

Visual: table with three columns: LINE, Skills, Officer Control.

Message: not just Gemini directly; Vaja adds channel, domain knowledge, workflow, and governance.

Say:

> A general model can answer questions, but Vaja adds the missing operating layer: LINE delivery, skill activation, structured response cards, reusable knowledge packs, group credit access, and officer oversight. Agriculture is not hardcoded into the app. Experts can update the skill pack without rebuilding the platform.

### Slide 4 - Demo: Farmer Flow

Visual: show live phone screen or screenshots.

Message: photo or text diagnosis, weather risk, voice/text farm record.

Say:

> Let me show the farmer experience. No login, no new app, no menu maze. The farmer asks in LINE, and Vaja turns the message into practical, cautious farm advice.

### Slide 5 - Demo: Officer Flow

Visual: web control room, Flex templates, broadcast draft.

Message: extension officers can monitor and broadcast reviewed alerts.

Say:

> This is not replacing extension officers. It helps them scale. Routine questions are handled by AI, while officers can review conversations, spot repeated issues, and send a broadcast alert to the whole farmer group when needed.

### Slide 6 - Pilot Plan And Ask

Visual: 30-50 farmer pilot timeline.

Message: platform works; next milestone is validation with farmers and officers.

Say:

> We are honest about the stage. The platform and LINE workflow are operational, but agricultural advice must be validated. Our next step is a 30-50 farmer pilot with extension officer review, measuring usability, response safety, and whether earlier advisory improves farmer decisions.

## 5-Minute Speech Script

### 0:00-0:30 - Hook

> A tomato farmer sees brown spots on leaves at 7 in the morning. If the advice comes two days late, the disease may already spread. Today, many farmers rely on neighbors, shops, or guesswork because extension officers cannot answer everyone instantly. Vaja: Kaset gives that farmer a first, structured answer inside LINE.

### 0:30-1:05 - Solution

> Vaja AI is a skill-first AI cowork platform. For AgriSpark, we use the same platform with an agricultural skill pack. Farmers can type Thai, send a plant photo, or send a voice note. The system detects the task and loads the right skill: pest and disease, weather risk, market decision, or farm records.

### 1:05-2:45 - Live Farmer Demo

Do:

1. Open LINE rich menu.
2. Send prepared pest/disease text or photo.
3. Show structured diagnosis: likely issue, confidence, severity, immediate action, prevention, contact officer.
4. Send weather risk prompt.
5. Send farm record text, or voice if stable.

Say while demoing:

> Notice the response is not just a long chatbot answer. It is structured for decision-making. It states uncertainty, gives safe immediate actions, and tells the farmer when to contact an officer. For weather, it translates forecast into farm action. For records, the farmer can speak naturally and Vaja turns it into a structured log.

### 2:45-3:45 - Officer Demo

Do:

1. Show LINE OA control room.
2. Show Flex template gallery or broadcast panel.
3. Show a prepared officer broadcast draft.

Say:

> Extension officers and cooperative admins use the web control room. They can review conversations, manage structured LINE response templates, and send officer-reviewed alerts. Our first version uses human-reviewed broadcasts. Automated outbreak detection is a roadmap feature, not a claim for today.

### 3:45-4:30 - Technical Differentiation

> The technical core is the Contextual Skills Engine. The model sees a catalog of available skills, activates the relevant skill, and receives skill instructions plus reference files. This lets Vaja be broader than one farm chatbot while still giving domain-specific answers. The same platform can later support teachers, clinics, creators, or cooperatives with their own validated skills.

### 4:30-5:00 - Close

> Our claim is not that Vaja already improves yield. Our claim is that we have a working platform ready for a controlled farmer pilot. With AgriSpark support, we will validate the skill pack with extension officers, run a 30-50 farmer pilot, and measure safety, usefulness, and decision impact. The goal is simple: expert-like first help, in Thai, on LINE, at group-access cost.

## Live Demo Order

Use only the strongest live path. Keep photo and voice as backup if the phone/network is unstable.

1. LINE rich menu: prove no new app.
2. Text diagnosis: safest live path.
3. Weather risk: proves real data to decision translation.
4. Farm record: use text first; voice only if already tested on the demo phone.
5. Officer control room: show broadcast or Flex templates.
6. Close with pilot plan.

Recommended live prompts are in `docs/contest/agrispark-committee-demo-test-cases.md`.

## Backup Plan

If LINE is slow:

- Use screenshots and generated transcript evidence.
- Say: "The live LINE webhook depends on mobile network conditions, so I will show the captured run from the same workflow."

If photo diagnosis fails:

- Switch to text diagnosis.
- Say: "For stability, I will show the text diagnosis live and include the photo transcript in the evidence pack."

If weather fails:

- Do not pretend mock data is live.
- Say: "The weather-risk feature uses external weather data; I will show the prepared transcript from the same flow."

If voice fails:

- Send the same sentence as text.
- Say: "The core workflow is natural-language record extraction; voice is the low-friction input mode."

## Claims To Use

- "Ready for controlled pilot."
- "Structured advisory and triage."
- "Officer-reviewed alerts today; automated outbreak detection is roadmap."
- "Designed to test decision improvement."
- "Skill pack is ready for demo and expert-reviewed pilot, not final production agronomy."

## Claims To Avoid

- "Proven to improve yield."
- "Definitive diagnosis from one photo."
- "Fully automated outbreak forecasting."
- "Anonymous LINE users."
- "Full PDPA compliance without legal review."
- "Per-farmer LINE caps are already production-grade."

## Final Rehearsal Checklist

- Confirm demo LINE OA is connected to Farm Advisor.
- Confirm rich menu is deployed on a real phone.
- Confirm the four agriculture skills are attached.
- Confirm weather reply uses real forecast data.
- Confirm text diagnosis returns the required headings.
- Confirm record flow does not save before confirmation unless intentionally configured.
- Capture screenshots for diagnosis, weather, record, templates, and broadcast.
- Keep generated evidence open as backup.
