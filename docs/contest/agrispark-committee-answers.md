# AgriSpark 2.0 - Committee Questions: Grounded Draft Answers

Status: working draft for submission and live-demo preparation.

Positioning: do not present Vaja as a dedicated farmer app. Present Vaja AI as a skill-first AI cowork platform, with agriculture delivered through a Vaja Kaset / Farm Advisor agent and agricultural skill pack on LINE OA.

Date of audit: 2026-04-27.

---

## Implementation Audit

### What is already implemented enough to demonstrate

- Vaja platform: multi-model chat, agents, skills, RAG/knowledge base, memory, tools, credits, and LINE OA plumbing.
- Contextual Skills Engine: skills can be attached to agents, activated by model/rules, injected into prompts, and enriched with resource files.
- Farm Advisor seed: there is a seeded Farm Advisor agent and agricultural skills for pest/disease, weather risk, market guidance, and record keeping.
- LINE OA integration: text, image, audio, and video message handlers exist; conversations are persisted per LINE user/channel; rich menus, postbacks, broadcasts, narrowcasts, and account linking exist.
- Voice note input: LINE audio can be transcribed with Gemini; an AI text response is sent; a TTS audio reply is pushed for audio-input flows.
- Generic Flex response: LINE replies can be rendered as Flex bubbles when the answer has enough bullet points.
- Broadcasts: LINE OA broadcast and narrowcast APIs are implemented, with delivery stats hooks.
- Record keeper tool: generic activity logging exists and can support farm logs.

### Claims that should be softened

- Automated pest/disease outbreak forecasting is not implemented. The demo can show weather-risk advice and human-triggered officer broadcasts, not automated outbreak detection.
- Weather is not live yet in the current tool. `lib/tools/weather.ts` currently returns a random temperature. Replace before any live weather demo.
- The current LINE image/audio branches bypass the full canonical agent run path. They use the agent prompt, but do not reliably activate skills/tools from the image observation or transcript. Fix before live test.
- The current Flex message is a generic bullet renderer, not a purpose-built diagnosis card with severity fields. Phrase as "structured LINE response/Flex-style card" unless we build the specific template.
- Farm-level structured data is partial. Conversation logs and generic activity records exist; structured farm profiles, plot registry, regional aggregation, and per-plot outbreak analytics are roadmap/pilot work.
- Credit pools at platform level exist as a concept and credits are implemented, but LINE usage caps/fair-share controls are not yet production-grade.
- There is no real agricultural pilot yet. Be explicit.

### Priority fixes before giving the committee a live test

1. Replace fake weather with a real source: Open-Meteo is enough for a no-key demo; return 7-day rainfall, temperature, wind, and daily risk fields.
2. Route LINE image/audio through the same canonical agent run as text, after deriving an image observation or audio transcript, so skills and tools activate reliably.
3. Add a dedicated agriculture response contract to the Farm Advisor prompt: diagnosis, confidence, severity, immediate action, prevention, when to contact an officer.
4. Add a simple agriculture Flex template or ensure the prompt outputs bullet sections that trigger the existing Flex builder.
5. Seed/upload a small, curated agriculture reference pack: tomato early blight, rice blast, cassava mealybug/mosaic, longan anthracnose, pesticide safety rules, and Thai emergency contacts.
6. Create 6 scripted test cases and record actual outputs: text diagnosis, photo diagnosis, voice farm log, weather risk, record summary, officer broadcast.
7. Decide whether the live LINE channel should be billed to the channel owner for the demo, and avoid promising per-farmer credit caps until implemented.

---

## Section 1: Forecasting & Core Functionality

### Q1. Can the system provide forecasts or alerts for pest and disease outbreaks?

Answer:

Yes, but in two stages.

In the current Vaja platform, we can provide risk alerts and officer-mediated outbreak alerts. The Farm Advisor can interpret weather and field observations into practical risk advice, such as disease pressure after heavy rain, flood risk, or harvest timing risk. Extension officers or cooperative admins can also send LINE OA broadcast alerts to all farmers in a channel when they observe a local issue.

What is not yet implemented is fully automated outbreak detection from aggregated farmer reports. The roadmap is to detect patterns such as several farmers in the same district reporting similar symptoms within 48 hours, then create a draft alert for officer review. We prefer officer-reviewed alerts first because agricultural advice has real economic consequences.

