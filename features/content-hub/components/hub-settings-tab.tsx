'use client';

import { Button } from '@/components/ui/button';
import { useAccounts } from '@/features/content-marketing/hooks/use-accounts';

export function HubSettingsTab() {
  const { connectedAccounts, disconnectMutation } = useAccounts();

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-2xl space-y-6">
        <div>
          <h2 className="text-base font-semibold">Social Accounts</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Connect your social accounts to publish posts directly. Meta connects both Facebook and Instagram.
          </p>
        </div>

        <div className="space-y-3">
          {(['meta', 'tiktok'] as const).map((oauthPlatform) => {
            const connectedForPlatform = connectedAccounts.filter((a) =>
              oauthPlatform === 'meta'
                ? a.platform === 'instagram' || a.platform === 'facebook'
                : a.platform === 'tiktok',
            );
            const isAnyConnected = connectedForPlatform.length > 0;
            return (
              <div key={oauthPlatform} className="flex items-center justify-between rounded-xl border p-4">
                <div>
                  <p className="text-sm font-medium">
                    {oauthPlatform === 'meta' ? 'Meta (Facebook + Instagram)' : 'TikTok'}
                  </p>
                  {isAnyConnected && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {connectedForPlatform.map((a) => a.accountName).join(', ')}
                    </p>
                  )}
                </div>
                <Button
                  size="sm"
                  variant={isAnyConnected ? 'outline' : 'default'}
                  onClick={() => {
                    window.location.href = `/api/social/connect/${oauthPlatform}?returnTo=${encodeURIComponent('/content?tab=settings')}`;
                  }}
                >
                  {isAnyConnected ? 'Reconnect' : 'Connect'}
                </Button>
              </div>
            );
          })}
        </div>

        {connectedAccounts.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wide">Connected Accounts</p>
            <div className="space-y-2">
              {connectedAccounts.map((account) => (
                <div key={account.id} className="flex items-center justify-between rounded-lg border px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className={`h-2 w-2 rounded-full ${account.isActive ? 'bg-green-500' : 'bg-zinc-400'}`} />
                    <div>
                      <p className="text-sm font-medium">{account.accountName}</p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {account.platform}{account.accountType && ` · ${account.accountType}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {account.tokenExpiresAt && (
                      <p className="text-[11px] text-muted-foreground">
                        Expires {new Date(account.tokenExpiresAt).toLocaleDateString()}
                      </p>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                      onClick={() => disconnectMutation.mutate(account.id)}
                      disabled={disconnectMutation.isPending}
                    >
                      Disconnect
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
