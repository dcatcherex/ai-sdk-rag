# AgriSpark Competition Plan
## "Farm Smarter" — Vaja AI for Thai Agriculture

> สโลแกน: "เพราะทุกการตัดสินใจในการทำเกษตรนั้นสำคัญ"

---

## Competition Overview

| Item | Detail |
|------|--------|
| Event | AgriSpark Hackathon by GETHAC (German-Thai Agriculture Cooperation) |
| Theme | "Farm Smarter" |
| Core Question | How can AI help farmers and agricultural advisors make smarter decisions? |
| Track Target | **Prototype Track (TRL 5-6)** — we have a working system |
| Submission | Problem statement + AI-based solution + scalability potential (G-O-A-L) |

---

## Our Positioning

**We are NOT submitting a farm app. We are submitting a platform that makes any AI a farming expert.**

> "Vaja AI คือแพลตฟอร์ม AI แบบ Skill-First ที่ช่วยให้เกษตรกรไทยเข้าถึง AI ผู้เชี่ยวชาญด้านการเกษตรผ่าน LINE OA ที่ใช้อยู่แล้ว — โดยไม่ต้องดาวน์โหลดแอปใหม่ ไม่ต้องมีความรู้เทคนิค และสามารถแชร์ค่าใช้จ่ายในกลุ่มเกษตรกรได้"

**Why this positioning wins:**
1. Shows architectural depth — not a one-trick app
2. Demonstrates scalability — add more skills = more use cases
3. LINE = zero adoption friction for Thai farmers
4. Credit sharing = realistic for farmer cooperatives
5. Open standard = judges see long-term ecosystem potential

---

## The Farmer's Problem (Contest Framing)

### Current Situation

Thai smallholder farmers face decision-making under uncertainty every day:
- **Pest & disease** — wrong diagnosis = wrong treatment = crop loss
- **Weather risk** — planting/harvesting timing with limited forecast interpretation
- **Market prices** — sell now vs. hold based on incomplete information
- **Farm records** — most kept on paper or not at all, making trend analysis impossible
- **Accessing experts** — agricultural extension officers are overwhelmed, 1 officer per 200+ farmers in many areas

### The Gap

Existing AI tools (ChatGPT, etc.) can answer questions but:
- Don't know Thai crops, Thai regional conditions, Thai pesticide market
- Don't speak Thai naturally for rural contexts
- Require internet, smartphone proficiency, app installation
- Can't be shared in a farmer cooperative

---

## Our Solution: Agricultural Skill Pack on Vaja AI

Vaja's Contextual Skills Engine loads specialized agricultural knowledge into the AI automatically. The farmer just messages their LINE OA in natural Thai — no commands, no prompts, no technical knowledge.

### The 4 Core Agricultural Skills

#### 1. `pest-disease-consult`
**Trigger:** keywords like "โรค", "แมลง", "ใบ", "เหลือง", "เน่า", "จุด", symptom descriptions
**What it does:** Structured diagnosis workflow
```
1. Identifies crop type (if not mentioned, asks)
2. Asks about symptoms: color, pattern, location, spread speed
3. Asks about recent weather
4. Provides: diagnosis (Thai + scientific name), severity, immediate action, prevention
5. Always adds: "ควรปรึกษาเจ้าหน้าที่เกษตรในพื้นที่เพิ่มเติม"
```
**Reference files:** thai-crop-diseases.md, common-pesticides-thailand.md, symptom-guide.md

#### 2. `weather-farm-risk`
**Trigger:** keywords like "ฝน", "แล้ง", "น้ำ", "อากาศ", "ปลูก", "เก็บเกี่ยว"
**What it does:** Connects to weather tool → translates forecast to farm decisions
```
1. Gets current weather data for user's region
2. Interprets for farming context:
   - Risk level (drought, flood, frost, heat stress)
   - Recommended actions (delay planting, prepare drainage, harvest now)
   - 7-day outlook
```
**Tools unlocked:** weather tool (already built in lib/tools/weather.ts)

#### 3. `crop-market-advisor`
**Trigger:** keywords like "ราคา", "ขาย", "ตลาด", "กิโล", "บาท"
**What it does:** Market price context + sell/hold guidance
```
1. Asks: which crop, which region, current farm-gate price being offered
2. Provides: market context, price trend direction, simple recommendation
3. Always frames as: "ข้อมูลเพื่อประกอบการตัดสินใจ ไม่ใช่คำแนะนำทางการเงิน"
```

