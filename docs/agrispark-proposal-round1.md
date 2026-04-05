# AgriSpark 2.0 — Round 1 Proposal Submission
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
| **Crop management** | Pest & disease diagnosis; treatment selection; prevention planning |
| **Risk mitigation** | Weather-based planting/harvesting timing; flood and drought risk alerts |
| **Market decisions** | Market price context; sell-now vs. hold guidance; price trend awareness |
| **Farm records** | Activity logging via conversation; cost and income summaries |

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
Thai farmers communicate in informal, regional Thai. Solutions that require formal Thai commands, English prompts, or structured inputs create friction that breaks adoption.

---

### e) Present your solution

**Solution: Vaja AI Agricultural Skill Pack — AI Farm Advisor on LINE OA**

Vaja AI is an AI cowork platform with a **Contextual Skills Engine** — a system that loads specialized domain knowledge into an AI automatically, based on what the user is talking about. We have packaged this engine with an **Agricultural Skill Pack** (4 specialized skills) and delivered it through LINE OA — the messaging platform Thai farmers already use daily.

**How the farmer experiences it:**
A farmer messages their LINE OA in natural Thai. The system detects what topic they're raising (pest problem, weather concern, price question, record keeping) and automatically loads the right domain knowledge into the AI. The farmer receives a practical, Thai-language response that accounts for local crops, local products, and local conditions — as if they had a farming expert in their pocket.

**The 4 Agricultural Skills:**

| Skill | What it does | Triggered by |
|---|---|---|
| `pest-disease-consult` | Structured diagnosis: identify disease/pest, severity, immediate action, prevention | Keywords: โรค, แมลง, ใบเหลือง, เน่า, จุด, etc. |
| `weather-farm-risk` | Real-time weather → farm risk interpretation: planting/harvesting timing, flood/drought alerts | Keywords: ฝน, แล้ง, อากาศ, ปลูก, เก็บเกี่ยว, etc. |
| `crop-market-advisor` | Market price context + sell/hold guidance for major Thai crops | Keywords: ราคา, ขาย, ตลาด, กิโล, บาท, etc. |
| `farm-record-keeper` | Activity logging via natural conversation; cost/income summaries on request | Keywords: บันทึก, ใส่ปุ๋ย, รด, ปลูก, เก็บ, ขาย, etc. |

**What differentiates Vaja AI from other solutions:**

| Differentiator | Other AI tools | Vaja AI |
|---|---|---|
| No new app required | ❌ Need to install | ✅ Works in LINE OA |
| Thai agricultural domain knowledge | ❌ Generic only | ✅ Skill-specific knowledge |
| Natural Thai conversation | ❌ Formal/English-biased | ✅ Informal Thai supported |
| Group cost sharing | ❌ Individual subscription | ✅ Cooperative credit pools |
| Extension officer oversight | ❌ None | ✅ Web control room |
| Adds more skills as needed | ❌ Fixed feature set | ✅ New skills = new expertise |

---

## 2.2 AI & Technical Approach

### a) How AI is used

**Type of AI:** Large Language Models (LLMs) with a proprietary domain knowledge injection layer

**Primary model:** Google Gemini 2.5 Flash (optimized for Thai language quality and cost efficiency). The platform also supports 20+ models including GPT-4o, Claude, and others — model selection can be configured per use case.

**The Contextual Skills Engine — how it works:**

```
Farmer sends LINE message
        ↓
Webhook receives message → Vaja AI platform
        ↓
Skills Engine scans attached agricultural skills:
  ├─ Keyword match: "โรค" → pest-disease-consult activates
  ├─ Keyword match: "ฝน" → weather-farm-risk activates
  └─ LLM scoring: model rates skill relevance → top skills auto-activate
        ↓
Active skill's domain knowledge injected into AI context:
  1. Catalog layer — LLM sees all available skills
  2. Active layer — full agricultural skill instructions loaded
  3. Resources layer — relevant reference files (Thai crop diseases, pesticide guide)
        ↓
LLM generates response using domain-specific knowledge
        ↓
Response sent back to farmer via LINE Messaging API
        ↓
Metrics logged → extension officer reviews via web control room
```