For the live test, we will demonstrate weather-risk advisory and manual broadcast alerts. Automated regional outbreak detection is a pilot-phase feature.

### Q2. What is the planned response format of the system?

Answer:

The response format depends on the task:

| Use case | Planned response |
| --- | --- |
| Pest/disease diagnosis | Structured LINE response or Flex card with likely issue, confidence, severity, immediate action, prevention, and officer referral when needed |
| Weather/farm risk | 3-7 day farm-risk summary translated into action, not just raw weather |
| Farm records | Confirmation card/text with date, crop or plot if known, activity, quantity, cost/income, and notes |
| Market guidance | Text advisory with source/date, price context, and decision framing |
| Simple questions | Direct Thai text answer |
| Severe or uncertain cases | Conservative answer plus recommendation to contact an extension officer |

The design rule is: use cards when structure helps the farmer decide; use plain text when a simple answer is clearer.

---

## Section 2: Data Collection & Farm-Level Insights

### Q3. Does the system collect farm-level data, such as farm size, plots, and location?

Answer:

Partially in the current implementation, and more formally in the pilot roadmap.

Today, Vaja stores conversation history per LINE user and LINE OA channel. If the farmer says "2 rai of tomato in Chiang Mai" or "cassava plot behind the house", that context can be retained in conversation and memory. The generic record-keeper tool can also store activities with context type, crop/entity, category, date, quantity, cost, income, and notes.

What we do not yet have is a formal farm profile and plot registry with precise boundaries, GPS coordinates, soil type, irrigation type, and named plots. For a low-friction LINE-first product, we intentionally avoid forcing farmers through a long setup form before they can ask for help.

Pilot plan: add an optional first-time setup conversation asking for province/district, main crop, approximate area, and whether the farmer wants to name plots. This keeps onboarding conversational while making future advice more personalized.

### Q4. Can the system capture farming practices, such as fertilizer application and pest/disease occurrences at plot level?

Answer:

Yes for conversational capture; plot-level precision depends on what the farmer provides.

For fertilizer and activity logs, the record-keeper tool can store entries such as date, crop, activity category, quantity, cost, and notes. A farmer can say or voice-message: "I applied 50 kg urea to the rice field today", and Vaja can convert that into a structured activity record after confirmation.

For pest/disease occurrences, Vaja stores the consultation in the conversation history, including the farmer's description or photo-derived analysis and the AI response. If the farmer confirms the plot or crop, that can be included in the record.

Current limitation: the app does not yet maintain a dedicated plot table where every diagnosis is automatically linked to Plot A or Plot B. That is a high-value pilot enhancement, especially for farmers with multiple plots.

---

## Section 3: Data Aggregation & Network Effects

### Q5. Does the system aggregate data across users, such as pest outbreaks in a region?

Answer:

At the channel analytics level, yes. At automated outbreak-intelligence level, not yet.

The current LINE OA implementation tracks daily channel metrics such as message count, unique users, tool calls, and images sent. Conversations are stored per LINE user and channel, so an extension officer or channel owner can review issues across their farmer group.

What is not yet built is automated topic classification, pest/disease clustering, map-based regional heatmaps, or automatic outbreak thresholds. That is the next layer: turning stored conversations into de-identified regional signals.

### Q6. If yes, can this data alert other farmers and build a long-term dataset?

Answer:

Yes, with a staged approach.

For alerts today, an officer or cooperative admin can send a LINE OA broadcast or narrowcast to farmers in the channel. This supports fast human-reviewed alerts, which is the safest first step.

For long-term forecasting, the stored conversation and activity data can become a valuable dataset if farmers and channel owners consent. Over time, anonymized reports can show which crops face which pest/disease problems, in which locations, under which weather conditions. This can improve future forecasting and help agricultural partners update the skill pack.

Governance principle: farmer data should benefit the farmer community that generated it. External sharing should be anonymized, consent-based, and preferably done with trusted agricultural institutions.

---

## Section 4: AI Approach & Differentiation

### Q7. What is the added value compared to using Gemini directly?

Answer:

Gemini is a powerful model. Vaja adds the product, workflow, governance, and local domain layer around it.

