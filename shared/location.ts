export function parseCoordinates(value: string): { latitude: string; longitude: string } | null {
  const normalized = value.trim().replace(/[，;]/g, ",");
  const numbers = normalized.match(/[-+]?\d+(?:[.,]\d+)?/g)?.map(item => Number(item.replace(",", "."))) ?? [];
  if (numbers.length < 2 || !Number.isFinite(numbers[0]) || !Number.isFinite(numbers[1])) return null;
  const [latitude, longitude] = numbers;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  return { latitude: latitude.toFixed(7).replace(/0+$/, "").replace(/\.$/, ""), longitude: longitude.toFixed(7).replace(/0+$/, "").replace(/\.$/, "") };
}
