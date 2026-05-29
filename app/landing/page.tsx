import Link from 'next/link';
import type { Metadata } from 'next';
import {
  ArrowRightIcon,
  BookOpenCheckIcon,
  BotIcon,
  Building2Icon,
  CheckCircle2Icon,
  ClipboardCheckIcon,
  CoinsIcon,
  GraduationCapIcon,
  HeartPulseIcon,
  LeafIcon,
  LineChartIcon,
  MessageCircleIcon,
  MonitorCogIcon,
  QrCodeIcon,
  ShieldCheckIcon,
  SparklesIcon,
  StoreIcon,
  UsersRoundIcon,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Vaja AI | Skill-based AI coworkers',
  description:
    'Build skilled AI coworkers for Thai professionals, teams, and communities. Share them through web chat, LINE OA, and a web control room.',
};

const professions = [
  {
    title: 'Teachers',
    thai: 'ครูและติวเตอร์',
    description: 'Lesson plans, quizzes, worksheets, student feedback, and classroom material.',
    icon: GraduationCapIcon,
    metric: '18 skills',
  },
  {
    title: 'Elderly care',
    thai: 'ทีมดูแลผู้สูงอายุ',
    description: 'Care notes, family updates, daily summaries, medication reminders, and handover logs.',
    icon: HeartPulseIcon,
    metric: '12 workflows',
  },
  {
    title: 'SMEs and shops',
    thai: 'ร้านค้าและธุรกิจเล็ก',
    description: 'Customer replies, product FAQs, promotions, LINE broadcasts, and content ideas.',
    icon: StoreIcon,
    metric: '24 templates',
  },
  {
    title: 'Farmers',
    thai: 'เกษตรกร',
    description: 'Crop disease questions, weather risks, farm records, and market information.',
    icon: LeafIcon,
    metric: '9 references',
  },
  {
    title: 'Clinics',
    thai: 'คลินิกและสุขภาพ',
    description: 'Patient communication, report drafting, follow-up messages, and knowledge lookup.',
    icon: ClipboardCheckIcon,
    metric: '7 guardrails',
  },
  {
    title: 'Community teams',
    thai: 'ชุมชนและองค์กรท้องถิ่น',
    description: 'Public Q&A, form help, document drafting, policy lookup, and shared services.',
    icon: Building2Icon,
    metric: '15 forms',
  },
];

const channels = [
  {
    label: 'Shared web chat',
    status: 'public.link.ready',
    description: 'Send one focused agent by link, QR code, website, social post, classroom, or event.',
    icon: QrCodeIcon,
  },
  {
    label: 'LINE OA',
    status: 'line.channel.synced',
    description: 'Keep the repeat conversation where Thai customers, families, and communities already chat.',
    icon: MessageCircleIcon,
  },
  {
    label: 'Web control room',
    status: 'workspace.owner.admin',
    description: 'Build agents, attach skills, review conversations, manage knowledge, and control credits.',
    icon: MonitorCogIcon,
  },
];

const workflow = [
  ['01', 'Select workflow', 'Choose a profession or team process.'],
  ['02', 'Configure agent', 'Set role, tone, model routing, and owner limits.'],
  ['03', 'Attach skills', 'Load instructions, references, tools, and guardrails.'],
  ['04', 'Publish access', 'Share via web link, QR code, LINE OA, or team workspace.'],
  ['05', 'Improve loop', 'Review analytics, update knowledge, and tune responses.'],
];

const skillExamples = [
  'lesson-planner',
  'elderly-care-note-writer',
  'customer-service',
  'thai-sme-marketing',
  'crop-disease-consult',
  'patient-communication',
  'government-form-helper',
  'brand-voice-guardrail',
];

const surface = {
  page: 'bg-[#fcf8ff] text-[#1b1a26]',
  section: 'border-[#cac4d4]',
  card: 'border-[#cac4d4] bg-[#ffffff]',
  cardTint: 'border-[#cac4d4] bg-[#f5f2ff]',
  elevated: 'border-[#cac4d4] bg-white/80 shadow-[0_24px_60px_-46px_rgba(31,26,61,0.5)] backdrop-blur-md',
  muted: 'text-[#484552]',
  label: 'font-[family-name:var(--font-geist-mono)] text-[10px] font-bold uppercase leading-3 tracking-[0.16em]',
  body: 'font-[family-name:var(--font-sarabun)]',
  heading: 'font-[family-name:var(--font-noto-sans-thai)]',
};

