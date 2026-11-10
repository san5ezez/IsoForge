export function formatBytes(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const units = ["Б", "КБ", "МБ", "ГБ", "ТБ"];
  let value = n;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  const digits = index === 0 ? 0 : value >= 100 ? 0 : 1;
  return `${value.toFixed(digits)} ${units[index]}`;
}

export function formatWhen(ms: number): string {
  const date = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(date.getUTCDate())}.${p(date.getUTCMonth() + 1)}.${date.getUTCFullYear()} ${p(date.getUTCHours())}:${p(date.getUTCMinutes())}`;
}

export function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 8000);
}

export const MEDIA = [
  { id: "cd700", label: "CD 700 МБ", bytes: 700 * 1024 * 1024 },
  { id: "dvd47", label: "DVD 4.7 ГБ", bytes: 4707319808 },
  { id: "dvd85", label: "DVD 8.5 ГБ", bytes: 8543666176 },
] as const;

export type MediaId = (typeof MEDIA)[number]["id"];

export function mediaById(id: MediaId) {
  return MEDIA.find((item) => item.id === id) ?? MEDIA[1];
}