| General AI directly | Vaja AI |
| --- | --- |
| Requires separate app/browser/account behavior | Works through LINE OA, where Thai users already are |
| Generic agricultural answer | Skill pack injects agricultural workflows and curated local knowledge |
| User must know how to prompt | Rich menu and agent prompt guide the conversation |
| Text blob | Structured LINE responses, quick replies, and optional voice flow |
| No cooperative access model | Shared channel/credit model for groups and cooperatives |
| No officer oversight | Web control room and broadcast workflow |
| No reusable domain packaging | Skills can be updated, validated, shared, and reused across agents |

The core differentiation is that Vaja is skill-first and channel-first. Agriculture is not hardcoded into the platform; it is a skill pack that can be reviewed, replaced, or expanded by experts.

### Q8. How is the accuracy of pest and disease advisory ensured?

Answer:

We use a layered approach:

1. Curated skill instructions: the pest/disease skill instructs the AI to follow a diagnostic workflow rather than guessing.
2. Visual evidence: for photo inputs, a vision model can inspect the image and describe symptoms.
3. Conservative response style: the AI is instructed to state uncertainty, ask follow-up questions, and avoid overconfident diagnosis.
4. Human escalation: severe or ambiguous cases should be referred to extension officers.
5. Pilot validation: real farmer cases will be reviewed by agricultural experts before commercial rollout.

We will not claim 100 percent diagnostic accuracy. The safer claim is that Vaja improves access to preliminary advisory and triage, while keeping high-risk decisions under human oversight.

### Q9. How is the agricultural knowledge base validated?

Answer:

The current agricultural skill pack is a prototype knowledge layer. It should be validated before being treated as production agronomic advice.

Planned validation process:

1. Compile the initial references from official and expert sources, such as Thai Department of Agriculture, Department of Agricultural Extension, Kasetsart University publications, and pesticide safety guidance.
2. Ask 2-3 extension officers or agronomists to review the skill content before farmer testing.
3. Run a small pilot with 30-50 farmers and review real outputs.
4. Update the skill pack based on expert corrections and field feedback.
5. Version the skill pack so changes are traceable.

The architecture makes this practical because domain knowledge lives in skills, not hardcoded app logic.

### Q10. Are there safety mechanisms to prevent or handle incorrect diagnoses or advice?

Answer:

Yes, and we plan to make them stricter before live farmer use.

Current and planned safety mechanisms include:

- Conservative language: advice is framed as recommendation, not command.
- Uncertainty handling: if the image or symptoms are unclear, the AI should say so and ask for more information.
- Officer referral: severe, fast-spreading, or ambiguous cases should be escalated.
- Chemical safety constraints: avoid brand-name promotion; prefer active ingredients, label compliance, PPE, and local expert confirmation.
- Human review: extension officers can monitor conversations and send corrected guidance or broadcasts.
- Pilot review loop: responses from the pilot will be scored for usefulness, safety, and correctness.

The key safety position is that Vaja is an advisory and triage tool, not a replacement for field diagnosis by a qualified officer.

---

## Section 5: Business Model & Access

### Q11. What does a user receive for 100 credits? How many queries or how much usage?

Answer:

In the current Vaja platform, credits are the unit for AI usage. The default lightweight text model costs 1 credit per AI request, while stronger models and image/audio/video tasks cost more.

For the agricultural use case, our target credit model is:

| Interaction | Expected credits |
| --- | ---: |
| Simple text question | 1 |
| Weather/farm risk question | 1-2 |
| Pest/disease text advisory | 1-2 |
| Photo-based advisory | 2-4 |
| Voice note input | 2-3 |
| Voice reply/TTS enabled flow | 3-5 |

So 100 credits should represent roughly 30-80 farmer interactions, depending on the mix. A farmer who asks 10-15 questions per month would usually use about 15-30 credits per month if most interactions are text and occasional photos.

This pricing should be finalized after measuring actual pilot usage and model costs.

### Q12. How do you ensure fair and equal access for farmer groups/cooperatives and shared credit usage?

Answer:

The Vaja model is designed for group access rather than only individual subscriptions.

The preferred agricultural model is B2B2C: a cooperative, extension office, NGO, or sponsor funds a shared LINE OA channel. Farmers can use the service through LINE without each person needing a separate paid AI subscription.

For fairness, the roadmap includes:

