'use client';

import type { ReactNode } from 'react';
import { Loader2Icon, SparklesIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

type AiAssistButtonProps = {
  onClick: () => void;
  disabled?: boolean;
  isLoading?: boolean;
  idleLabel: string;
  loadingLabel: string;
  icon?: ReactNode;
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
};

export function AiAssistButton({
  onClick,
  disabled,
  isLoading = false,
  idleLabel,
  loadingLabel,
  icon,
  variant = 'outline',
  size = 'sm',
  className,
}: AiAssistButtonProps) {
  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className ?? 'gap-1.5'}
      onClick={onClick}
      disabled={disabled || isLoading}
    >
      {isLoading ? <Loader2Icon className="size-3.5 animate-spin" /> : (icon ?? <SparklesIcon className="size-3.5" />)}
      {isLoading ? loadingLabel : idleLabel}
    </Button>
  );
}
