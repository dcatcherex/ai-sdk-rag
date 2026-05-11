import type { RichMessageInstance } from '@/features/rich-messages/types';
import { RichMessageCard } from '@/features/rich-messages/components/rich-message-card';

type RichMessagePartProps = {
  instance: RichMessageInstance;
};

export function RichMessagePart({ instance }: RichMessagePartProps) {
  return <RichMessageCard instance={instance} />;
}
