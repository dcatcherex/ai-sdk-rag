export const formatRelativeTime = (timestamp: number) => {
  const diffMs = Date.now() - timestamp;
  if (diffMs < 60 * 1000) {
    return 'Just now';
  }
  if (diffMs < 60 * 60 * 1000) {
    return `${Math.floor(diffMs / (60 * 1000))}m ago`;
  }
  if (diffMs < 24 * 60 * 60 * 1000) {
    return `${Math.floor(diffMs / (60 * 60 * 1000))}h ago`;
  }

  return `${Math.floor(diffMs / (24 * 60 * 60 * 1000))}d ago`;
};
