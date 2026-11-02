type PropertyOwnershipDetails = {
  advertiserId?: string | null;
  userId?: string | null;
  ownerId?: string | null;
  advertiser?: { id?: string | null } | null;
};

type PropertyCreatorDetails = {
  creatorSessionId?: unknown;
  creatorEmail?: unknown;
  creatorPhone?: unknown;
};

export function isPropertyOwnedByUser(
  property: PropertyOwnershipDetails,
  userId?: string | null
): boolean {
  return Boolean(
    userId &&
      [property.advertiserId, property.advertiser?.id, property.userId, property.ownerId].includes(userId)
  );
}

export function isPropertyCreatedByUser(
  creator: PropertyCreatorDetails,
  userIds: ReadonlySet<string>,
  userEmail?: string | null
): boolean {
  const creatorSessionId =
    typeof creator.creatorSessionId === "string" ? creator.creatorSessionId.trim() : "";
  if (creatorSessionId && userIds.has(creatorSessionId)) return true;

  const creatorEmail =
    typeof creator.creatorEmail === "string" ? creator.creatorEmail.trim().toLowerCase() : "";
  const normalizedUserEmail = userEmail?.trim().toLowerCase();
  return Boolean(creatorEmail && normalizedUserEmail && creatorEmail === normalizedUserEmail);
}
