import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/db/mongoose";
import { Group } from "@/models";

/**
 * Public endpoint: resolve invite code and return group preview + join availability.
 * No auth required.
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ inviteCode: string }> }
) {
  const { inviteCode } = await context.params;
  const code = (inviteCode ?? "").trim();
  if (!code) {
    return NextResponse.json(
      {
        error: {
          code: "INVITE_INVALID",
          message: "Invalid invite code",
        },
      },
      { status: 400 }
    );
  }

  await dbConnect();
  const group = await Group.findOne({ inviteCode: code }).lean();
  if (!group) {
    return NextResponse.json(
      {
        error: {
          code: "INVITE_INVALID",
          message: "Invite link not found or has been revoked",
        },
      },
      { status: 404 }
    );
  }

  if (!group.isActive) {
    return NextResponse.json(
      {
        error: {
          code: "GROUP_INACTIVE",
          message: "This group is no longer active",
        },
      },
      { status: 404 }
    );
  }

  const inviteLinkEnabled = group.inviteLinkEnabled ?? false;
  const canJoin = !!group.inviteCode && inviteLinkEnabled;

  return NextResponse.json({
    data: {
      groupId: group._id.toString(),
      name: group.name,
      description: group.description,
      service: group.service,
      billing: {
        currentPrice: group.billing.currentPrice,
        currency: group.billing.currency,
        cycleType: group.billing.cycleType,
      },
      canJoin,
      inviteLinkEnabled,
    },
  });
}
