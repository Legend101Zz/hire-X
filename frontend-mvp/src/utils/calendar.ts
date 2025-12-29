import { format, parseISO, addMinutes } from "date-fns";

/**
 * Generate Google Calendar URL from event details
 */
export function createGoogleCalendarUrl(
  title: string,
  startDateTime: string, // ISO format
  durationMinutes: number,
  description: string,
  location: string = "Phone Call"
): string {
  const startDate = parseISO(startDateTime);
  const endDate = addMinutes(startDate, durationMinutes);

  // Format: YYYYMMDDTHHMMSS
  const formatDateTime = (date: Date) => {
    return format(date, "yyyyMMdd'T'HHmmss");
  };

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    details: description,
    location: location,
    dates: `${formatDateTime(startDate)}/${formatDateTime(endDate)}`,
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