- Admin-visible usage per LINE user.
- Soft monthly caps per user.
- Emergency override for severe crop-risk situations.
- Sponsored access for low-income farmer groups.
- Transparent credit reporting for cooperative admins.

Important implementation note: basic credits already exist in Vaja. Fine-grained per-farmer caps inside LINE OA should be implemented before scaling beyond a controlled pilot.

---

## Section 6: Data Privacy & Governance

### Q13. How do you ensure data privacy, especially if extension officers or third parties can access or monitor conversations?

Answer:

Privacy is handled by channel scoping, pseudonymous LINE identity, role-based access, and consent.

Farmers interacting through LINE OA are identified by LINE user IDs. Vaja does not automatically receive their real name, phone number, national ID, or precise GPS location. If account linking is used, the user explicitly links their LINE user to a Vaja account.

Extension officers or cooperative admins should only access conversations for the LINE OA channel they manage. They should not see other channels or unrelated users. Farmers should be informed at onboarding that conversations may be reviewed by the responsible officer/admin for service quality and escalation.

For aggregated analytics, the plan is to use anonymized and de-identified data. External sharing with research institutions or partners should require clear consent and should not expose individual farmer conversations.

The governance posture is aligned with Thailand PDPA principles: collect only what is needed, disclose monitoring, restrict access, allow deletion requests, and anonymize data used for aggregate insight.

---

## Section 7: Validation & Real-World Impact

### Q14. Has the system been tested with farmers or extension officers?

Answer:

The underlying Vaja AI platform has been built and tested as a working AI cowork platform with Thai users and LINE OA workflows. However, the agricultural skill pack has not yet completed a real farmer or extension-officer pilot.

That is the honest current stage: platform readiness is ahead of agricultural field validation.

Our requested next milestone is a structured pilot with one farmer group and one or more extension officers. The goal is to test usability, response quality, safety, and whether the advice helps farmers make better decisions.

### Q15. Please provide representative outputs for each core function.

Answer:

We can provide representative outputs for:

- Diagnosis: farmer sends a sick plant photo or description; Vaja returns likely disease/pest, confidence, severity, immediate action, prevention, and referral note.
- Advisory: farmer asks about fertilizer timing, planting timing, or pest control; Vaja gives practical steps in Thai.
- Weather risk: farmer asks about rain before harvest; Vaja returns a 3-7 day risk summary and recommended action.
- Farm record: farmer says they applied fertilizer or pesticide; Vaja confirms and logs after consent.
- Alert: officer sends a LINE OA broadcast warning farmers about a local pest/weather risk.

Before submission, we should attach screenshots or transcript snippets generated from the live test channel, not only mocked examples.

### Q16. Please provide evidence from real pilots: usability, response quality, and improved farm decisions.

Answer:

No agricultural pilot has been completed yet. We do not want to overclaim field impact before measuring it.

Current evidence we can provide:

1. Live technical demonstration of the Vaja platform and LINE OA flow.
2. Platform-level evidence that agents, skills, LINE messaging, voice, image handling, records, and broadcasts exist.
3. Side-by-side response comparison between a general AI answer and Vaja with the agriculture skill pack.
4. A pilot plan with metrics:
   - usability: completion rate, repeat usage, farmer satisfaction;
   - response quality: expert scoring of correctness, safety, clarity;
   - decision impact: whether farmers changed timing, treatment, record keeping, or escalation behavior.

Round 2 should include real pilot evidence if selected for mentoring.

---

## Business Plan

### Q17. Development cost estimate

Answer:

Next milestone: Agricultural Pilot Readiness.

Definition: a live LINE OA pilot with a validated Farm Advisor agent, real weather data, agriculture skill references, 30-50 farmers, at least one reviewing extension officer, and 4 weeks of usage measurement.

Estimated cost to next milestone:

| Item | Estimate |
| --- | ---: |
| Agriculture skill/reference pack and prompt refinement | 40,000-100,000 THB |
| Expert review by agronomist/extension officers | 20,000-60,000 THB |
| Engineering fixes before live pilot | 80,000-160,000 THB |
| Pilot operations, onboarding, support, reporting | 40,000-100,000 THB |
| Cloud/API/demo budget | 10,000-30,000 THB |
| Total | 190,000-450,000 THB |

Estimated cost to TRL 9:

