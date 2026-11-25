export type SiteLocation = { lat?: number; lng?: number; label?: string };

/** Extracts coordinates from "41.3, 69.2" or a Google/Yandex maps link. */
export function parseCoordinates(input: string): { lat: number; lng: number } | null {
  const s = decodeURIComponent(input.trim());
  const patterns = [/@(-?\d+\.\d+),(-?\d+\.\d+)/, /[?&](?:q|ll|query)=(-?\d+\.\d+),\s*(-?\d+\.\d+)/, /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/, /^(-?\d+(?:\.\d+)?)\s*[,; ]\s*(-?\d+(?:\.\d+)?)$/];
  for (const p of patterns) {
    const m = s.match(p);
    if (m) {
      const lat = Number(m[1]), lng = Number(m[2]);
      if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat, lng };
    }
  }
  return null;
}

export function hasLocation(l: SiteLocation | null | undefined): l is { lat: number; lng: number; label?: string } {
  return !!l && typeof l.lat === "number" && typeof l.lng === "number";
}

export function osmEmbedUrl(lat: number, lng: number) {
  const d = 0.006;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${lng - d}%2C${lat - d}%2C${lng + d}%2C${lat + d}&layer=mapnik&marker=${lat}%2C${lng}`;
}

export function directionsLinks(lat: number, lng: number) {
  return {
    google: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
    yandex: `https://yandex.uz/maps/?rtext=~${lat},${lng}&rtt=auto`,
  };
}
