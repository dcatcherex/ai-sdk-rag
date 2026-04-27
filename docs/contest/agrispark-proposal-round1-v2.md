# AgriSpark 2.0 — Round 1 Proposal Submission (v2)
**AI for Smarter Farmer Advisory**

---

## 2.1 Explain how your proposal fits the challenge(s)

### a) How did you come up with your idea?

The idea emerged from building **Vaja AI** — a general-purpose AI cowork platform for Thai users. While developing the platform, a pattern became clear: every professional group faces the same core problem with AI tools — generic AI doesn't know their domain, speaks in formal language they don't use, and requires them to install yet another app.

This problem is most acute for Thai smallholder farmers. A farmer asking ChatGPT about tomato leaf blight gets a generic, English-biased answer. It doesn't know which fungicides are available at their local shop, doesn't understand the humidity patterns in Northern Thailand in April, and can't factor in current market prices at their regional market.

The gap became undeniable when researching agricultural extension services: **Thailand has approximately 1 agricultural extension officer for every 200+ farmers** in many provinces. These officers are overwhelmed — and farmers are making high-stakes decisions alone every day.

We realized that the Contextual Skills Engine already built into Vaja AI could solve exactly this: load specialized agricultural knowledge into the AI, deliver it through LINE OA (which farmers already use daily), and make it affordable through shared credit pools for farmer groups. No new app. No training required. Just chat in Thai.

---

### b) Define your target users

**Primary users: Thai smallholder farmers**
- Rice, cassava, sugarcane, tomato, and longan growers in Central and Northern Thailand
- Typically own 2–15 rai of farmland
- Use LINE daily; minimal smartphone proficiency beyond messaging
- Make 5–10 high-stakes farm decisions per week with limited access to expert advice

**Secondary users: Agricultural extension officers**
- Use the web-based control room to monitor farmer conversations, spot recurring issues, and assist on complex cases
- Benefit by having AI handle routine advisory (pest ID, basic weather risk) so they can focus on field visits and complex problems

**Potential B2B channel: Farmer cooperatives**
- Can purchase shared credit pools for their members
- One group administrator manages the account; all cooperative members benefit

---

### c) Key decisions your solution supports

| Decision Category | Specific Decisions Supported |
|---|---|
| **Crop management** | Pest & disease diagnosis from photo or description; treatment selection; prevention planning |
| **Risk mitigation** | Weather-based planting/harvesting timing; flood and drought risk alerts; proactive broadcast alerts |
| **Market decisions** | Market price context; sell-now vs. hold guidance; price trend awareness |
| **Farm records** | Activity logging via conversation or voice note; cost and income summaries |

---

### d) Current challenges of the target group

**1. Advisory gap at scale**
One extension officer cannot give timely, personalized advice to 200+ farmers simultaneously. Farmers default to guesswork, neighbor advice, or expensive agrochemical salesman recommendations.

**2. Generic AI is not useful for Thai agriculture**
ChatGPT, Claude, and Gemini have no knowledge of:
- Thai crop varieties and regional planting calendars
- Pesticides and fertilizers available in Thai local markets
- Thai agricultural climate zones and seasonal risk patterns
- Regional market price dynamics (e.g., Chiang Mai longan vs. Bangkok wholesale)

**3. App adoption barrier**
Rural Thai farmers are heavy LINE users but rarely install new apps. Every additional app install loses a large portion of potential users. Solutions that require a new app, account registration, or technical onboarding fail to reach the farmers who need them most.

**4. Cost barrier for individuals**
AI subscriptions ($15–20/month) are unaffordable for smallholder farmers with seasonal income. A model where a farmer group shares costs is far more realistic than individual subscriptions.

**5. Language and literacy**
Thai farmers communicate in informal, regional Thai. Some farmers have lower literacy and prefer speaking over typing. Solutions that require formal Thai commands, English prompts, or structured text inputs create friction that breaks adoption.

---

### e) Present your solution

**Solution: Vaja — AI Farm Advisor on LINE OA, powered by Vaja AI**