#### 4. `farm-record-keeper`
**Trigger:** keywords like "บันทึก", "จด", "ใส่ปุ๋ย", "รด", "ปลูก", "เก็บ", "ขาย"
**What it does:** Structured farm log via conversation
```
1. Extracts: date (default today), crop, activity, quantity, cost/income
2. Confirms and saves to conversation memory
3. Can summarize: "สรุปการทำงานสัปดาห์นี้" or "ค่าใช้จ่ายเดือนนี้"
```

---

## Demo Scenario (For Judges)

**Persona:** สมชาย เกษตรกรปลูกมะเขือเทศ จังหวัดเชียงใหม่

**Demo flow:**

```
1. สมชายส่งข้อความใน LINE OA:
   "ใบมะเขือเทศเป็นจุดสีน้ำตาล ขอบใบเหลือง ช่วงนี้ฝนตกบ่อย"

2. Vaja AI (pest-disease-consult skill activates):
   "เข้าใจแล้วครับ ขอถามเพิ่มเติมนิดหน่อยนะครับ
    จุดสีน้ำตาลอยู่ที่ใบล่างหรือใบบนครับ? 
    และจุดมีวงสีเหลืองล้อมรอบไหมครับ?"

3. สมชาย: "ใบล่างก่อน ตอนนี้ขึ้นมาใบบนแล้ว มีวงเหลืองด้วย"

4. Vaja AI:
   "จากอาการที่บอก น่าจะเป็น โรคใบไหม้ (Early Blight) 
    เกิดจากเชื้อรา Alternaria solani ครับ
    
    ความรุนแรง: ปานกลาง-สูง (กำลังลามขึ้น)
    
    สิ่งที่ควรทำทันที:
    • ตัดใบที่เป็นโรคออก ทิ้งนอกแปลง อย่าทิ้งในแปลง
    • ฉีดพ่นสารป้องกันกำจัดเชื้อรา เช่น แมนโคเซบ หรือ คลอโรทาโลนิล
    • ลดการให้น้ำตอนเย็น เพราะความชื้นช่วงกลางคืนทำให้โรคลาม
    
    ป้องกันฤดูถัดไป: หมุนเวียนพืช อย่าปลูกมะเขือเทศในแปลงเดิมติดกัน 2 ปี
    
    ควรปรึกษาเจ้าหน้าที่เกษตรในพื้นที่เพิ่มเติมด้วยนะครับ 🌱"

5. (web app control room)
   สมชายหรือเจ้าหน้าที่เกษตรดูประวัติการสนทนา
   เห็น analytics: 47 messages this week, top topic: pest & disease
```

**Key demo points for judges:**
- Zero app download — happened entirely in LINE
- Natural Thai conversation — no commands, no prompts
- Domain expertise — specific crop, specific disease, specific Thai products
- Accessible — works on any phone with LINE installed
- Shareable — a cooperative can share one Vaja account

---

## Scalability Argument (G-O-A-L Framework)

**G — Go-to-market**
- LINE OA = zero distribution friction, 54M Thai users
- Start with 1 crop type / 1 region, expand via community skill contributions
- Farmer cooperatives as B2B2C channel (buy credit pool → distribute to members)

**O — Operations**
- Skills are files (SKILL.md) — adding a new crop/disease takes hours, not months
- No infrastructure change needed to add new agricultural domains
- AI models improve automatically as underlying models improve

**A — Adoption**
- Works on farmers' existing LINE accounts
- No training required — just chat in Thai
- Agricultural extension officers can use the web control room to monitor and assist

**L — Long-term**
- Open Agent Skills standard → Thai agricultural university can contribute skills
- GETHAC and partner organizations can publish verified skill packs
- Data from farm records creates anonymized insights for agricultural policy

---

## Implementation Plan

### Week 1 — Core Agricultural Skills (Priority 1)

**Tasks:**
- [ ] Create `pest-disease-consult` SKILL.md with Thai crop database references
  - File: `skills/pest-disease-consult/SKILL.md`
  - References: common diseases for rice, cassava, sugarcane, tomato, longan
- [ ] Create `weather-farm-risk` SKILL.md that uses existing weather tool
  - File: `skills/weather-farm-risk/SKILL.md`
  - Connects to: `lib/tools/weather.ts` (already built)
- [ ] Create `crop-market-advisor` SKILL.md
  - File: `skills/crop-market-advisor/SKILL.md`
