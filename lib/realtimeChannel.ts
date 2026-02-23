let hasActiveChannel = false;

export function canCreateChannel() {
  if (hasActiveChannel) return false;
  hasActiveChannel = true;
  return true;
}