Vaja AI is an AI cowork platform with a **Contextual Skills Engine** — a system that loads specialized domain knowledge into an AI automatically, based on what the user is communicating. We have packaged this engine with an **Agricultural Skill Pack** (4 specialized skills) and delivered it through LINE OA — the messaging platform Thai farmers already use daily.

**How the farmer experiences it:**
A farmer can interact with Vaja: Kaset in whatever way is natural for them — type a question in informal Thai, **send a photo** of a sick plant for visual diagnosis, or **send a voice note** if typing is inconvenient. The system detects what topic they're raising and automatically loads the right domain knowledge into the AI. The farmer receives a structured, Thai-language response — formatted as a visual card in LINE, with follow-up suggestion chips they can tap — as if they had a farming expert in their pocket, available 24/7.

When a regional outbreak or weather risk emerges, extension officers can proactively **broadcast alerts** to all farmers on the channel at once.

**The 4 Agricultural Skills:**

| Skill | What it does | Triggered by |
|---|---|---|
| `pest-disease-consult` | Visual or text-based diagnosis: identify disease/pest from photo or description, severity, immediate action, prevention | Photo of sick plant, or keywords: โรค, แมลง, ใบเหลือง, เน่า, จุด, etc. |
| `weather-farm-risk` | Real-time weather → farm risk interpretation: planting/harvesting timing, flood/drought alerts | Keywords: ฝน, แล้ง, อากาศ, ปลูก, เก็บเกี่ยว, etc. |
| `crop-market-advisor` | Market price context + sell/hold guidance for major Thai crops | Keywords: ราคา, ขาย, ตลาด, กิโล, บาท, etc. |
| `farm-record-keeper` | Activity logging via text or voice; cost/income summaries on request | Keywords: บันทึก, ใส่ปุ๋ย, รด, ปลูก, เก็บ, ขาย, etc. — or voice note |

**What differentiates Vaja: Kaset from other solutions:**

| Differentiator | Other AI tools | Vaja: Kaset (Vaja AI) |
|---|---|---|
| No new app required | ❌ Need to install | ✅ Works in LINE OA farmers already use |
| Photo-based disease diagnosis | ❌ Text only | ✅ Send a photo → visual AI diagnosis |
| Voice note input | ❌ Text only | ✅ Speak in Thai → transcribed + AI responds |
| Voice reply from AI | ❌ Text only | ✅ AI replies with both text and Thai voice audio |
| Thai agricultural domain knowledge | ❌ Generic only | ✅ Skill-specific, locally relevant knowledge |
| Natural informal Thai | ❌ Formal/English-biased | ✅ Informal Thai, regional dialect-tolerant |
| Group cost sharing | ❌ Individual subscription | ✅ Cooperative credit pools |
| Extension officer oversight | ❌ None | ✅ Web control room + broadcast alerts |
| Proactive farmer alerts | ❌ Reactive only | ✅ Officer broadcasts outbreak/weather alerts |
| Expandable expertise | ❌ Fixed feature set | ✅ New skills = new domain expertise |

---

## 2.2 AI & Technical Approach

### a) How AI is used

**Type of AI:** Large Language Models (LLMs) + Vision Models + Speech AI, orchestrated by a proprietary domain knowledge injection layer (Contextual Skills Engine)

**Primary model:** Google Gemini 2.5 Flash — selected for superior Thai language quality, multimodal capability (text + vision + audio), and cost efficiency for high-volume agricultural advisory. The platform also supports 20+ models including GPT-4o, Claude, and others.

**The Contextual Skills Engine + Multimodal Pipeline:**

