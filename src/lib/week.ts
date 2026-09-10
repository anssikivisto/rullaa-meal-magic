export function startOfWeek(base = new Date()): Date {
  const d = new Date(base);
  d.setHours(12, 0, 0, 0);
  const day = (d.getDay() + 6) % 7; // 0 = monday
  d.setDate(d.getDate() - day);
  return d;
}

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function weekDates(offsetWeeks = 0): string[] {
  const start = startOfWeek();
  start.setDate(start.getDate() + offsetWeeks * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return toISODate(d);
  });
}

export function shortDate(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${Number(d)}.${Number(m)}.`;
}
