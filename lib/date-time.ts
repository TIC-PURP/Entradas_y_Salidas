const ODOO_DISPLAY_TIME_ZONE = process.env.NEXT_PUBLIC_ODOO_TIME_ZONE || "America/Mazatlan";

const odooDateTimePattern = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/;

export function parseOdooDateTime(value?: string) {
  if (!value) return null;

  const clean = value.trim();
  const match = clean.match(odooDateTimePattern);
  if (match) {
    const [, year, month, day, hour, minute, second = "0"] = match;
    return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second)));
  }

  const parsed = new Date(clean);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatOdooDateTime(value?: string) {
  const date = parseOdooDateTime(value);
  if (!date) return "-";

  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: ODOO_DISPLAY_TIME_ZONE,
  }).format(date);
}
