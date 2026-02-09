export const exportConversation = async (
  threadId: string,
  format: 'json' | 'markdown'
) => {
  const response = await fetch(
    `/api/threads/${threadId}/export?format=${format}`
  );
  if (!response.ok) {
    throw new Error('Export failed');
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `conversation-${threadId}.${format === 'json' ? 'json' : 'md'}`;
  document.body.appendChild(anchor);
  anchor.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(anchor);
};