```
Farmer interacts via LINE (text / photo / voice note / video)
        ↓
LINE webhook → Vaja AI platform receives message
        ↓
Input type routing:
  ├─ Photo    → Vision model analyzes image → extracted description
  ├─ Voice    → Gemini Speech-to-Text → Thai transcript
  ├─ Video    → Preview frame extracted → Vision model → description
  └─ Text     → direct
        ↓
Skills Engine activates (using combined text + extracted description):
  ├─ Keyword match: "โรค" / disease symptoms in photo → pest-disease-consult
  ├─ Keyword match: "ฝน" → weather-farm-risk
  └─ LLM scoring: model rates skill relevance → top skills auto-activate
        ↓
Agricultural domain knowledge injected into AI context (3 tiers):
  Tier 1: Skill catalog — LLM sees all available skills
  Tier 2: Active skill instructions — structured diagnostic workflow, Thai crop knowledge
  Tier 3: Resource files — Thai crop disease database, local pesticide guide
        ↓
LLM generates Thai-language response with domain expertise
        ↓
Response formatted and delivered:
  ├─ Flex bubble card (structured visual layout for diagnoses)
  ├─ Quick reply chips (3 follow-up suggestions the farmer can tap)
  └─ Voice reply (Thai TTS audio sent via push message, fire-and-forget)
        ↓
Conversation + metrics logged → Extension officer reviews via web control room
```

**What problem does AI solve specifically?**

| AI Capability | Problem Solved |
|---|---|
| Vision model on plant photos | Farmer doesn't need to know disease names — just photograph the symptom |
| Thai speech-to-text | Eliminates typing barrier for low-literacy or field-condition use |
| Thai TTS voice reply | Farmer can listen to advice while working in the field, hands free |
| LLM with Skills Engine | Generic AI + agricultural domain knowledge = locally accurate recommendations |
| Contextual skill activation | No menus to navigate — AI automatically detects what help is needed |

**Value added compared to non-AI applications:**
- A non-AI chatbot with fixed decision trees cannot handle the combinatorial complexity of crop × disease × weather × severity × product availability
- A fixed FAQ system cannot ask follow-up questions, analyze photos, or adapt to how farmers describe problems in informal Thai
- The LLM handles the conversation naturally; the Skills Engine ensures the knowledge is locally relevant and accurate; the multimodal pipeline removes literacy and typing barriers entirely

---

### b) Data inputs

| Data Source | Type | Usage |
|---|---|---|
| Farmer's text messages | Real-time user input | Questions, symptom descriptions, activity logs |
| Farmer's photos | Real-time image input | Visual disease/pest diagnosis via vision model |
| Farmer's voice notes | Real-time audio input | Transcribed to Thai text → processed as text query |
| Farmer's video clips | Real-time video input | Preview frame extracted → visual analysis |
| Weather API | Real-time external data | Current conditions + 7-day forecast for farmer's region |
| Agricultural knowledge base (SKILL.md + reference files) | Curated domain knowledge | Thai crop diseases, regional conditions, local pesticide/fertilizer market |
| Conversation history | Session memory | Multi-turn diagnosis; follow-up questions in the same session |
| LINE OA rich menu selection | User intent signal | Tap a button → pre-activates the relevant skill |

---

### c) Output

Farmers receive responses delivered directly in their LINE chat:

**For pest & disease consultations (text or photo input):**
- Visual diagnosis card (Flex bubble): Disease name in Thai + scientific name, severity badge (low/medium/high), immediate actions, prevention advice
- Quick reply chips: "ดูวิธีผสมยา", "ถามเรื่องโรคอื่น", "บันทึกการรักษา"
- Voice reply: Thai audio summary of key actions (farmer can listen while working)
- Referral note for complex cases requiring field visit

**For weather & farm risk:**
- Risk level card: current risk (drought/flood/heat), recommended farm action, 7-day outlook translated into farm decisions
- Quick reply chips: "ดูพยากรณ์รายวัน", "วางแผนการปลูก", "แจ้งเพื่อนบ้าน"

**For market decisions:**
- Price context and trend summary
- Practical guidance framed as information, not financial advice

**For farm records:**
- Confirmation of logged activity (date, crop, input, cost/income)
- Weekly/monthly summary on request — delivered as structured Flex card

**Proactive outputs (extension officer-initiated):**
- **Broadcast alerts**: Officer pushes a regional pest outbreak warning or weather alert to all farmers on the channel at once — they receive it as a LINE push notification

**For extension officers (web control room):**
- Conversation logs per LINE user, searchable by topic
- Analytics: daily message volume, unique farmers, top issue categories
- Ability to intervene in ongoing conversations

