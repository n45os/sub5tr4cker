/** normalize member email so the same person groups together across groups/casing */
export function normalizeMemberEmailForAggregation(email: string): string {
  return email.trim().toLowerCase();
}