**What problem does AI solve specifically?**
The LLM acts as the reasoning and communication layer. Without the Skills Engine, an LLM gives generic, low-value answers to Thai agricultural questions. With the Skills Engine, it follows a structured diagnostic workflow (ask about symptoms, crop, weather, spread pattern), references Thai-specific crop diseases and products, and delivers practical recommendations in natural Thai.

**Value added compared to non-AI applications:**
- A non-AI chatbot with fixed decision trees cannot handle the combinatorial complexity of crop × disease × weather × severity × product availability
- A fixed FAQ system cannot ask follow-up questions and refine a diagnosis
- The LLM handles the conversation naturally, while the Skills Engine ensures the knowledge it applies is locally relevant and accurate

---

### b) Data inputs

| Data Source | Type | Usage |
|---|---|---|
| Farmer's natural language messages | Real-time user input | Primary input — symptoms, observations, questions |
| Weather API | Real-time external data | Current conditions, 7-day forecast for farmer's region |
| Agricultural knowledge base (SKILL.md files) | Curated domain knowledge | Thai crop diseases, regional conditions, local pesticide market |
| Conversation history | Session memory | Multi-turn diagnosis; follow-up questions |
| LINE OA rich menu selection | User intent signal | Pre-loads relevant skill before conversation begins |

---

### c) Output

Farmers receive **natural Thai-language responses** delivered directly in their LINE chat:

**For pest & disease consultations:**
- Disease identification (Thai common name + scientific name)
- Severity assessment (low / medium / high)
- Immediate action steps (specific to locally available products)
- Prevention for next season
- Referral note to consult local extension officer for complex cases

**For weather & risk:**
- Current risk level (drought, flood, heat stress, frost)
- Recommended farm action (delay planting, prepare drainage, harvest now)
- 7-day outlook translated into farm decisions

**For market decisions:**
- Current price context for the crop/region
- Price trend direction
- Practical framing ("ข้อมูลเพื่อประกอบการตัดสินใจ — not financial advice")

**For farm records:**
- Confirmation of logged activity (date, crop, activity, quantity, cost/income)
- Weekly or monthly summaries on request

**For extension officers (web control room):**
- Conversation logs per LINE user
- Analytics: message volume, top topics, active channels
- Ability to intervene or assist in ongoing conversations

---

### d) Development stage

**Prototype / MVP — TRL 5–6**

The core platform (Vaja AI) is fully operational with:
- ✅ Multi-model AI chat (20+ models including Gemini, GPT-4o, Claude)
- ✅ Contextual Skills Engine (create, trigger, inject domain skills)
- ✅ LINE OA integration (webhook, rich menu, broadcast messaging)
- ✅ Web control room with conversation history and analytics
- ✅ Credit system with group sharing capability
- ✅ Agricultural skill pack (pest-disease-consult, weather-farm-risk, crop-market-advisor, farm-record-keeper) — content being finalized with Thai crop disease database

The system is deployable. The remaining work is content refinement (agricultural knowledge quality) and a pilot with an actual farmer group.

---

### e) Incorporation of target group (Prototype Track)

Per the AgriSpark 2.0 organizers' clarification, formal target group incorporation is planned for the **mentoring phase available to semi-finalist teams**, where 1:1 consultation sessions will be used to gather farmer and extension officer feedback and refine the proposal before Round 2 submission.

For Round 1, the solution design has been informed by:
- Documented research on the Thai agricultural extension system (officer-to-farmer ratios, advisory gaps)
- Feedback from small business owners and solopreneurs using the Vaja AI platform in its current form, who validated the zero-app-install and credit-sharing model
- Review of the types of questions Thai farmers commonly ask (pest/disease, weather, price) as the basis for the 4 skill categories

---

## 2.3 Practical Implementation

### a) User interaction

