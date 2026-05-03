import {
  MemberGroupExperience,
  type MemberGroupExperienceGroup,
  type MemberGroupExperiencePeriod,
} from "@/components/features/groups/member-group-experience";

export type MemberGroupViewGroup = MemberGroupExperienceGroup;
export type MemberGroupViewPeriod = MemberGroupExperiencePeriod;

interface MemberGroupViewProps {
  group: MemberGroupViewGroup;
  periods: MemberGroupViewPeriod[];
  currentMemberId: string | null;
  /** portal token for unauthenticated member actions */
  memberToken?: string;
  initialPayPeriodId?: string | null;
  initialOpenConfirm?: boolean;
}

/** Thin wrapper around MemberGroupExperience that translates legacy props into the identity shape. */
export function MemberGroupView({
  group,
  periods,
  currentMemberId,
  memberToken,
  initialPayPeriodId,
  initialOpenConfirm,
}: MemberGroupViewProps) {
  return (
    <MemberGroupExperience
      group={group}
      billingPeriods={periods}
      identity={{
        type: memberToken ? "portal" : "session",
        id: currentMemberId ?? group.myMembership?._id ?? "",
        displayName: group.myMembership?.nickname ?? "Member",
        token: memberToken,
      }}
      initialPayPeriodId={initialPayPeriodId}
      initialOpenConfirm={initialOpenConfirm}
    />
  );
}