---

### d) Development stage

**Prototype / MVP — TRL 5–6**

The core platform (Vaja AI) is fully operational:

| Component | Status |
|---|---|
| Multi-model AI (20+ models: Gemini, GPT-4o, Claude) | ✅ Operational |
| Contextual Skills Engine (create, trigger, inject domain skills) | ✅ Operational |
| LINE OA webhook integration | ✅ Operational |
| Photo input → vision model diagnosis | ✅ Operational |
| Voice note input → Thai speech-to-text | ✅ Operational |
| AI voice reply (Thai TTS) | ✅ Operational |
| Flex bubble + quick reply formatting | ✅ Operational |
| Rich menu with skill shortcut buttons | ✅ Operational |
| Proactive broadcast to all channel followers | ✅ Operational |
| Web control room (conversation logs, analytics) | ✅ Operational |
| Credit system with cooperative group sharing | ✅ Operational |
| Agricultural skill pack content | 🔄 Being finalized with Thai crop disease database |

The system is deployable. The remaining work is agricultural knowledge content refinement and a pilot with an actual farmer group.

---

### e) Incorporation of target group (Prototype Track)

Per the AgriSpark 2.0 organizers' clarification, formal target group incorporation is planned for the **mentoring phase available to semi-finalist teams**, where 1:1 consultation sessions will be used to gather farmer and extension officer feedback and refine the proposal before Round 2 submission.

For Round 1, the solution design has been informed by:
- Documented research on the Thai agricultural extension system (officer-to-farmer ratios, advisory gaps)
- Feedback from small business owners and solopreneurs using the Vaja AI platform in its current form, who validated the zero-app-install and credit-sharing model
- Review of the types of questions Thai farmers commonly ask (pest/disease, weather, price) as the basis for the 4 skill categories and multimodal input design (voice + photo address the literacy and field-use barriers identified in rural technology adoption research)

---

## 2.3 Practical Implementation

### a) User interaction

**Farmers:** Access the solution entirely through **LINE** — the messaging app most Thai farmers already use daily.

1. Follow the "Vaja: Kaset เกษตร" LINE Official Account (QR code distributed by cooperative or extension officer)
2. A rich menu at the bottom of chat shows shortcut buttons:
   - "ถามโรคพืช/แมลง" → pre-activates pest-disease skill
   - "เช็คอากาศ" → pre-activates weather-risk skill
   - "บันทึกฟาร์ม" → pre-activates farm-record skill
3. Farmer interacts by:
   - **Typing** in natural, informal Thai
   - **Sending a photo** of a sick plant, field condition, or payment slip
   - **Sending a voice note** — speaks naturally; AI transcribes and responds with text + voice audio
4. Response arrives as a formatted card with tappable follow-up suggestion chips

**No app download. No account registration. No commands to learn. Works with photo, voice, or text.**

**Extension officers:** Access a web-based control room (any browser) to:
- Monitor all farmer conversations in real time
- View analytics (top issues, active users, geographic spread)
- Send proactive broadcast alerts to all channel followers

---

### b) Infrastructure requirements

**For farmers:**
- Any smartphone (Android or iOS) with LINE installed — no special phone required
- Basic mobile internet (LINE messages and voice notes work on 3G/4G)
- No additional devices, sensors, IoT hardware, or accessories required

**For extension officers (control room):**
- Any device with a web browser and internet connection

**Platform infrastructure:**
- Cloud-hosted (Next.js + serverless Postgres) — no on-site servers
- LINE webhook for real-time message handling
- Weather API for real-time forecast data
- Cloud storage (Cloudflare R2) for voice reply audio files
- All infrastructure scales automatically with user growth

---

### c) Ease of use

**For farmers — zero technical requirements:**
- Just use LINE as normal — no new accounts, no commands, no training
- Works with typing, voice notes, or photos — whatever is natural
- System adapts to however the farmer phrases their question — no fixed format required
- Voice reply means farmers can receive advice without reading — useful in the field
- Rich menu shortcuts mean even first-time users know what the bot can do

