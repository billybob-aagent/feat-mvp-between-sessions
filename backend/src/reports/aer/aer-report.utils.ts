export type DateOnlyParts = {
  year: number;
  month: number;
  day: number;
};

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const pad2 = (value: number) => value.toString().padStart(2, "0");

export const formatDateOnly = (parts: DateOnlyParts) =>
  `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;

export const parseDateOnly = (value: string): DateOnlyParts | null => {
  if (!DATE_ONLY_REGEX.test(value)) return null;
  const [yearRaw, monthRaw, dayRaw] = value.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);

  if (!Number.isInteger(year) || year < 1) return null;
  if (!Number.isInteger(month) || month < 1 || month > 12) return null;
  if (!Number.isInteger(day) || day < 1) return null;

  const daysInMonth = new Date(year, month, 0).getDate();
  if (day > daysInMonth) return null;

  return { year, month, day };
};

export const dateOnlyPartsFromLocal = (date: Date): DateOnlyParts => ({
  year: date.getFullYear(),
  month: date.getMonth() + 1,
  day: date.getDate(),
});

export const dateOnlyPartsFromUTC = (date: Date): DateOnlyParts => ({
  year: date.getUTCFullYear(),
  month: date.getUTCMonth() + 1,
  day: date.getUTCDate(),
});

export const buildDateRangeFromParts = (parts: DateOnlyParts) => ({
  start: new Date(parts.year, parts.month - 1, parts.day, 0, 0, 0, 0),
  end: new Date(parts.year, parts.month - 1, parts.day, 23, 59, 59, 999),
});

export const buildStorageDateFromParts = (parts: DateOnlyParts) =>
  new Date(Date.UTC(parts.year, parts.month - 1, parts.day));

export const toDateOnlyStringLocal = (date: Date) =>
  formatDateOnly(dateOnlyPartsFromLocal(date));

export const toDateOnlyStringUTC = (date: Date) =>
  formatDateOnly(dateOnlyPartsFromUTC(date));
