'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SaveIcon, UsersIcon, GiftIcon, MailCheckIcon, BotIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Settings = {
  guestAccessEnabled: boolean;
  guestStartingCredits: number;
  guestSessionTtlDays: number;
  signupBonusCredits: number;
  requireEmailVerification: boolean;
  guestStarterAgentId: string | null;
  newUserStarterTemplateId: string | null;
};

type AdminAgentOption = {
  id: string;
  name: string;
  modelId: string | null;
  catalogStatus: string;
};

type AdminAgentsResponse = {
  agents: AdminAgentOption[];
};

export default function AdminSettingsPage() {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Settings | null>(null);

  const { data: settings, isLoading } = useQuery<Settings>({
    queryKey: ['admin', 'settings'],
    queryFn: async () => {
      const res = await fetch('/api/admin/settings');
      if (!res.ok) throw new Error('Failed to load settings');
      return res.json();
    },
  });
  const { data: adminAgentsData } = useQuery<AdminAgentsResponse>({
    queryKey: ['admin', 'agents', 'options'],
    queryFn: async () => {
      const res = await fetch('/api/admin/agents');
      if (!res.ok) throw new Error('Failed to load starter agents');
      return res.json() as Promise<AdminAgentsResponse>;
    },
  });

  // Initialise draft from server data once (never override user's edits)
  useEffect(() => {
    if (settings && draft === null) {
      setDraft(settings);
    }
  }, [settings, draft]);

  const mutation = useMutation({
    mutationFn: async (patch: Partial<Settings>) => {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<Settings>;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['admin', 'settings'], data);
      setDraft(data);
    },
  });

  const current = draft ?? settings;

  if (isLoading || !current) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Platform Settings</h1>
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  const handleSave = () => mutation.mutate(current);

  const set = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev));

  const isDirty = settings && JSON.stringify(draft) !== JSON.stringify(settings);
  const starterAgentOptions = adminAgentsData?.agents ?? [];
  const publishedStarterAgentOptions = starterAgentOptions.filter((agent) => agent.catalogStatus === 'published');
  const guestStarterOptions = publishedStarterAgentOptions;
  const newUserStarterOptions = publishedStarterAgentOptions;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Platform Settings</h1>
          <p className="text-sm text-muted-foreground">
            Configure guest access and signup credit policies.
          </p>
        </div>
        <Button onClick={handleSave} disabled={!isDirty || mutation.isPending}>
          <SaveIcon className="mr-2 size-4" />
          {mutation.isPending ? 'Saving…' : 'Save changes'}
        </Button>
      </div>

      {mutation.isError && (
        <p className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {mutation.error instanceof Error ? mutation.error.message : 'Save failed'}
        </p>
      )}

      {/* Guest Access */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UsersIcon className="size-4" />
            Guest Access
          </CardTitle>
          <CardDescription>
            Allow unauthenticated visitors to use the chat with a limited credit pool.
            Anti-abuse: one free session per IP per 24 hours.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Enable guest access</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                When off, unauthenticated users are redirected to sign-in.
              </p>
            </div>
            <Switch
              checked={current.guestAccessEnabled}
              onCheckedChange={(v) => set('guestAccessEnabled', v)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="guestStartingCredits" className="text-sm font-medium">
                Starting credits per session
              </Label>
              <Input
                id="guestStartingCredits"
                type="number"
                min={0}
                max={10000}
                value={current.guestStartingCredits}
                onChange={(e) => set('guestStartingCredits', Number(e.target.value))}
                disabled={!current.guestAccessEnabled}
              />
              <p className="text-xs text-muted-foreground">Credits granted to each new guest session.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="guestSessionTtlDays" className="text-sm font-medium">
                Session lifetime (days)
              </Label>
              <Input
                id="guestSessionTtlDays"
                type="number"
                min={1}
                max={365}
                value={current.guestSessionTtlDays}
                onChange={(e) => set('guestSessionTtlDays', Number(e.target.value))}
                disabled={!current.guestAccessEnabled}
              />
              <p className="text-xs text-muted-foreground">How long a guest session cookie persists.</p>
            </div>
          </div>

          <div className="space-y-2 max-w-xl">
            <Label className="text-sm font-medium">Guest starter agent</Label>
            <Select
              value={current.guestStarterAgentId ?? '__none__'}
              onValueChange={(value) => set('guestStarterAgentId', value === '__none__' ? null : value)}
              disabled={!current.guestAccessEnabled}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose the published agent guests start with" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">No guest starter agent</SelectItem>
                {guestStarterOptions.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id}>
                    {agent.name}{agent.modelId ? ` — ${agent.modelId}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Guests will start with this published admin agent, and its configured model becomes the default chat model.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BotIcon className="size-4" />
            Starter Experience
          </CardTitle>
          <CardDescription>
            Choose which published admin template is cloned into a new user workspace on first load.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-w-xl">
            <Label className="text-sm font-medium">New user starter template</Label>
            <Select
              value={current.newUserStarterTemplateId ?? '__none__'}
              onValueChange={(value) => set('newUserStarterTemplateId', value === '__none__' ? null : value)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose the published template new users receive" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">No starter template</SelectItem>
                {newUserStarterOptions.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id}>
                    {agent.name}{agent.modelId ? ` — ${agent.modelId}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              When a signed-in user has no agents yet, Vaja clones this published template into their workspace and uses its model by default.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Signup Bonus */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <GiftIcon className="size-4" />
            Signup Bonus
          </CardTitle>
          <CardDescription>
            Credits granted automatically when a new user registers.
            Set to 0 to disable.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-w-xs">
            <Label htmlFor="signupBonusCredits" className="text-sm font-medium">
              Welcome credits
            </Label>
            <Input
              id="signupBonusCredits"
              type="number"
              min={0}
              max={100000}
              value={current.signupBonusCredits}
              onChange={(e) => set('signupBonusCredits', Number(e.target.value))}
            />
            <p className="text-xs text-muted-foreground">Applied to all new registrations going forward.</p>
          </div>
        </CardContent>
      </Card>

      {/* Registration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MailCheckIcon className="size-4" />
            Registration
          </CardTitle>
          <CardDescription>
            Controls how new users are verified after they sign up with email and password.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Require email verification</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                When on, new users must click a verification link before accessing the app.
                When off, accounts are verified automatically on signup.
              </p>
            </div>
            <Switch
              checked={current.requireEmailVerification}
              onCheckedChange={(v) => set('requireEmailVerification', v)}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
