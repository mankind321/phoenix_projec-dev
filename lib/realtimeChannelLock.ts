let hasRealtimeChannel = false;

export function acquireRealtimeChannel() {
  if (hasRealtimeChannel) return false;
  hasRealtimeChannel = true;
  return true;
}

export function releaseRealtimeChannel() {
  hasRealtimeChannel = false;
}