**Farmers:** Access the solution entirely through **LINE** — the messaging app most Thai farmers already use daily.
1. Follow the "Vaja เกษตร" LINE Official Account
2. The rich menu at the bottom of chat shows 3 shortcut buttons:
   - "ถามเรื่องโรคพืช/แมลง" (pest & disease)
   - "เช็คอากาศฟาร์ม" (weather risk)
   - "บันทึกฟาร์ม" (farm records)
3. Farmer taps a button or just types in natural Thai — the system responds

**No app download. No account registration. No commands to learn.**

**Extension officers:** Access a web-based control room (browser on any device) to monitor conversations, view analytics, and assist on complex cases.

---

### b) Infrastructure requirements

**For farmers:**
- Any smartphone (Android or iOS) with LINE installed
- Basic mobile internet connection (LINE messages are lightweight — 2G/3G sufficient)
- No additional devices, sensors, or hardware required

**For extension officers (control room):**
- Any device with a web browser and internet connection

**Platform infrastructure:**
- Hosted on cloud infrastructure (Next.js/Vercel + Neon serverless Postgres)
- LINE webhook for real-time message handling
- Weather API for real-time forecast data
- No on-site infrastructure required

---

### c) Ease of use

**For farmers — zero technical requirements:**
- Literacy: basic Thai reading/writing (as required to use LINE messaging)
- No new accounts to create
- No commands or prompts to learn
- No training required — the system adapts to however the farmer phrases their question
- Works on any phone that can run LINE (including older Android devices)

**Accessibility note:** For farmers with lower literacy, the rich menu buttons provide a shortcut so they don't need to type a full question — one tap pre-loads the right context.

---

## 2.4 Economic Value

### 1. Who benefits financially?

| Beneficiary | Financial benefit |
|---|---|
| **Smallholder farmers** | Reduced crop losses from earlier disease detection; better market timing; lower cost per advisory compared to agrochemical salesman recommendations |
| **Farmer cooperatives** | Shared cost across members reduces per-farmer expense to a fraction of individual AI subscriptions |
| **Agricultural extension officers** | Increased capacity: AI handles routine advisory, officers focus on field visits with higher impact per hour worked |
| **Agricultural value chain** | Improved input purchasing decisions, reduced post-harvest losses from better timing |

---

### 2. How is value created?

**Increased yields:** Earlier pest/disease detection reduces crop loss. Timely weather-based decisions (harvest before rain, delay planting during drought) protect yield.

**Reduced costs:** Correct disease diagnosis reduces unnecessary or incorrect pesticide use — a significant cost for smallholders. Market information reduces the likelihood of selling at the worst possible time.

**Risk reduction:** Weather risk interpretation translates meteorological data (which farmers may not know how to read) into direct farm actions. Flood and drought early warnings allow farmers to take protective action.

**Time savings:** Farmers get immediate advice at any hour, without waiting for an extension officer to be available. Extension officers save time by not answering the same 20 frequently asked questions repeatedly.

**Knowledge transfer at scale:** One well-designed agricultural skill pack, once created and validated, can serve thousands of farmers simultaneously — a dramatic multiplier on agricultural expertise.

---

### 3. Business model

**Credit-based model with cooperative sharing:**

Vaja AI uses a credit system where AI usage consumes credits. Credits can be purchased in packs:

| Pack | Credits | Price (THB) |
|---|---|---|
| Starter | 100 | 99 ฿ |
| Standard | 500 | 399 ฿ |
| Pro | 2,000 | 1,299 ฿ |
| Cooperative | 5,000 | 2,999 ฿ |

**The cooperative model:** A farmer group or cooperative buys one credit pool. The group administrator distributes usage to all members. This makes per-farmer cost as low as a few baht per day — affordable even for subsistence farmers.

**B2B2C channel:** Agricultural cooperatives, agri-input companies, or NGOs (e.g., GETHAC partners) can sponsor credit pools for farmer groups as part of their outreach programs.

