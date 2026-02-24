export function calculateStaffApproxDeadline(createdAt: string, clientDeadlineDate: string | null): string | null {
  if (!clientDeadlineDate) return null;
  const start = new Date(createdAt).getTime();
  const end = new Date(clientDeadlineDate).getTime();
  
  if (isNaN(start) || isNaN(end)) return null;
  
  const duration = end - start;
  if (duration <= 0) return clientDeadlineDate; // If deadline is before creation, just return deadline
  
  const approxEnd = start + duration * 0.8;
  return new Date(approxEnd).toISOString().slice(0, 10);
}