| Phase | Estimate |
| --- | ---: |
| Pilot readiness and first pilot | 190,000-450,000 THB |
| Expert validation and safety review | 150,000-350,000 THB |
| Farm profile/plot registry and aggregation analytics | 250,000-600,000 THB |
| Production hardening, privacy, admin roles, monitoring | 250,000-700,000 THB |
| Cooperative onboarding and support materials | 150,000-500,000 THB |
| Total to TRL 9 | 990,000-2,600,000 THB |

This is lower than building a standalone farm app because Vaja already has the core platform. The main new investment is agricultural validation, pilot operations, and production hardening.

### Q18. Expected use frequency per user per month

Answer:

Expected blended average: about 10-15 interactions per active farmer per month.

Usage will be seasonal:

| User type | Expected monthly use |
| --- | ---: |
| Occasional farmer | 3-8 interactions |
| Average active farmer | 10-15 interactions |
| Highly engaged farmer during crop season | 20-30 interactions |
| Extension officer/admin | higher, mostly monitoring and broadcasts |

### Q19. Estimated cost per user per month at scale

Answer:

These are planning estimates based on current public pricing and the current app architecture. They should be validated after pilot telemetry.

Assumptions:

- 12 interactions per active user per month.
- Mostly text, with some image/voice.
- Gemini 2.5 Flash-Lite as the default high-volume model.
- LINE reply messages are not counted as paid broadcast messages, but push, multicast, broadcast, and narrowcast messages are counted by LINE.
- Broadcast-heavy usage can dominate cost, so alerts should be targeted and officer-reviewed.

Current public price references:

- Gemini 2.5 Flash-Lite: paid tier listed at USD 0.10 per 1M text/image/video input tokens, USD 0.30 per 1M audio input tokens, and USD 0.40 per 1M output tokens.
- LINE Thailand OA: free 300 broadcast messages/month, Basic 1,280 THB for 15,000 broadcast messages, Pro 1,780 THB for 35,000 broadcast messages, with additional messages around 0.10 THB/message on Basic and 0.06 THB/message on Pro.

| Total users | Estimated cost/user/month | Currency |
| ---: | ---: | --- |
| 10,000 | 3-8 | THB |
| 100,000 | 2-6 | THB |
| 500,000 | 1.5-5 | THB |

Why the range is wide: AI text cost is low, but voice, image, storage, support, and LINE broadcast volume can change the economics. The safest pilot pricing should assume 5-10 THB cost per active farmer per month until real usage data proves otherwise.

### Q20. How will development and monthly operating costs be covered?

Answer:

Development to TRL 9 can be covered through a mix of:

- AgriSpark prize/grant funding.
- Thai digital/agricultural innovation grants.
- Pilot sponsorship by cooperatives, NGOs, agri-input companies, or public agencies.
- Prepaid cooperative access packages.
- Skills Marketplace partnerships with universities or expert organizations.

Monthly operations can be covered by cooperative or sponsor credit pools. The long-term model is not "each farmer buys an AI subscription." It is group access: a cooperative, institution, or sponsor pays for a shared channel and credit pool, while farmers access the service through LINE.

This fits Vaja's broader vision: one platform, many professions, each powered by validated domain skills.

---

## Video Plan - Max 5 Minutes

Recommended structure:

1. 0:00-0:30 - Vaja AI vision: skill-first AI cowork platform; agriculture as one skill pack.
2. 0:30-1:15 - Farmer uses LINE, no new app; show rich menu.
3. 1:15-2:00 - Diagnosis demo: text or photo.
4. 2:00-2:45 - Weather risk demo using real weather data.
5. 2:45-3:30 - Voice farm record demo.
6. 3:30-4:15 - Officer control room and broadcast alert.
7. 4:15-5:00 - Roadmap and honest validation status: platform ready, farmer pilot next.

Do not say "proven to improve yield" in the video. Say "designed to test whether earlier advisory improves decisions during pilot."

---

## Sources For Cost Assumptions

- Google AI for Developers, Gemini API pricing: https://ai.google.dev/pricing
- LINE Developers, Messaging API pricing rules: https://developers.line.biz/en/docs/messaging-api/pricing/
- LINE for Business Thailand, LINE OA broadcast package pricing: https://lineforbusiness.com/th/service/line-oa-features/broadcast-message
