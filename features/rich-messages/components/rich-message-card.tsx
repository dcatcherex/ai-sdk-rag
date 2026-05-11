import { renderRichMessageForWeb, getRichMessageToneClasses } from '@/features/rich-messages/adapters/web';
import type { RichMessageInstance } from '@/features/rich-messages/types';

type RichMessageCardProps = {
  instance: RichMessageInstance;
};

export function RichMessageCard({ instance }: RichMessageCardProps) {
  const viewModel = renderRichMessageForWeb(instance);
  const toneClasses = getRichMessageToneClasses(viewModel.tone);

  return (
    <div className={`mt-2 max-w-[28rem] overflow-hidden rounded-xl border shadow-sm ${toneClasses.border}`}>
      <div className={`h-1 w-full ${toneClasses.accent}`} />
      <div className="flex flex-col gap-3 p-4">
        {viewModel.eyebrow ? (
          <div className="flex items-center gap-2">
            <span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-medium ${toneClasses.badge}`}>
              {viewModel.eyebrow}
            </span>
          </div>
        ) : null}

        <div className="space-y-1">
          <h4 className="text-sm font-semibold text-foreground">{viewModel.title}</h4>
          {viewModel.summary ? (
            <p className="text-sm leading-6 text-muted-foreground">{viewModel.summary}</p>
          ) : null}
        </div>

        {viewModel.sections.length > 0 ? (
          <div className="space-y-3">
            {viewModel.sections.map((section) => (
              <div key={`${section.label}:${section.value}`} className="space-y-1">
                <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                  {section.label}
                </div>
                <div className="text-sm leading-6 text-foreground">{section.value}</div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