export default function LandingPage() {
  return (
    <main className={`${surface.page} ${surface.body} min-h-screen overflow-hidden`}>
      <HeroSection />
      <ProfessionSection />
      <ChannelSection />
      <SkillsSection />
      <ControlRoomSection />
      <FinalCta />
    </main>
  );
}

function HeroSection() {
  return (
    <section className={`relative border-b ${surface.section}`}>
      <div className="absolute inset-0 opacity-70 [background-image:linear-gradient(#e3e0f1_1px,transparent_1px),linear-gradient(90deg,#e3e0f1_1px,transparent_1px)] [background-size:32px_32px]" />
      <div className="relative mx-auto grid max-w-7xl gap-8 px-4 pb-10 pt-4 sm:px-6 lg:min-h-[88vh] lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
        <header className={`col-span-full flex items-center justify-between gap-4 rounded-xl border px-3 py-3 ${surface.elevated}`}>
          <Link href="/landing" className="group inline-flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-md bg-[#624cb8] text-lg font-bold text-white">
              ว
            </span>
            <span>
              <span className={`${surface.label} block text-[#1b1a26]`}>VAJA AI</span>
              <span className="block text-sm leading-5 text-[#484552]">Skill-based AI coworkers</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-1 rounded-md border border-[#cac4d4] bg-[#f5f2ff] p-1 md:flex">
            {[
              ['Professions', '#professions'],
              ['Channels', '#channels'],
              ['Skills', '#skills'],
            ].map(([label, href]) => (
              <a
                key={label}
                href={href}
                className="rounded-md px-3 py-2 text-sm font-medium text-[#484552] transition hover:bg-white hover:text-[#1b1a26]"
              >
                {label}
              </a>
            ))}
          </nav>

          <Link
            href="/sign-in"
            className="inline-flex h-10 items-center justify-center rounded-md border border-[#cac4d4] bg-white px-4 text-sm font-semibold text-[#1b1a26] transition hover:border-[#624cb8] hover:text-[#624cb8]"
          >
            Sign in
          </Link>
        </header>

        <div className="flex flex-col justify-center pb-6 pt-6 lg:pb-12">
          <div className={`mb-5 inline-flex w-fit items-center gap-2 rounded-md border border-[#cac4d4] bg-white px-3 py-2 ${surface.label} text-[#624cb8]`}>
            <SparklesIcon className="size-4" />
            agent.runtime.multi_channel
          </div>

          <h1 className={`${surface.heading} max-w-4xl text-balance text-[40px] font-bold leading-[1.12] text-[#1b1a26] sm:text-6xl sm:leading-[1.05] lg:text-7xl`}>
            AI coworkers with skills for every profession.
          </h1>

          <p className="mt-5 max-w-2xl text-pretty text-lg leading-8 text-[#484552]">
            Build an agent that understands your work, then share it through public web chat links,
            LINE OA, or your team workspace. Vaja is made for Thai professionals, care teams,
            educators, shops, farms, clinics, and communities.
          </p>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/sign-up"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-[#624cb8] px-5 text-sm font-semibold text-white transition hover:bg-[#4a329e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#624cb8] focus-visible:ring-offset-4"
            >
              Create workspace
              <ArrowRightIcon className="size-4" />
            </Link>
            <a
              href="#professions"
              className="inline-flex h-11 items-center justify-center rounded-md border border-[#cac4d4] bg-white px-5 text-sm font-semibold text-[#1b1a26] transition hover:border-[#624cb8] hover:text-[#624cb8]"
            >
              Explore professions
            </a>
          </div>

          <div className="mt-8 hidden max-w-2xl grid-cols-3 overflow-hidden rounded-xl border border-[#cac4d4] bg-white sm:grid">
            {[
              ['03', 'ACCESS CHANNELS'],
              ['01', 'CREDIT POOL'],
              ['∞', 'SKILL LIBRARIES'],
            ].map(([value, label], index) => (
              <div key={label} className={`p-4 ${index > 0 ? 'border-l border-[#cac4d4]' : ''}`}>
                <strong className={`${surface.heading} block text-2xl font-bold text-[#1b1a26]`}>{value}</strong>
                <span className={`${surface.label} mt-2 block text-[#797584]`}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        <ProductScene />
      </div>
    </section>
  );
}

function ProductScene() {
  return (
    <div className="relative hidden min-h-[560px] items-center justify-center lg:flex">
      <div className="relative w-full max-w-[640px]">
        <div className="rounded-xl border border-[#cac4d4] bg-white p-2 shadow-[0_32px_70px_-52px_rgba(31,26,61,0.75)]">
          <div className="overflow-hidden rounded-lg border border-[#cac4d4] bg-[#fcf8ff]">
            <div className="flex items-center justify-between border-b border-[#cac4d4] bg-white px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="size-2.5 rounded-full bg-[#ba1a1a]" />
                <span className="size-2.5 rounded-full bg-[#d89a00]" />
                <span className="size-2.5 rounded-full bg-[#178a55]" />
              </div>
              <span className={`${surface.label} text-[#797584]`}>workspace.control_room</span>
            </div>

            <div className="grid md:grid-cols-[184px_1fr]">
              <aside className="hidden border-r border-[#cac4d4] bg-[#efecfc] p-4 md:block">
                <div className={`${surface.label} mb-4 text-[#797584]`}>AGENTS</div>
                {['Teacher aide', 'Care coordinator', 'Shop assistant', 'Farm advisor'].map((item, index) => (
                  <div
                    key={item}
                    className={`mb-2 rounded-md border px-3 py-2 text-sm ${
                      index === 1
                        ? 'border-[#624cb8] bg-[#624cb8] text-white'
                        : 'border-[#cac4d4] bg-white text-[#484552]'
                    }`}
                  >
                    {item}
                  </div>
                ))}
              </aside>

              <div className="p-4">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className={`${surface.label} text-[#797584]`}>ACTIVE_AGENT</div>
                    <h2 className={`${surface.heading} mt-1 text-2xl font-semibold text-[#1b1a26]`}>
                      Elderly Care Companion
                    </h2>
                  </div>
                  <div className="rounded-md border border-[#cbbeff] bg-[#e6deff] px-3 py-2 text-xs font-semibold text-[#391e8d]">
                    4 skills active
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className={`rounded-lg border p-4 ${surface.card}`}>
                    <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#1b1a26]">
                      <BookOpenCheckIcon className="size-4 text-[#624cb8]" />
                      Skill stack
                    </div>
                    <div className="space-y-2 text-sm text-[#484552]">
                      {['care-note-summary', 'family-update-tone', 'medication-reminder'].map((item) => (
                        <p key={item} className={`rounded-md border px-3 py-2 ${surface.cardTint} ${surface.label} text-[#484552]`}>
                          {item}
                        </p>
                      ))}
                    </div>
                  </div>

                  <div className={`rounded-lg border p-4 ${surface.card}`}>
                    <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#1b1a26]">
                      <CoinsIcon className="size-4 text-[#624cb8]" />
                      Shared credits
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-[#e3e0f1]">
                      <div className="h-full w-2/3 rounded-full bg-[#624cb8]" />
                    </div>
                    <dl className="mt-4 grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-md border border-[#cac4d4] bg-[#f5f2ff] p-2">
                        <dt className={`${surface.label} text-[#797584]`}>LIMIT</dt>
                        <dd className="mt-1 font-semibold text-[#1b1a26]">80/day</dd>
                      </div>
                      <div className="rounded-md border border-[#cac4d4] bg-[#f5f2ff] p-2">
                        <dt className={`${surface.label} text-[#797584]`}>OWNER</dt>
                        <dd className="mt-1 font-semibold text-[#1b1a26]">funded</dd>
                      </div>
                    </dl>
                  </div>
                </div>

                <div className={`mt-3 rounded-lg border p-4 sm:mr-48 ${surface.card}`}>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-[#1b1a26]">Public access</span>
                    <span className={`${surface.label} text-[#797584]`}>same_agent.many_doors</span>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {['web-link', 'line-oa', 'team-chat'].map((item) => (
                      <div key={item} className={`${surface.label} rounded-md border border-[#cac4d4] bg-[#f5f2ff] px-3 py-2 text-center text-[#484552]`}>
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="absolute -bottom-8 right-5 w-[220px] rounded-xl border border-[#cac4d4] bg-white p-3 shadow-[0_22px_50px_-34px_rgba(31,26,61,0.85)]">
          <div className="mb-3 flex items-center justify-between">
            <span className={`${surface.label} text-[#797584]`}>LINE_OA_PREVIEW</span>
            <span className="size-2 rounded-full bg-[#178a55]" />
          </div>
          <div className="space-y-2 text-xs">
            <div className="mr-7 rounded-md border border-[#cac4d4] bg-[#f5f2ff] px-3 py-2 text-[#484552]">
              วันนี้ทานยาแล้วไหมครับ
            </div>
            <div className="ml-5 rounded-md bg-[#624cb8] px-3 py-2 text-white">
              เรียบร้อยแล้วค่ะ
            </div>
            <div className="mr-6 rounded-md border border-[#cac4d4] bg-[#f5f2ff] px-3 py-2 text-[#484552]">
              I will update the family summary.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProfessionSection() {
  return (
    <section id="professions" className={`border-b px-4 py-16 sm:px-6 lg:px-8 ${surface.section} bg-white`}>
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-8 lg:grid-cols-[0.82fr_1.18fr]">
          <div>
            <p className={`${surface.label} text-[#624cb8]`}>PROFESSION_FIRST</p>
            <h2 className={`${surface.heading} mt-4 max-w-xl text-3xl font-semibold leading-10 text-[#1b1a26] sm:text-4xl`}>
              Vaja is not one chatbot for one industry.
            </h2>
            <p className="mt-4 max-w-xl text-base leading-7 text-[#484552]">
              It is a skill-based workspace where each profession can load the knowledge, tone,
              workflows, and guardrails that make an AI coworker genuinely useful.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {professions.map((profession) => {
              const Icon = profession.icon;
              return (
                <article key={profession.title} className={`rounded-xl border p-4 ${surface.cardTint}`}>
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div className="grid size-10 place-items-center rounded-md border border-[#cbbeff] bg-[#e6deff] text-[#391e8d]">
                      <Icon className="size-5" />
                    </div>
                    <span className={`${surface.label} rounded-md border border-[#cac4d4] bg-white px-2 py-1 text-[#797584]`}>
                      {profession.metric}
                    </span>
                  </div>
                  <h3 className={`${surface.heading} text-lg font-semibold text-[#1b1a26]`}>{profession.title}</h3>
                  <p className="mt-1 text-sm font-medium text-[#624cb8]">{profession.thai}</p>
                  <p className="mt-3 text-sm leading-6 text-[#484552]">{profession.description}</p>
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function ChannelSection() {
  return (
    <section id="channels" className={`border-b bg-[#fcf8ff] px-4 py-16 sm:px-6 lg:px-8 ${surface.section}`}>
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-8 lg:grid-cols-[0.78fr_1.22fr]">
          <div>
            <p className={`${surface.label} text-[#624cb8]`}>CHANNEL_LAYER</p>
            <h2 className={`${surface.heading} mt-4 text-3xl font-semibold leading-10 text-[#1b1a26] sm:text-4xl`}>
              One smart agent, many doors.
            </h2>
            <p className="mt-4 text-base leading-7 text-[#484552]">
              Shared web chat and LINE OA are equal public access paths. The web app is the
              control room where the professional or team manages the work.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {channels.map((channel) => {
              const Icon = channel.icon;
              return (
                <article key={channel.label} className={`rounded-xl border p-4 ${surface.card}`}>
                  <div className="mb-4 flex items-center justify-between">
                    <div className="grid size-10 place-items-center rounded-md border border-[#cbbeff] bg-[#e6deff] text-[#391e8d]">
                      <Icon className="size-5" />
                    </div>
                    <CheckCircle2Icon className="size-4 text-emerald-600" />
                  </div>
                  <p className={`${surface.label} text-[#797584]`}>{channel.status}</p>
                  <h3 className={`${surface.heading} mt-2 text-lg font-semibold text-[#1b1a26]`}>{channel.label}</h3>
                  <p className="mt-3 text-sm leading-6 text-[#484552]">{channel.description}</p>
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function SkillsSection() {
  return (
    <section id="skills" className="border-b border-[#cac4d4] bg-white px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
          <div className={`rounded-xl border p-5 sm:p-6 ${surface.card}`}>
            <div className="mb-5 flex items-start gap-3">
              <div className="grid size-10 place-items-center rounded-md border border-[#cbbeff] bg-[#e6deff] text-[#391e8d]">
                <BotIcon className="size-5" />
              </div>
              <div>
                <p className={`${surface.label} text-[#624cb8]`}>CONTEXTUAL_SKILLS_ENGINE</p>
                <h2 className={`${surface.heading} mt-1 text-2xl font-semibold leading-8 text-[#1b1a26]`}>
                  Professional knowledge lives in skills.
                </h2>
              </div>
            </div>

            <p className="max-w-3xl text-base leading-7 text-[#484552]">
              Vaja stays general because domain expertise is not hardcoded into the platform. A teacher
              loads teaching skills. A care team loads elderly-care skills. A shop loads customer-service
              and marketing skills. The agent activates the right skill when the task appears.
            </p>

            <div className="mt-6 grid gap-2 sm:grid-cols-2">
              {skillExamples.map((skill) => (
                <div key={skill} className={`flex items-center gap-3 rounded-md border px-3 py-2 ${surface.cardTint}`}>
                  <ShieldCheckIcon className="size-4 text-[#624cb8]" />
                  <span className={`${surface.label} text-[#484552]`}>{skill}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-3">
            <div className="rounded-xl border border-[#cac4d4] bg-[#302f3b] p-5 text-[#f2efff]">
              <p className={`${surface.label} text-[#cbbeff]`}>OPEN_STANDARD</p>
              <h3 className={`${surface.heading} mt-3 text-2xl font-semibold`}>Open standard, local usefulness.</h3>
              <p className="mt-4 leading-7 text-[#e2dfff]">
                Skills can be created, imported, improved, and shared. Thai educators, healthcare workers,
                business owners, and communities can build knowledge without changing platform code.
              </p>
            </div>

            <div className={`rounded-xl border p-5 ${surface.cardTint}`}>
              <p className={`${surface.label} text-[#797584]`}>USER_EXPERIENCE</p>
              <h3 className={`${surface.heading} mt-3 text-xl font-semibold text-[#1b1a26]`}>Less configuration, more work done.</h3>
              <p className="mt-3 leading-7 text-[#484552]">
                Users ask for help. The agent brings in the right professional context, tools, and guardrails.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ControlRoomSection() {
  return (
    <section className="border-b border-[#cac4d4] bg-[#fcf8ff] px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <div>
          <p className={`${surface.label} text-[#624cb8]`}>OWNER_CONTROLS</p>
          <h2 className={`${surface.heading} mt-4 text-3xl font-semibold leading-10 text-[#1b1a26] sm:text-4xl`}>
            Share broadly without losing control.
          </h2>
          <p className="mt-4 text-base leading-7 text-[#484552]">
            Vaja lets one owner or organization fund useful AI access for a team, class, family,
            patient group, customer base, or community while keeping limits and analytics visible.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {[
              ['Shared credits', 'One pool can fund team members, guests, or public agent users.'],
              ['Usage limits', 'Protect links with caps, expiry, and owner-funded budgets.'],
              ['Knowledge base', 'Attach documents and resources that make answers specific.'],
              ['Analytics', 'See conversations, adoption, and what people need help with.'],
            ].map(([title, body]) => (
              <article key={title} className={`rounded-xl border p-4 ${surface.card}`}>
                <h3 className={`${surface.heading} font-semibold text-[#1b1a26]`}>{title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#484552]">{body}</p>
              </article>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-[#cac4d4] bg-[#302f3b] p-5 text-[#f2efff]">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <p className={`${surface.label} text-[#cbbeff]`}>PUBLISH_PIPELINE</p>
              <h3 className={`${surface.heading} mt-2 text-2xl font-semibold`}>From idea to public agent</h3>
            </div>
            <LineChartIcon className="size-6 text-[#cbbeff]" />
          </div>
          <div className="space-y-2">
            {workflow.map(([step, title, body]) => (
              <div key={step} className="flex gap-3 rounded-md border border-white/15 bg-white/[0.06] p-3">
                <span className={`${surface.label} grid size-8 shrink-0 place-items-center rounded-sm bg-[#e6deff] text-[#391e8d]`}>
                  {step}
                </span>
                <div>
                  <p className="text-sm font-semibold text-white">{title}</p>
                  <p className="mt-1 text-sm leading-6 text-[#e2dfff]">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="bg-white px-4 py-16 sm:px-6 lg:px-8">
      <div className={`mx-auto max-w-7xl rounded-xl border p-6 sm:p-8 lg:flex lg:items-center lg:justify-between lg:gap-8 ${surface.elevated}`}>
        <div>
          <div className="mb-4 inline-flex items-center gap-2 rounded-md border border-[#cbbeff] bg-[#e6deff] px-3 py-2 text-sm font-semibold text-[#391e8d]">
            <UsersRoundIcon className="size-4" />
            For teams, professionals, and communities
          </div>
          <h2 className={`${surface.heading} max-w-3xl text-3xl font-semibold leading-10 text-[#1b1a26]`}>
            Start with one skilled agent. Share it through the channel your people already use.
          </h2>
        </div>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row lg:mt-0">
          <Link
            href="/sign-up"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-[#624cb8] px-5 text-sm font-semibold text-white transition hover:bg-[#4a329e]"
          >
            Create workspace
            <ArrowRightIcon className="size-4" />
          </Link>
          <Link
            href="/sign-in"
            className="inline-flex h-11 items-center justify-center rounded-md border border-[#cac4d4] bg-white px-5 text-sm font-semibold text-[#1b1a26] transition hover:border-[#624cb8] hover:text-[#624cb8]"
          >
            Sign in
          </Link>
        </div>
      </div>
    </section>
  );
}