**Accessibility spectrum:**
| Farmer profile | How they use Vaja: Kaset |
|---|---|
| Comfortable with typing | Types question in informal Thai |
| Prefers speaking | Sends voice note — AI transcribes + responds with voice |
| Lower literacy | Taps rich menu button + sends photo of the problem |
| Tech-unfamiliar | Follows QR code → one button tap → gets help |

---

## 2.4 Economic Value

### 1. Who benefits financially?

| Beneficiary | Financial benefit |
|---|---|
| **Smallholder farmers** | Reduced crop losses from earlier disease detection; better market timing; avoid incorrect pesticide spend from misdiagnosis |
| **Farmer cooperatives** | Shared cost across members reduces per-farmer expense to a fraction of individual AI subscriptions |
| **Agricultural extension officers** | Increased capacity: AI handles routine advisory (common pests, weather questions), officers focus on field visits with higher impact per hour |
| **Agricultural value chain** | Improved input purchasing decisions, reduced post-harvest losses from better timing, data on what problems farmers face regionally |

---

### 2. How is value created?

**Increased yields:** Photo-based early disease detection catches problems before they spread. Timely weather-based decisions (harvest before rain, delay planting during drought) protect yield.

**Reduced costs:** Correct AI diagnosis from a plant photo reduces unnecessary or incorrect pesticide use — a significant hidden cost for smallholders who rely on agrochemical salesman advice. Market information reduces selling at the worst possible time.

**Risk reduction:** Weather risk interpretation translates forecasts into direct farm actions. Broadcast alerts from extension officers give advance warning of regional outbreaks — previously impossible to scale.

**Time savings:** 24/7 availability via voice or photo removes the dependency on office hours. Extension officers save hours answering repeated common questions — redirecting their expertise to complex cases.

**Knowledge transfer at scale:** One validated agricultural skill pack can serve thousands of farmers simultaneously. An extension officer's expertise, encoded once, becomes infinitely scalable.

---

### 3. Business model

**Credit-based model with cooperative sharing:**

| Pack | Credits | Price (THB) | Per-farmer cost (50-member group) |
|---|---|---|---|
| Starter | 100 | 99 ฿ | — |
| Standard | 500 | 399 ฿ | ~8 ฿ / member |
| Pro | 2,000 | 1,299 ฿ | ~26 ฿ / member |
| Cooperative | 5,000 | 2,999 ฿ | ~60 ฿ / member |

**The cooperative model:** A farmer group or cooperative buys one credit pool. The group administrator manages the account; all members benefit. Per-farmer cost becomes affordable even for subsistence farmers.

**B2B2C channel:** Agricultural cooperatives, agri-input companies, or NGOs (e.g., GETHAC partners) can sponsor credit pools for farmer groups as part of outreach programs — distributing AI access at no cost to individual farmers.

**Long-term:** A **Skills Marketplace** where agricultural universities, GETHAC, and extension offices publish verified, peer-reviewed agricultural skill packs. Domain experts contribute knowledge; the platform scales distribution. This creates a sustainable, community-maintained agricultural AI knowledge ecosystem.

---

## 2.5 Introduce yourself or the team

### Team members

| Field | Details |
|---|---|
| **Name** | [YOUR NAME] |
| **Age** | [YOUR AGE] |
| **Educational background** | [YOUR EDUCATION] |
| **Occupation / Role** | [YOUR OCCUPATION] — Sole developer and product designer of Vaja AI |

*Note: This is a solo submission. All platform development, product design, and agricultural skill research has been conducted by one person.*

### Vision-Mission Statement

**Vision:**
Every Thai farmer has access to an AI farm advisor — in their own language, on the app they already use, at a cost they can afford, available day and night.

**Mission:**
To build a skill-first AI platform that transforms domain expertise into accessible, affordable AI coworkers — starting with Thai agriculture, expanding to any profession that needs AI to truly understand their work.

---

## 2.6 Additional Material

