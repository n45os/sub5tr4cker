interface RecipientIdentity {
  memberId: string;
  memberEmail?: string | null;
  memberNickname?: string | null;
  memberUserId?: string | null;
}

/** normalize member email so the same person groups together across groups/casing */
export function normalizeMemberEmailForAggregation(email: string | null | undefined): string {
  return (email ?? "").trim().toLowerCase();
}

export function getRecipientKey(identity: RecipientIdentity): string {
  if (identity.memberUserId) {
    return `user:${identity.memberUserId}`;
  }

  const normalizedEmail = normalizeMemberEmailForAggregation(identity.memberEmail);
  if (normalizedEmail) {
    return `email:${normalizedEmail}`;
  }

  return `member:${identity.memberId}`;
}

export function getRecipientLabel(identity: RecipientIdentity): string {
  const email = identity.memberEmail?.trim();
  if (email) {
    return email;
  }

  const nickname = identity.memberNickname?.trim();
  if (nickname) {
    return `${nickname} (Telegram only)`;
  }

  return `member ${identity.memberId}`;
}
