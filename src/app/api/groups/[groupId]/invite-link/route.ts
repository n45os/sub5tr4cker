import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { auth } from "@/lib/auth";
import { dbConnect } from "@/lib/db/mongoose";
import { Group } from "@/models";
import { getSetting } from "@/lib/settings/service";
import { generateUniqueInviteCode } from "@/lib/invite-code";
import { z } from "zod";

const toggleSchema = z.object({
  enabled: z.boolean(),
});

async function getAppUrl(request: NextRequest): Promise<string> {
  const fromSetting = await getSetting("general.appUrl");
  if (fromSetting) return fromSetting.replace(/\/$/, "");
  return new URL(request.url).origin;
}

async function ensureAdminGroup(
  groupId: string
): Promise<{ error: NextResponse } | { group: InstanceType<typeof Group> }> {
  if (!mongoose.isValidObjectId(groupId)) {
    return {
      error: NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Invalid group id" } },
        { status: 400 }
      ),
    };
  }
  await dbConnect();
  const group = await Group.findById(groupId);
  if (!group || !group.isActive) {
    return {
      error: NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Group not found" } },
        { status: 404 }
      ),
    };
  }
  return { group };
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ groupId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
      { status: 401 }
    );
  }

  const { groupId } = await context.params;
  const result = await ensureAdminGroup(groupId);
  if ("error" in result) return result.error;
  const { group } = result;

  if (group.admin.toString() !== session.user.id) {
    return NextResponse.json(
      {
        error: {
          code: "FORBIDDEN",
          message: "Only the admin can view invite link settings",
        },
      },
      { status: 403 }
    );
  }

  const appUrl = await getAppUrl(request);
  const inviteLinkEnabled = group.inviteLinkEnabled ?? false;
  const inviteCode = group.inviteCode ?? null;
  const inviteUrl =
    inviteCode && inviteLinkEnabled
      ? `${appUrl}/invite/${inviteCode}`
      : null;

  return NextResponse.json({
    data: {
      inviteLinkEnabled,
      inviteCode,
      inviteUrl,
    },
  });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ groupId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
      { status: 401 }
    );
  }

  const { groupId } = await context.params;
  const result = await ensureAdminGroup(groupId);
  if ("error" in result) return result.error;
  const { group } = result;

  if (group.admin.toString() !== session.user.id) {
    return NextResponse.json(
      {
        error: {
          code: "FORBIDDEN",
          message: "Only the admin can create or rotate the invite link",
        },
      },
      { status: 403 }
    );
  }

  const code = await generateUniqueInviteCode(async (c) => {
    const existing = await Group.findOne({ inviteCode: c }).lean();
    return !!existing;
  });

  group.inviteCode = code;
  group.inviteLinkEnabled = true;
  await group.save();

  const appUrl = await getAppUrl(request);
  const inviteUrl = `${appUrl}/invite/${code}`;

  return NextResponse.json({
    data: {
      inviteCode: code,
      inviteLinkEnabled: true,
      inviteUrl,
    },
  });
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ groupId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
      { status: 401 }
    );
  }

  const { groupId } = await context.params;
  const result = await ensureAdminGroup(groupId);
  if ("error" in result) return result.error;
  const { group } = result;

  if (group.admin.toString() !== session.user.id) {
    return NextResponse.json(
      {
        error: {
          code: "FORBIDDEN",
          message: "Only the admin can toggle the invite link",
        },
      },
      { status: 403 }
    );
  }

  const parsed = toggleSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid request body",
          details: parsed.error.flatten(),
        },
      },
      { status: 400 }
    );
  }

  group.inviteLinkEnabled = parsed.data.enabled;
  await group.save();

  const appUrl = await getAppUrl(request);
  const inviteUrl =
    group.inviteCode && group.inviteLinkEnabled
      ? `${appUrl}/invite/${group.inviteCode}`
      : null;

  return NextResponse.json({
    data: {
      inviteLinkEnabled: group.inviteLinkEnabled,
      inviteCode: group.inviteCode,
      inviteUrl,
    },
  });
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ groupId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
      { status: 401 }
    );
  }

  const { groupId } = await context.params;
  const result = await ensureAdminGroup(groupId);
  if ("error" in result) return result.error;
  const { group } = result;

  if (group.admin.toString() !== session.user.id) {
    return NextResponse.json(
      {
        error: {
          code: "FORBIDDEN",
          message: "Only the admin can destroy the invite link",
        },
      },
      { status: 403 }
    );
  }

  group.inviteCode = null;
  group.inviteLinkEnabled = false;
  await group.save();

  return NextResponse.json({
    data: { inviteCode: null, inviteLinkEnabled: false, inviteUrl: null },
  });
}