### System Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                        VAJA AI PLATFORM                           │
│                                                                  │
│  ┌─────────────────────────┐   ┌──────────────────────────────┐  │
│  │   Agricultural Skills    │   │     AI Farm Agent            │  │
│  │                         │   │                              │  │
│  │  pest-disease-consult ──┼──▶│  Gemini 2.5 Flash            │  │
│  │  weather-farm-risk    ──┼──▶│  Vision + Text + TTS         │  │
│  │  crop-market-advisor  ──┼──▶│                              │  │
│  │  farm-record-keeper   ──┼──▶│  Skills Engine injects       │  │
│  │                         │   │  domain knowledge            │  │
│  └─────────────────────────┘   └──────────────┬───────────────┘  │
│                                               │                   │
│  ┌────────────────────────────────────────────▼─────────────────┐ │
│  │                    Multimodal I/O Layer                       │ │
│  │                                                              │ │
│  │  Photo → Vision AI → Diagnosis                               │ │
│  │  Voice → Speech-to-Text → Thai Transcript                    │ │
│  │  Text  → Direct                                              │ │
│  │  Response → Flex Card + Quick Replies + Voice Audio Reply    │ │
│  └────────────────────────────────────────────┬─────────────────┘ │
│                                               │                   │
│  ┌────────────────────────────────────────────▼─────────────────┐ │
│  │                      Channel Layer                            │ │
│  │                                                              │ │
│  │   LINE OA (farmer front door)    Web App (officer control)   │ │
│  │   • Chat (text/photo/voice)      • Conversation logs         │ │
│  │   • Rich menu shortcuts          • Analytics dashboard       │ │
│  │   • Flex bubble responses        • Broadcast alerts          │ │
│  │   • Quick reply chips            • Credit management         │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │               Cooperative Credit System                       │ │
│  │   Group buys once → all members use → per-farmer cost        │ │
│  │   as low as 8 ฿/member/month for a 50-person cooperative     │ │
│  └──────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

---

### Full Demo Scenario

**Persona:** สมชาย, tomato farmer in Chiang Mai. Older farmer, not a fast typist but comfortable with LINE voice notes and photos.

---

**Scene 1 — Photo-based disease diagnosis**

```
[สมชาย notices yellow-brown spots on his tomato leaves at 7am]
[He opens LINE, taps the rich menu button "ถามโรคพืช/แมลง"]
[He takes a photo of the affected leaves and sends it]

━━━ สมชาย sends photo ━━━
📷 [photo of tomato leaf with brown spots and yellow halo]

━━━ Vaja: Kaset responds (Flex bubble card) ━━━
🌿 ผลการวิเคราะห์ใบพืช
────────────────────────────
โรค:   ใบไหม้ (Early Blight)
       Alternaria solani
────────────────────────────
ความรุนแรง: ⚠️ ปานกลาง-สูง
             (พบที่ใบล่าง กำลังลามขึ้น)
────────────────────────────
สิ่งที่ทำทันที:
• ตัดใบที่เป็นโรคออก ทิ้งนอกแปลง
• ฉีดสารป้องกันเชื้อรา:
  แมนโคเซบ หรือ คลอโรทาโลนิล
• ลดการให้น้ำตอนเย็น
────────────────────────────
ป้องกันปีถัดไป: หมุนเวียนพืช 2 ปี

[Quick reply chips below the card]
[💊 วิธีผสมยา] [📷 ส่งรูปอีกใบ] [📝 บันทึกการรักษา]

━━━ Voice reply (push message, Thai TTS) ━━━
🔊 "สมชายครับ ใบมะเขือเทศเป็นโรคใบไหม้ครับ
    ให้ตัดใบที่เป็นออกก่อน แล้วฉีดแมนโคเซบครับ"
```

---

**Scene 2 — Voice note for farm records (hands-free, in the field)**

