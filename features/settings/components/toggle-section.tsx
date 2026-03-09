import type { LucideIcon } from 'lucide-react';
import { Switch } from '@/components/ui/switch';

type Props = {
  id: string;
  icon: LucideIcon;
  title: string;
  description: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
};

export function ToggleSection({ id, icon: Icon, title, description, checked, onCheckedChange }: Props) {
  return (
    <section>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Icon className="size-5 text-muted-foreground" />
          <h3 className="text-base font-semibold">{title}</h3>
        </div>
        <div className="flex items-center gap-3">
          <label htmlFor={id} className="text-sm text-muted-foreground">
            {checked ? 'On' : 'Off'}
          </label>
          <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
        </div>
      </div>
      <p className="text-sm text-muted-foreground">{description}</p>
    </section>
  );
}
