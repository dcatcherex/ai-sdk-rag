'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PageHeader } from '@/components/page-header';
import type { ToolManifest } from '@/features/tools/registry/types';
import type { QuizOutput, FlashcardOutput, StudyPlanOutput } from '@/features/quiz/types';

type Props = { manifest: ToolManifest };

// ── Quiz Tab ──────────────────────────────────────────────────────────────────

type QuizWithGrounding = QuizOutput & {
  groundedFromKnowledgeBase: boolean;
  sources: string[];
};

function QuizTab() {
  const [topic, setTopic] = useState('');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [questionCount, setQuestionCount] = useState(5);
  const [format, setFormat] = useState<'mcq' | 'short_answer' | 'true_false' | 'mixed'>('mixed');
  const [examStyle, setExamStyle] = useState('');
  const [sourceMaterial, setSourceMaterial] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<QuizWithGrounding | null>(null);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  async function handleGenerate() {
    if (!topic.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setUserAnswers({});
    setRevealed({});
    try {
      const res = await fetch('/api/tools/quiz/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, difficulty, questionCount, format, examStyle: examStyle || undefined, sourceMaterial: sourceMaterial || undefined }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  function toggleReveal(id: string) {
    setRevealed((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-zinc-200 dark:border-border p-4 md:p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2 space-y-1.5">
            <Label htmlFor="quiz-topic">Topic *</Label>
            <Input
              id="quiz-topic"
              placeholder="e.g. Photosynthesis, World War II, React Hooks"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Difficulty</Label>
            <Select value={difficulty} onValueChange={(v) => setDifficulty(v as typeof difficulty)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="easy">Easy</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="hard">Hard</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Question format</Label>
            <Select value={format} onValueChange={(v) => setFormat(v as typeof format)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="mixed">Mixed</SelectItem>
                <SelectItem value="mcq">Multiple choice</SelectItem>
                <SelectItem value="true_false">True / False</SelectItem>
                <SelectItem value="short_answer">Short answer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="quiz-count">Number of questions (1–10)</Label>
            <Input
              id="quiz-count"
              type="number"
              min={1}
              max={10}
              value={questionCount}
              onChange={(e) => setQuestionCount(Math.min(10, Math.max(1, parseInt(e.target.value) || 1)))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="quiz-style">Exam style (optional)</Label>
            <Input
              id="quiz-style"
              placeholder="e.g. SAT, IELTS, university midterm"
              value={examStyle}
              onChange={(e) => setExamStyle(e.target.value)}
            />
          </div>
          <div className="md:col-span-2 space-y-1.5">
            <Label htmlFor="quiz-source">Source material (optional)</Label>
            <Textarea
              id="quiz-source"
              placeholder="Paste notes, textbook excerpts, or any reference text here…"
              rows={3}
              value={sourceMaterial}
              onChange={(e) => setSourceMaterial(e.target.value)}
            />
          </div>
        </div>
        <Button onClick={handleGenerate} disabled={loading || !topic.trim()}>
          {loading ? 'Generating…' : 'Generate quiz'}
        </Button>
        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>

      {result && (
        <div className="space-y-4">
          {result.groundedFromKnowledgeBase && result.sources.length > 0 && (
            <p className="text-xs text-indigo-600 dark:text-indigo-400">
              Grounded from: {result.sources.join(', ')}
            </p>
          )}
          <p className="text-sm text-muted-foreground italic">{result.instructions}</p>
          {result.quiz.map((q, index) => (
            <div key={q.id} className="rounded-xl border border-zinc-200 dark:border-border p-4 space-y-3">
              <p className="font-medium text-sm">
                {index + 1}. {q.question}
              </p>
              {q.options && q.options.length > 0 ? (
                <div className="space-y-1.5">
                  {q.options.map((opt) => (
                    <label key={opt} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="radio"
                        name={q.id}
                        value={opt}
                        checked={userAnswers[q.id] === opt}
                        onChange={() => setUserAnswers((prev) => ({ ...prev, [q.id]: opt }))}
                        className="accent-indigo-600"
                      />
                      {opt}
                    </label>
                  ))}
                </div>
              ) : (
                <Textarea
                  placeholder="Your answer…"
                  rows={2}
                  value={userAnswers[q.id] ?? ''}
                  onChange={(e) => setUserAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                />
              )}
              <Button size="sm" variant="outline" onClick={() => toggleReveal(q.id)}>
                {revealed[q.id] ? 'Hide answer' : 'Reveal answer'}
              </Button>
              {revealed[q.id] && (
                <div className="rounded-lg bg-green-50 dark:bg-green-950/30 px-3 py-2 space-y-1">
                  <p className="text-sm font-medium text-green-700 dark:text-green-300">
                    Answer: {q.answer}
                  </p>
                  <p className="text-xs text-green-600 dark:text-green-400">{q.explanation}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Flashcards Tab ────────────────────────────────────────────────────────────

type FlashcardWithGrounding = FlashcardOutput & {
  groundedFromKnowledgeBase: boolean;
  sources: string[];
};

function FlashcardsTab() {
  const [topic, setTopic] = useState('');
  const [cardCount, setCardCount] = useState(8);
  const [examStyle, setExamStyle] = useState('');
  const [focusAreas, setFocusAreas] = useState('');
  const [sourceMaterial, setSourceMaterial] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<FlashcardWithGrounding | null>(null);
  const [flipped, setFlipped] = useState<Record<string, boolean>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [mode, setMode] = useState<'stack' | 'list'>('stack');

  async function handleGenerate() {
    if (!topic.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setFlipped({});
    setCurrentIndex(0);
    try {
      const res = await fetch('/api/tools/quiz/flashcards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic,
          cardCount,
          examStyle: examStyle || undefined,
          focusAreas: focusAreas ? focusAreas.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
          sourceMaterial: sourceMaterial || undefined,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  const cards = result?.flashcards ?? [];

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-zinc-200 dark:border-border p-4 md:p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2 space-y-1.5">
            <Label htmlFor="fc-topic">Topic *</Label>
            <Input
              id="fc-topic"
              placeholder="e.g. Cell biology, JavaScript closures"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fc-count">Number of cards (1–20)</Label>
            <Input
              id="fc-count"
              type="number"
              min={1}
              max={20}
              value={cardCount}
              onChange={(e) => setCardCount(Math.min(20, Math.max(1, parseInt(e.target.value) || 1)))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fc-style">Exam style (optional)</Label>
            <Input
              id="fc-style"
              placeholder="e.g. AP Biology, USMLE Step 1"
              value={examStyle}
              onChange={(e) => setExamStyle(e.target.value)}
            />
          </div>
          <div className="md:col-span-2 space-y-1.5">
            <Label htmlFor="fc-focus">Focus areas (comma-separated, optional)</Label>
            <Input
              id="fc-focus"
              placeholder="e.g. definitions, formulas, dates"
              value={focusAreas}
              onChange={(e) => setFocusAreas(e.target.value)}
            />
          </div>
          <div className="md:col-span-2 space-y-1.5">
            <Label htmlFor="fc-source">Source material (optional)</Label>
            <Textarea
              id="fc-source"
              placeholder="Paste notes or textbook excerpts…"
              rows={3}
              value={sourceMaterial}
              onChange={(e) => setSourceMaterial(e.target.value)}
            />
          </div>
        </div>
        <Button onClick={handleGenerate} disabled={loading || !topic.trim()}>
          {loading ? 'Generating…' : 'Generate flashcards'}
        </Button>
        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>

      {result && cards.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">{result.deckTitle}</p>
              <p className="text-xs text-muted-foreground">{result.studyTip}</p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant={mode === 'stack' ? 'secondary' : 'outline'} onClick={() => setMode('stack')}>Stack</Button>
              <Button size="sm" variant={mode === 'list' ? 'secondary' : 'outline'} onClick={() => setMode('list')}>List</Button>
            </div>
          </div>

          {mode === 'stack' ? (
            <div className="space-y-3">
              <div
                className="rounded-xl border border-zinc-200 dark:border-border min-h-40 p-6 cursor-pointer flex flex-col items-center justify-center text-center gap-2 select-none transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                onClick={() => setFlipped((prev) => ({ ...prev, [cards[currentIndex].id]: !prev[cards[currentIndex].id] }))}
              >
                <p className="text-xs text-muted-foreground uppercase tracking-wide">
                  {flipped[cards[currentIndex].id] ? 'Back' : 'Front'} — click to flip
                </p>
                <p className="text-base font-medium">
                  {flipped[cards[currentIndex].id] ? cards[currentIndex].back : cards[currentIndex].front}
                </p>
                <p className="text-xs text-muted-foreground">{cards[currentIndex].topic}</p>
              </div>
              <div className="flex items-center justify-between">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { setCurrentIndex((i) => Math.max(0, i - 1)); setFlipped({}); }}
                  disabled={currentIndex === 0}
                >
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">{currentIndex + 1} / {cards.length}</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { setCurrentIndex((i) => Math.min(cards.length - 1, i + 1)); setFlipped({}); }}
                  disabled={currentIndex === cards.length - 1}
                >
                  Next
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {cards.map((card, index) => (
                <div
                  key={card.id}
                  className="rounded-xl border border-zinc-200 dark:border-border p-4 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                  onClick={() => setFlipped((prev) => ({ ...prev, [card.id]: !prev[card.id] }))}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{index + 1}. {card.front}</p>
                      {flipped[card.id] && (
                        <p className="mt-2 text-sm text-muted-foreground border-t border-zinc-100 dark:border-border pt-2">{card.back}</p>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">{flipped[card.id] ? 'Hide' : 'Show'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Study Plan Tab ────────────────────────────────────────────────────────────

type StudyPlanWithGrounding = StudyPlanOutput & {
  groundedFromKnowledgeBase: boolean;
  sources: string[];
  daysRemaining: number;
};

function StudyPlanTab() {
  const [examDate, setExamDate] = useState('');
  const [topics, setTopics] = useState('');
  const [weakTopics, setWeakTopics] = useState('');
  const [hoursPerDay, setHoursPerDay] = useState(2);
  const [goal, setGoal] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<StudyPlanWithGrounding | null>(null);

  async function handleGenerate() {
    const topicList = topics.split('\n').map((s) => s.trim()).filter(Boolean);
    if (!examDate || topicList.length === 0) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/tools/quiz/study-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          examDate,
          topics: topicList,
          weakTopics: weakTopics ? weakTopics.split('\n').map((s) => s.trim()).filter(Boolean) : undefined,
          hoursPerDay,
          goal: goal || undefined,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  const topicList = topics.split('\n').map((s) => s.trim()).filter(Boolean);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-zinc-200 dark:border-border p-4 md:p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="sp-date">Exam date *</Label>
            <Input
              id="sp-date"
              type="date"
              value={examDate}
              onChange={(e) => setExamDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sp-hours">Hours per day</Label>
            <Input
              id="sp-hours"
              type="number"
              min={0.5}
              max={24}
              step={0.5}
              value={hoursPerDay}
              onChange={(e) => setHoursPerDay(parseFloat(e.target.value) || 2)}
            />
          </div>
          <div className="md:col-span-2 space-y-1.5">
            <Label htmlFor="sp-topics">Topics to study * (one per line)</Label>
            <Textarea
              id="sp-topics"
              placeholder={"Algebra\nCalculus\nStatistics"}
              rows={4}
              value={topics}
              onChange={(e) => setTopics(e.target.value)}
            />
          </div>
          <div className="md:col-span-2 space-y-1.5">
            <Label htmlFor="sp-weak">Weak topics (one per line, optional)</Label>
            <Textarea
              id="sp-weak"
              placeholder={"Integration\nProbability"}
              rows={3}
              value={weakTopics}
              onChange={(e) => setWeakTopics(e.target.value)}
            />
          </div>
          <div className="md:col-span-2 space-y-1.5">
            <Label htmlFor="sp-goal">Goal (optional)</Label>
            <Input
              id="sp-goal"
              placeholder="e.g. Score 90%+, pass the certification exam"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
            />
          </div>
        </div>
        <Button onClick={handleGenerate} disabled={loading || !examDate || topicList.length === 0}>
          {loading ? 'Generating…' : 'Create study plan'}
        </Button>
        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>

      {result && (
        <div className="space-y-4">
          <div className="rounded-xl bg-indigo-50 dark:bg-indigo-950/30 px-4 py-3 flex items-center gap-4">
            <div>
              <p className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">
                {result.daysRemaining} days remaining
              </p>
              <p className="text-xs text-indigo-600 dark:text-indigo-400">
                Priority topics: {result.priorityTopics.join(', ')}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {result.plan.map((day) => (
              <div key={day.day} className="rounded-xl border border-zinc-200 dark:border-border p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-sm">{day.day}</p>
                  <span className="text-xs text-muted-foreground">{day.estimatedHours}h · {day.focus}</span>
                </div>
                <ul className="space-y-1">
                  {day.tasks.map((task, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                      <span className="mt-0.5 text-indigo-400">·</span>
                      {task.text}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Root page ─────────────────────────────────────────────────────────────────

export function QuizToolPage({ manifest }: Props) {
  return (
    <>
      <PageHeader title={manifest.title} description={manifest.description} />
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <Tabs defaultValue="quiz" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="quiz">Practice quiz</TabsTrigger>
            <TabsTrigger value="flashcards">Flashcards</TabsTrigger>
            <TabsTrigger value="study-plan">Study plan</TabsTrigger>
          </TabsList>
          <TabsContent value="quiz">
            <QuizTab />
          </TabsContent>
          <TabsContent value="flashcards">
            <FlashcardsTab />
          </TabsContent>
          <TabsContent value="study-plan">
            <StudyPlanTab />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