Long-term: a **Skills Marketplace** where agricultural universities, GETHAC, and extension offices can publish verified agricultural skill packs — creating a community-maintained knowledge ecosystem.

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
Every Thai farmer has access to an agricultural AI advisor — in their own language, on the app they already use, at a cost they can afford.

**Mission:**
To build a skill-first AI platform that transforms domain expertise into accessible, affordable AI coworkers — starting with Thai agriculture, expanding to any profession that needs AI to truly understand their work.

---

## 2.6 Additional Material

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    VAJA AI PLATFORM                          │
│                                                             │
│  ┌──────────────────────┐   ┌─────────────────────────────┐ │
│  │  Agricultural Skills  │   │      AI Agent (Farm         │ │
│  │                      │   │      Assistant)              │ │
│  │  pest-disease-consult│──▶│                             │ │
│  │  weather-farm-risk   │   │  Gemini 2.5 Flash           │ │
│  │  crop-market-advisor │   │  (Thai-optimized)           │ │
│  │  farm-record-keeper  │   │                             │ │
│  │                      │   │  Memory ▪ Tools ▪ Skills    │ │
│  └──────────────────────┘   └──────────────┬──────────────┘ │
│                                            │                 │
│  ┌─────────────────────────────────────────▼───────────────┐ │
│  │                    Channel Layer                         │ │
│  │                                                         │ │
│  │   LINE OA (farmer front door)   Web App (officer room)  │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │               Cooperative Credit System                  │ │
│  │   Group buys once → all members use → per-farmer cost   │ │
│  │   reduced to <1% of individual AI subscription          │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Demo Scenario

**Persona:** สมชาย, tomato farmer in Chiang Mai

```
1. สมชาย messages LINE OA:
   "ใบมะเขือเทศเป็นจุดสีน้ำตาล ขอบใบเหลือง ช่วงนี้ฝนตกบ่อย"

2. Vaja AI (pest-disease-consult skill activates automatically):
   "เข้าใจแล้วครับ ขอถามเพิ่มเติมนิดหน่อยนะครับ
    จุดสีน้ำตาลอยู่ที่ใบล่างหรือใบบนครับ?
    และจุดมีวงสีเหลืองล้อมรอบไหมครับ?"

3. สมชาย: "ใบล่างก่อน ตอนนี้ขึ้นมาใบบนแล้ว มีวงเหลืองด้วย"

4. Vaja AI:
   "จากอาการที่บอก น่าจะเป็น โรคใบไหม้ (Early Blight)
    เกิดจากเชื้อรา Alternaria solani ครับ

    ความรุนแรง: ปานกลาง-สูง (กำลังลามขึ้น)

    สิ่งที่ควรทำทันที:
    • ตัดใบที่เป็นโรคออก ทิ้งนอกแปลง
    • ฉีดสารป้องกันเชื้อรา เช่น แมนโคเซบ หรือ คลอโรทาโลนิล
    • ลดการให้น้ำตอนเย็น

    ป้องกันฤดูถัดไป: หมุนเวียนพืช 2 ปี
    ควรปรึกษาเจ้าหน้าที่เกษตรในพื้นที่เพิ่มเติมด้วยนะครับ 🌱"

5. Extension officer (web control room):
   Views conversation log, sees: 47 messages this week, top topic: pest & disease
```

### Key Metrics at Proposal Stage

| Metric | Status |
|---|---|
| Platform uptime | Operational (cloud-hosted) |
| AI models available | 20+ (Gemini, GPT-4o, Claude, and others) |
| LINE OA integration | Complete — webhook + rich menu + broadcast |
| Agricultural skills | 4 skills designed; content being finalized |
| Languages supported | Thai (primary), English |
| Credit sharing | Operational — group pools working |

---

*Submitted for AgriSpark 2.0 Hackathon — Prototype Track (TRL 5–6)*
*Organizer: GETHAC (German-Thai Agriculture Cooperation)*
*Theme: "Farm Smarter — AI for Smarter Farmer Advisory"*
