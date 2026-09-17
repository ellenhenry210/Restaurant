const EARTH_RADIUS_METERS = 6_371_000;

function toRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

/**
 * Great-circle distance between two lat/long points, in meters, via the
 * Haversine formula. Accurate enough for "is this guest at the
 * restaurant" (errors are on the order of centimeters at this scale) —
 * nothing about this use case needs a more precise (and more complex)
 * geodesic model.
 *
 * @param {{ latitude: number, longitude: number }} a
 * @param {{ latitude: number, longitude: number }} b
 * @returns {number} distance in meters
 */
export function distanceMeters(a, b) {
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const deltaLat = toRadians(b.latitude - a.latitude);
  const deltaLon = toRadians(b.longitude - a.longitude);

  const h =
    Math.sin(deltaLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));

  return EARTH_RADIUS_METERS * c;
}

/**
 * Is `point` within `radiusMeters` of `center`? The core check behind
 * guest proximity gating (routes/guestSession.js) — split out as its own
 * function so the "how far is X from Y" math and the "is that close
 * enough" policy decision are two separately testable things.
 */
export function isWithinRadius(point, center, radiusMeters) {
  return distanceMeters(point, center) <= radiusMeters;
}
