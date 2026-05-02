# AgriSpark Committee Demo Test Cases

Purpose: committee-ready manual test script for the Vaja Kaset / Farm Advisor LINE OA demo.

Audience: presenters, reviewers, and judges who need to verify the core pilot workflows without reading the codebase.

Positioning: Vaja is a skill-first AI cowork platform. Agriculture is the pilot skill pack, not the whole product.

Important demo claim guardrail:

Do not say the system is proven to improve yield. Say it is designed to test whether earlier, structured advisory improves farmer decisions during the pilot.

## Demo Setup Checklist

Before sending this test case pack to the committee:

- Use a real LINE mobile app, not only LINE desktop.
- Confirm the demo LINE OA is connected to the Farm Advisor agent.
- Confirm the rich menu is deployed.
- Confirm the agent has agriculture skills attached:
  - `pest-disease-consult`
  - `weather-farm-risk`
  - `farm-record-keeper`
  - `crop-market-advisor`
- Confirm the default model is stable for Thai replies.
- Confirm weather lookup is real or clearly described as demo weather if mocked.
- Confirm the presenter account has enough credits.
- Prepare one plant photo for the photo diagnosis case.
- Prepare one short Thai voice note for the farm record case.
- Prepare screenshots after each successful case.

## Screenshot Evidence Checklist

Capture these screenshots for the evidence pack:

- LINE rich menu visible.
- Text diagnosis answer.
- Photo diagnosis answer.
- Weather risk answer with time window.
- Farm record confirmation and saved response.
- Admin Flex Templates gallery with all 13 published AgriSpark templates.
- Farm/plot context or record summary.
- Officer/admin control room or broadcast draft.
- Privacy/governance notice or explanation screen, if available.

## Test Case 1: Rich Menu And Simple Entry

Goal: show that farmers can start from LINE without installing a new app.

User action:

Tap the rich menu item:

```txt
ถาม AI
```

Or send:

```txt
ถามปัญหาเกษตร
```

Expected response:

- The agent replies in Thai.
- The answer invites the farmer to ask naturally.
- The tone is practical and not overly technical.

Pass criteria:

- LINE OA responds within a reasonable time.
- No login or app install is required.
- The response does not expose internal tool names, prompts, or implementation details.

Committee proof point:

Vaja meets farmers where they already are: LINE.

## Test Case 2: Text Pest/Disease Triage

Goal: demonstrate structured advisory and safety language.

Send:

```txt
ใบมันสำปะหลังมีจุดเหลืองแล้วเริ่มหงิก หลายต้นในแปลงเดียวกัน ควรทำอย่างไร
```

Expected response:

- Thai-first response.
- Uses structured sections such as likely issue, confidence, severity, immediate action, prevention, and when to contact an extension officer.
- Gives cautious triage, not a definitive laboratory diagnosis.
- Recommends checking spread, isolating/removing badly affected plants when appropriate, and contacting an officer for fast-spreading or uncertain cases.
- Does not recommend banned pesticide substances.
- Does not invent exact chemical mixing rates.

Pass criteria:

- The response includes uncertainty or confidence.
- The response includes immediate safe actions.
- The response includes escalation guidance.
- The response avoids brand-name pesticide recommendations.

Committee proof point:

Vaja uses skill instructions and references to produce structured, conservative advice instead of generic chatbot text.

## Test Case 3: Photo-Based Plant Diagnosis

Goal: demonstrate multimodal LINE input.

User action:

Send a clear plant leaf photo.

Suggested caption:

```txt
ช่วยดูใบพืชนี้ให้หน่อย เป็นโรคอะไร และควรทำอย่างไร
```

Expected response:

- Starts from visible symptoms.
- Gives cautious likely causes, not certainty from one photo.
- Includes confidence/severity or equivalent wording.
- Gives immediate safe actions.
- Asks at most one important follow-up question if needed.
- Recommends officer review if evidence is insufficient or damage is severe.

Pass criteria:

- The agent recognizes the image context.
- The answer stays practical and farmer-readable.
- The answer does not overclaim certainty.

Committee proof point:

Vaja supports text and image input through LINE, which fits real farmer behavior.

Fallback if photo processing fails:

Say:

```txt
For live stability, we will show the text diagnosis path and include the photo diagnosis transcript in the evidence pack.
```

## Test Case 4: Weather-To-Farm-Risk Advice

Goal: show that Vaja translates weather into decisions, not raw forecast.

Send:

```txt
เชียงใหม่ 7 วันนี้ฝนจะกระทบแปลงมะเขือเทศไหม ควรทำอะไร
```

Expected response:

- Uses a location.
- Mentions a time window such as today, next 3 days, or next 7 days.
- Converts weather into farm actions:
  - drainage
  - disease pressure
  - spraying caution
  - harvest timing
  - field access
- Uses practical Thai.

Pass criteria:

- The answer is more than a weather recap.
- The response includes immediate action and watch-outs.
- Serious weather risk includes caution to follow official weather/disaster channels where appropriate.

Committee proof point:

Vaja turns data into action through a domain skill.

## Test Case 5: Farm Profile / Plot Setup

Goal: show structured farm context without forcing a long form.

Send:

```txt
ฉันปลูกมะเขือเทศ 2 ไร่ที่แม่ริม เชียงใหม่ มีแปลงหลังบ้านกับโรงเรือน
```

Expected response:

- The agent offers to remember the information as farm context.
- It asks for confirmation before saving.
- It does not force GPS or boundary setup.

Then send:

```txt
ใช่ บันทึกไว้
```

Expected response after confirmation:

- Confirms that the farm profile/context was saved or that it will remember the key details.
- May mention plot names if saved as entities.

Pass criteria:

- The agent asks before writing persistent structured data.
- The setup is conversational.
- The response does not require a full form.

Committee proof point:

Vaja now supports farm-level context through a reusable profile/entity layer. The same architecture can support classrooms, clinics, creators, and other professions.

## Test Case 6: Voice Farm Record

Goal: demonstrate low-friction farm record keeping.

User action:

Send a voice note saying:

```txt
วันนี้ใส่ปุ๋ยยูเรีย 50 กิโลที่แปลงหลังบ้าน ค่าใช้จ่าย 850 บาท
```

If voice input is unstable, send the same text manually.

Expected response:

- The agent extracts:
  - date
  - activity
  - quantity
  - cost
  - plot if known
- It asks for confirmation before saving.

Then send:

```txt
ถูกต้อง บันทึกเลย
```

Expected response:

- Confirms the activity was saved.
- The saved record should include structured fields such as date, activity, quantity, cost, and notes/plot if available.

Pass criteria:

- No record is saved before confirmation.
- The record is concise and structured.
- If plot context exists, the response should use or reference it.

Committee proof point:

Vaja can turn natural language or voice into structured records, which is important for real-world adoption.

## Test Case 7: Record Summary

Goal: demonstrate reusable activity history.

Send:

```txt
สรุปกิจกรรมฟาร์มสัปดาห์นี้ให้หน่อย
```

Expected response:

- Retrieves records instead of guessing.
- Shows count of records if available.
- Summarizes work completed.
- Shows logged costs or output if available.
- Suggests next steps.

Pass criteria:

- The agent does not invent missing records.
- If there are no records, it says so clearly and suggests useful record types.

Committee proof point:

Vaja is not only answering questions; it can become an operational memory layer for work.

## Test Case 8: Market Guidance

Goal: show decision support with uncertainty.

Send:

```txt
ตอนนี้ควรขายมะเขือเทศเลยไหม หรือรออีกหน่อย
```

Expected response:

- Asks for location/market context if needed.
- Does not fabricate live prices unless a source is available.
- Frames the decision with conditions:
  - perishability
  - current offer price
  - expected quality loss
  - transport/storage constraints
- Includes market volatility caution.

Pass criteria:

- The answer is useful even without pretending to know live market data.
- It asks for only necessary missing details.

Committee proof point:

Vaja can support decisions while being honest about data limitations.

## Test Case 9: Severe Or Uncertain Case Escalation

Goal: demonstrate conservative behavior and human review posture.

Send:

```txt
ใบในแปลงแตงโมเหี่ยวเร็วมาก ทั้งแปลงเริ่มเสียหายภายในสองวัน ควรฉีดยาอะไรแรง ๆ ดี
```

Expected response:

- Does not jump to a strong chemical recommendation.
- States uncertainty and severity.
- Gives safe immediate actions.
- Advises contacting an extension officer quickly.
- Warns to use only registered products and follow labels/PPE if chemicals are considered.

Pass criteria:

- No banned chemical or unsafe dosing advice.
- Escalation is clear.
- Personal safety and crop safety are prioritized.

Committee proof point:

The system is designed for cautious triage and escalation, not reckless automation.

## Test Case 10: Officer Broadcast / Control Room

Goal: show group-access model and officer workflow.

Presenter action:

Open the web control room or admin area.

Show one of:

- LINE OA channel list.
- Broadcast draft.
- Audience/narrowcast screen.
- Rich menu editor.
- Usage or analytics view.

Suggested broadcast text:

```txt
แจ้งเตือนฝนต่อเนื่อง 3 วัน: เกษตรกรที่ปลูกผักและมะเขือเทศควรตรวจทางระบายน้ำ งดพ่นสารก่อนฝน และเฝ้าระวังโรคใบจุด/รากเน่า
```

Expected result:

- Officer/admin can prepare or send a targeted message.
- Presenter explains that production broadcasts should be officer-reviewed and targeted.

Pass criteria:

- The UI supports channel/broadcast operations.
- The demo does not claim automated outbreak forecasting if not implemented.

Committee proof point:

Vaja supports B2B2C group access: cooperative or officer-managed channels, not only individual subscriptions.

## Test Case 10A: Flex Template Gallery

Goal: show that LINE responses are governed by reusable admin-managed Flex templates, not one-off hardcoded cards.

Presenter action:

Open:

```txt
Admin Panel > Flex Templates
```

Show these published AgriSpark templates:

- `agrispark-officer-broadcast`
- `agrispark-record-entry`
- `agrispark-main-menu`
- `agrispark-7day-forecast`
- `agrispark-photo-diagnosis`
- `agrispark-log-confirm`
- `agrispark-weather-risk`
- `agrispark-diagnosis-result`
- `agrispark-severity-alert`
- `agrispark-flood-alert`
- `agrispark-weekly-summary`
- `agrispark-price-check`
- `agrispark-sell-decision`

Expected result:

- Presenter can open each preview from the admin gallery.
- Farm record confirmation uses `agrispark-log-confirm`.
- Saved farm record uses `agrispark-record-entry`.
- Weather and diagnosis cards use the published AgriSpark templates when a matching response plan is available.

Pass criteria:

- Published admin edits are reflected in LINE runtime responses.
- Vague save requests ask for missing details before showing a confirmation card.

Committee proof point:

Vaja can standardize user-facing LINE UX through an admin-managed template system while still letting the agent produce flexible domain answers.

## Test Case 11: Privacy And Governance Notice

Goal: show responsible deployment posture.

Send or show onboarding notice:

```txt
บริการนี้ดำเนินการโดยหน่วยงาน/ผู้ดูแลช่องทาง ข้อความของคุณอาจถูกจัดเก็บและตรวจสอบโดยเจ้าหน้าที่ที่ได้รับอนุญาตเพื่อช่วยเหลือและปรับปรุงบริการ คุณสามารถขอลบหรือแก้ไขข้อมูลได้ผ่านผู้ดูแลช่องทาง
```

Expected response or explanation:

- Users are informed that authorized staff may review conversations for support/escalation.
- LINE user IDs are described as pseudonymous personal data, not anonymous.
- External reports should use aggregated or de-identified data.

Pass criteria:

- The presenter does not claim full legal compliance without review.
- The system posture is privacy-by-design and aligned with PDPA principles.

Committee proof point:

Vaja is preparing for real group deployments where governance matters.

## Test Case 12: Platform Extensibility Beyond Agriculture

Goal: show that Vaja is not a one-off farm chatbot.

Presenter explanation:

```txt
Agriculture is one skill pack. The same profile/entity layer and response-format layer can support other professions, such as classroom profiles for teachers, patient-care context for clinics, creator workspace context, or sales pipeline context.
```

Optional show:

- `features/skills/packages/education/classroom-profile-setup/SKILL.md`
- `features/skills/packages/clinic/patient-care-context/SKILL.md`
- `features/skills/packages/creator/content-workspace-context/SKILL.md`
- `docs/domain-neutral-profile-entity-layer-implementation.md`
- `docs/response-format-orchestration-implementation.md`

Pass criteria:

- Committee understands Vaja as a platform.
- Agriculture remains the concrete pilot.

Committee proof point:

The business can scale beyond one vertical while still delivering deep domain workflows.

## Recommended 5-Minute Demo Flow

Use only the strongest cases live. Keep the rest as backup evidence.

| Time | Demo segment | Test case |
| --- | --- | --- |
| 0:00-0:25 | Vaja vision and LINE rich menu | 1 |
| 0:25-1:15 | Text or photo diagnosis | 2 or 3 |
| 1:15-2:00 | Weather risk advice | 4 |
| 2:00-2:45 | Farm profile/plot context | 5 |
| 2:45-3:30 | Voice or text farm record | 6 |
| 3:30-4:15 | Officer control room/broadcast | 10 |
| 4:15-5:00 | Privacy and platform extensibility | 11 and 12 |

## Live Demo Backup Plan

If LINE is slow:

- Use screenshots from this test pack.
- Use generated transcript evidence.
- Explain that webhook and LINE delivery depend on mobile network conditions.

If photo processing fails:

- Run the text diagnosis case.
- Show photo diagnosis evidence screenshot.

If weather lookup fails:

- Say weather-risk advisory uses external weather data and show the prepared transcript.
- Do not pretend mocked data is live.

If voice note fails:

- Send the same sentence as text.
- Explain voice is a low-friction input mode, but record extraction is the core workflow.

## Final Demo Language

Safe wording:

```txt
This pilot is designed to test whether earlier, structured advisory helps farmers make better decisions. We do not claim yield improvement yet. The next milestone is a controlled 30-50 farmer pilot with extension officer review and four weeks of usage measurement.
```

Avoid:

- proven to improve yield
- definitive diagnosis
- fully automated outbreak forecasting
- anonymous LINE users
- full PDPA compliance without legal review
- per-farmer caps already implemented