- [ ] Create `farm-record-keeper` SKILL.md
  - File: `skills/farm-record-keeper/SKILL.md`
- [ ] Create a "Farm Assistant" agent pre-loaded with all 4 skills
- [ ] Test full loop: skill activates → correct response → Thai language quality

**Acceptance criteria:** All 4 skills activate correctly from Thai keyword messages in chat.

### Week 2 — LINE OA Demo Polish

**Tasks:**
- [ ] Set up a demo LINE OA account ("Vaja เกษตร Demo")
- [ ] Configure rich menu with 3 buttons:
  - "ถามเรื่องโรคพืช/แมลง" → triggers pest-disease context
  - "เช็คสภาพอากาศฟาร์ม" → triggers weather-risk context
  - "บันทึกฟาร์ม" → triggers farm-record context
- [ ] Connect demo LINE OA to Farm Assistant agent with all 4 skills
- [ ] Test full demo scenario with real LINE app on phone
- [ ] Verify Thai language quality across all skill responses

**Acceptance criteria:** Demo scenario in "Demo Scenario" section above runs flawlessly end-to-end on a real phone.

### Week 3 — Presentation & Submission Prep

**Tasks:**
- [ ] Record a 3-minute demo video:
  1. Problem statement (30s): farmer's daily decisions, no accessible expert
  2. Solution demo (90s): live LINE OA conversation using all skills
  3. Platform vision (60s): skills are files, community can add, scales to all professions
- [ ] Write competition submission document:
  - Problem: Thai smallholder farmer decision-making gap
  - Solution: Agricultural skill pack on Vaja AI via LINE OA
  - Scalability: GETHAC/university skill contributions, cooperative credit pools
  - Impact: reduce crop loss, improve income decisions, extend agricultural advisor reach
- [ ] Prepare a 10-slide pitch deck
- [ ] Set up live demo environment (stable deployment)

**Acceptance criteria:** Submission ready, demo environment stable.

---

## Pitch Deck Outline (10 slides)

1. **Problem** — Thai farmer makes 10+ high-stakes decisions daily with no AI support
2. **Current gap** — Existing AI is generic; doesn't know Thai crops, Thai market, Thai context
3. **Solution** — Vaja AI: domain skills + LINE OA = agricultural AI expert in your pocket
4. **Live demo** — Show the LINE chat with all 4 skills activating naturally
5. **How it works** — Contextual Skills Engine, 3-tier injection, open SKILL.md standard
6. **The platform** — Skills are files; anyone (university, GETHAC, officers) can add knowledge
7. **Distribution** — LINE OA = zero friction for 54M Thai users
8. **Business model** — Cooperative credit pools; farmer group buys once, all members use
9. **Traction** — Current state: working platform, skills engine, LINE OA integration
10. **Ask / Next steps** — Fund to build 5 crop-specific skill packs + pilot with one cooperative

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Thai language quality poor | Medium | High | Test with native Thai speakers before demo; use Gemini which handles Thai well |
| Weather API unreliable | Low | Medium | Cache last reading; skill degrades gracefully |
| Live demo fails | Low | High | Pre-record backup video; practice demo 10+ times |
| Judges don't understand skill concept | Medium | High | Lead with the farmer story, not the architecture |
| Competition asks for farmer user data | High | Low | Honest: solo developer, feedback from network, aiming for pilot post-contest |

---

## Why We Will Win (Honest Assessment)

**Strengths:**
- Only contestant with LINE OA integration (other teams will build web apps farmers won't use)
- Working prototype, not a mockup
- Extensible platform — judges can see it's not a one-trick demo
- Addresses the GETHAC mission: practical AI for smallholder farmers

**Weaknesses:**
- Solo developer — no team credentials
- No farmers as actual current users (honest gap)
- Skills are new, not battle-tested with real agricultural edge cases

**Our honest angle:** "We've built the infrastructure. We need this contest to fund the domain expertise — partnering with agricultural universities and extension offices to build verified, accurate skill content."

---

## Post-Contest Roadmap (if funded)

1. **Month 1** — Pilot with one farmer cooperative in Chiang Mai or Chiang Rai
2. **Month 2** — Refine skill content based on real farmer feedback
3. **Month 3** — Expand to 3 crop types, partner with one agricultural university for content
4. **Month 4** — GETHAC integration: extension officers use web control room to assist
5. **Month 6** — Open skill contributions: university students create skills as thesis projects

---

*Created: April 2026*
*Competition: AgriSpark by GETHAC — "Farm Smarter"*
