import { BloodGroup } from "@prisma/client";

/**
 * Standard transfusion compatibility: for each RECIPIENT group, which donor
 * groups are safe. O_NEGATIVE is the universal donor; AB_POSITIVE is the
 * universal recipient.
 */
const COMPATIBLE_DONORS: Record<BloodGroup, BloodGroup[]> = {
  [BloodGroup.O_NEGATIVE]: [BloodGroup.O_NEGATIVE],
  [BloodGroup.O_POSITIVE]: [BloodGroup.O_NEGATIVE, BloodGroup.O_POSITIVE],
  [BloodGroup.A_NEGATIVE]: [BloodGroup.O_NEGATIVE, BloodGroup.A_NEGATIVE],
  [BloodGroup.A_POSITIVE]: [
    BloodGroup.O_NEGATIVE,
    BloodGroup.O_POSITIVE,
    BloodGroup.A_NEGATIVE,
    BloodGroup.A_POSITIVE,
  ],
  [BloodGroup.B_NEGATIVE]: [BloodGroup.O_NEGATIVE, BloodGroup.B_NEGATIVE],
  [BloodGroup.B_POSITIVE]: [
    BloodGroup.O_NEGATIVE,
    BloodGroup.O_POSITIVE,
    BloodGroup.B_NEGATIVE,
    BloodGroup.B_POSITIVE,
  ],
  [BloodGroup.AB_NEGATIVE]: [
    BloodGroup.O_NEGATIVE,
    BloodGroup.A_NEGATIVE,
    BloodGroup.B_NEGATIVE,
    BloodGroup.AB_NEGATIVE,
  ],
  [BloodGroup.AB_POSITIVE]: Object.values(BloodGroup), // universal recipient
};

/** Donor blood groups that may safely donate to a patient needing `recipientGroup`. */
export function getCompatibleDonorGroups(recipientGroup: BloodGroup): BloodGroup[] {
  return COMPATIBLE_DONORS[recipientGroup];
}
