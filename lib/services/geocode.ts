/* eslint-disable @typescript-eslint/no-explicit-any */
const GEO_CACHE = new Map<string, any>();
const GEO_CACHE_TTL = 7 * 24 * 60 * 60 * 1000;

export async function geocodeLocation(location: string) {
  const key = location.toLowerCase();

  const cached = GEO_CACHE.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached;

  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(location)}&key=${process.env.GOOGLE_MAPS_SERVER_KEY}`;

  const res = await fetch(url);
  const json = await res.json();

  if (json.status !== "OK") return null;

  const entry = {
    lat: json.results[0].geometry.location.lat,
    lng: json.results[0].geometry.location.lng,
    expiresAt: Date.now() + GEO_CACHE_TTL,
  };

  GEO_CACHE.set(key, entry);

  return entry;
}