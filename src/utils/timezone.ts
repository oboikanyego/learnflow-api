export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

type DateParts = { year: number; month: number; day: number; hour: number; minute: number; second: number };

function zonedParts(timestamp: number, timeZone: string): DateParts {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(new Date(timestamp));
  const values = Object.fromEntries(parts.filter(p => p.type !== 'literal').map(p => [p.type, Number(p.value)]));
  return { year: values.year!, month: values.month!, day: values.day!, hour: values.hour!, minute: values.minute!, second: values.second! };
}

function zoneOffsetMs(timestamp: number, timeZone: string): number {
  const parts = zonedParts(timestamp, timeZone);
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) - timestamp;
}

export function localDateTimeToUtc(date: string, time: string, timeZone: string): Date | undefined {
  if (!isValidTimeZone(timeZone)) return undefined;
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());
  const timeMatch = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/.exec(time.trim());
  if (!dateMatch || !timeMatch) return undefined;

  const desired: DateParts = {
    year: Number(dateMatch[1]), month: Number(dateMatch[2]), day: Number(dateMatch[3]),
    hour: Number(timeMatch[1]), minute: Number(timeMatch[2]), second: Number(timeMatch[3] ?? 0)
  };
  const wallClockAsUtc = Date.UTC(desired.year, desired.month - 1, desired.day, desired.hour, desired.minute, desired.second);
  let candidate = wallClockAsUtc - zoneOffsetMs(wallClockAsUtc, timeZone);
  candidate = wallClockAsUtc - zoneOffsetMs(candidate, timeZone);

  const actual = zonedParts(candidate, timeZone);
  if (Object.keys(desired).some(key => actual[key as keyof DateParts] !== desired[key as keyof DateParts])) return undefined;
  return new Date(candidate);
}
