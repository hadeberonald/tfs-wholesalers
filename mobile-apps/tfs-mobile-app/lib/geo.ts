const EARTH_RADIUS_KM = 6371;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Straight-line (great-circle) distance between two lat/lng points, in km.
 * Good enough for "which branch is the customer near" - no need for
 * driving-distance APIs here.
 */
export function haversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_KM * c;
}

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

/**
 * Generic nearest-point-within-radius resolver. Works against whatever
 * shape you pass in (e.g. live branch objects from the API) as long as
 * each candidate has latitude/longitude. Returns null if nothing is
 * within radiusKm - caller should fall back to the default/neutral icon.
 */
export function findNearestWithinRadius<T extends GeoPoint>(
  point: GeoPoint,
  candidates: T[],
  radiusKm: number
): T | null {
  let nearest: T | null = null;
  let nearestDistanceKm = Infinity;

  for (const candidate of candidates) {
    const distanceKm = haversineDistanceKm(
      point.latitude,
      point.longitude,
      candidate.latitude,
      candidate.longitude
    );

    if (distanceKm < nearestDistanceKm) {
      nearestDistanceKm = distanceKm;
      nearest = candidate;
    }
  }

  if (nearest && nearestDistanceKm <= radiusKm) {
    return nearest;
  }

  return null;
}