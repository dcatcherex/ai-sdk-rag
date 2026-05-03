export type DeductUserCreditsFn = (options: {
  userId: string;
  amount: number;
  description?: string;
}) => Promise<{ balance: number; success: boolean }>;

export type DeductGuestCreditsFn = (
  guestSessionId: string,
  amount: number,
) => Promise<{ success: boolean; balance: number }>;

export function buildChatBillingDescription(resolvedModel: string, threadId: string): string {
  return `Chat: ${resolvedModel} (thread ${threadId})`;
}

export async function finalizeChatBilling(input: {
  userId: string | null;
  guestSessionId?: string | null;
  creditCost: number;
  resolvedModel: string;
  threadId: string;
  deductUserCredits: DeductUserCreditsFn;
  deductGuestCredits: DeductGuestCreditsFn;
  logError?: (message: string, error: unknown) => void;
}): Promise<void> {
  const {
    userId,
    guestSessionId,
    creditCost,
    resolvedModel,
    threadId,
    deductUserCredits,
    deductGuestCredits,
    logError = (message, error) => console.error(message, error),
  } = input;

  if (userId) {
    await deductUserCredits({
      userId,
      amount: creditCost,
      description: buildChatBillingDescription(resolvedModel, threadId),
    }).catch((error: unknown) => logError('Failed to deduct credits:', error));
    return;
  }

  if (guestSessionId) {
    await deductGuestCredits(guestSessionId, creditCost)
      .catch((error: unknown) => logError('Failed to deduct guest credits:', error));
  }
}