```
[After treating the plants, สมชาย records it by voice while walking back]

━━━ สมชาย sends voice note ━━━
🎤 [15-second voice note in Thai]
   "วันนี้ฉีดแมนโคเซบในแปลงมะเขือเทศ 2 ไร่
    ใช้ยาไป 200 กรัม ราคา 80 บาท"

━━━ Vaja: Kaset responds ━━━
✅ บันทึกแล้วครับ

📋 กิจกรรมฟาร์ม — 8 เมษายน 2569
━━━━━━━━━━━━━━━━━━━━━━━━
แปลง:    มะเขือเทศ (2 ไร่)
กิจกรรม: ฉีดสารป้องกันเชื้อรา
ปัจจัย:  แมนโคเซบ 200 กรัม
ค่าใช้จ่าย: 80 บาท
━━━━━━━━━━━━━━━━━━━━━━━━

[Quick reply chips]
[📊 สรุปค่าใช้จ่ายเดือนนี้] [📝 บันทึกรายการอื่น]
```

---

**Scene 3 — Weather risk check before harvest**

```
━━━ สมชาย types ━━━
"สัปดาห์หน้าจะเก็บเกี่ยวได้ไหม ดูท่าว่าฝนจะมา"

━━━ Vaja: Kaset (weather-farm-risk skill activates) ━━━
🌤️ รายงานความเสี่ยงสภาพอากาศ — เชียงใหม่
━━━━━━━━━━━━━━━━━━━━━━━━━━━
วันที่ 9–10 เม.ย:  ☀️ ดี — เก็บเกี่ยวได้
วันที่ 11–12 เม.ย: 🌧️ เสี่ยง — ฝนฟ้าคะนอง
วันที่ 13–15 เม.ย: 🌧️🌧️ สูง — ฝนหนัก

⚡ คำแนะนำ:
เก็บเกี่ยวในวันที่ 9–10 จะดีที่สุดครับ
หากรอถึงวันที่ 11 มีความเสี่ยงผลเสียหายจากฝน
━━━━━━━━━━━━━━━━━━━━━━━━━━━

[Quick reply chips]
[📅 ดูพยากรณ์เต็ม] [🌾 วางแผนการขาย] [⛈️ เตือนเพื่อนบ้าน]
```

---

**Scene 4 — Extension officer broadcasts a regional alert**

```
[Extension officer sees a spike in pest reports across the region]
[Opens web control room → Broadcast → compose message]

━━━ Extension officer sends broadcast ━━━
[Pushes to all 340 farmers following the channel]

📢 แจ้งเตือนจากเจ้าหน้าที่เกษตร
━━━━━━━━━━━━━━━━━━━━━━━━
ขณะนี้พบการระบาดของ หนอนกระทู้ผัก
ในพื้นที่แม่ริม และสันกำแพง

กรุณาตรวจสอบแปลงของท่าน
และแชทถามรุจใจได้เลยครับ

[Quick reply chips sent with broadcast]
[🔍 วิธีตรวจสอบ] [💊 วิธีป้องกัน] [📞 ติดต่อเจ้าหน้าที่]
━━━━━━━━━━━━━━━━━━━━━━━━

[สมชาย receives it instantly on LINE — no app needed]
[He taps "วิธีป้องกัน" → pest-disease-consult skill activates]
```

---

### Key Metrics at Proposal Stage

| Capability | Status |
|---|---|
| Platform | Operational (cloud-hosted, live) |
| AI models available | 20+ (Gemini, GPT-4o, Claude, and others) |
| LINE OA: text input/output | ✅ Complete |
| LINE OA: photo → visual diagnosis | ✅ Complete |
| LINE OA: voice note → Thai STT | ✅ Complete |
| LINE OA: AI voice reply (Thai TTS) | ✅ Complete |
| LINE OA: Flex bubble messages | ✅ Complete |
| LINE OA: quick reply chips | ✅ Complete |
| LINE OA: rich menu shortcuts | ✅ Complete |
| LINE OA: broadcast to all followers | ✅ Complete |
| Web control room (logs + analytics) | ✅ Complete |
| Credit sharing (cooperative pools) | ✅ Complete |
| Agricultural skill pack content | 🔄 Being finalized |
| Languages | Thai (primary), English |

---

*Submitted for AgriSpark 2.0 Hackathon — Prototype Track (TRL 5–6)*
*Organizer: GETHAC (German-Thai Agriculture Cooperation)*
*Theme: "Farm Smarter — AI for Smarter Farmer Advisory"*
