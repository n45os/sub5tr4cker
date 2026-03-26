import { createPeriodIfDue } from "@/lib/billing/periods";
import { db } from "@/lib/storage";

// create billing period entries for groups that are due
export async function checkBillingPeriods(): Promise<void> {
  const store = await db();
  const now = new Date();
  const activeGroups = await store.listAllActiveGroups();

  for (const group of activeGroups) {
    try {
      const created = await createPeriodIfDue(group, now);
      if (created) {
        console.log(`created billing period for group ${group.name}`);
      }
    } catch (error) {
      console.error(`error creating period for group ${group.id}:`, error);
    }
  }
}
