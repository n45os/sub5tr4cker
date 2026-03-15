import { dbConnect } from "@/lib/db/mongoose";
import { Group } from "@/models";
import { createPeriodIfDue } from "@/lib/billing/periods";

// create billing period entries for groups that are due
export async function checkBillingPeriods(): Promise<void> {
  await dbConnect();

  const now = new Date();
  const activeGroups = await Group.find({ isActive: true });

  for (const group of activeGroups) {
    try {
      const created = await createPeriodIfDue(group, now);
      if (created) {
        console.log(`created billing period for group ${group.name}`);
      }
    } catch (error) {
      console.error(`error creating period for group ${group._id}:`, error);
    }
  }
}
