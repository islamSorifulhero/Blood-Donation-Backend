import { BloodRequest, NotificationType, Prisma, RequestStatus, UrgencyLevel } from "@prisma/client";
import { getCompatibleDonorGroups } from "../../utils/bloodCompatibility";
import { haversineDistanceKm } from "../../utils/geo";
import { createNotification } from "../../utils/notify";

type TxClient = Prisma.TransactionClient;

// Wider search radius for more urgent requests
const URGENCY_RADIUS_KM: Record<UrgencyLevel, number> = {
  LOW: 15,
  MEDIUM: 25,
  HIGH: 40,
  CRITICAL: 75,
};

// Standard minimum gap between whole-blood donations
const DONATION_ELIGIBILITY_DAYS = 90;

// Cap fan-out per request so a single request can't spam the entire donor base
const MAX_MATCHES_PER_REQUEST = 50;

/**
 * Finds compatible, available, location-eligible donors for a verified blood
 * request, creates RequestMatch rows (skipping anyone already matched — this
 * is what prevents duplicate donor assignment), and fans out notifications.
 * Must be called inside a transaction so match-creation and the request's
 * status update are atomic.
 */
export async function matchDonorsToRequest(
  tx: TxClient,
  request: BloodRequest
): Promise<{ matchedCount: number }> {
  const compatibleGroups = getCompatibleDonorGroups(request.bloodGroup);
  const eligibleSince = new Date(Date.now() - DONATION_ELIGIBILITY_DAYS * 24 * 60 * 60 * 1000);

  const alreadyMatched = await tx.requestMatch.findMany({
    where: { bloodRequestId: request.id },
    select: { donorProfileId: true },
  });
  const excludeIds = alreadyMatched.map((m) => m.donorProfileId);

  const candidates = await tx.donorProfile.findMany({
    where: {
      deletedAt: null,
      bloodGroup: { in: compatibleGroups },
      isAvailable: true,
      id: { notIn: excludeIds },
      OR: [{ lastDonationDate: null }, { lastDonationDate: { lte: eligibleSince } }],
      user: { isActive: true },
    },
    select: { id: true, userId: true, latitude: true, longitude: true },
  });

  const radiusKm = URGENCY_RADIUS_KM[request.urgency];
  const ranked = candidates
    .map((donor) => ({
      donor,
      distanceKm: haversineDistanceKm(request.latitude, request.longitude, donor.latitude, donor.longitude),
    }))
    .filter((c) => c.distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, MAX_MATCHES_PER_REQUEST);

  if (ranked.length === 0) {
    return { matchedCount: 0 };
  }

  // skipDuplicates relies on the @@unique([bloodRequestId, donorProfileId]) constraint
  // as a second line of defense against duplicate assignment.
  await tx.requestMatch.createMany({
    data: ranked.map((r) => ({ bloodRequestId: request.id, donorProfileId: r.donor.id })),
    skipDuplicates: true,
  });

  for (const r of ranked) {
    await createNotification(tx, {
      userId: r.donor.userId,
      type: NotificationType.BLOOD_REQUEST_MATCH,
      title: `${request.urgency} blood request needs your help`,
      message: `A patient needs ${request.unitsNeeded} unit(s) of ${request.bloodGroup.replace(
        "_",
        " "
      )} blood in ${request.city} (~${r.distanceKm.toFixed(1)} km away). Please respond if you're available.`,
      bloodRequestId: request.id,
    });
  }

  await tx.bloodRequest.update({
    where: { id: request.id },
    data: { status: RequestStatus.MATCHING },
  });

  return { matchedCount: ranked.length };
}
