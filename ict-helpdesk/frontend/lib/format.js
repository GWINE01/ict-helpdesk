// Display helpers shared by the pages.

export const STATUSES = ["Pending", "Assigned", "In Progress", "Resolved", "Closed"];
export const PRIORITIES = ["Low", "Medium", "High", "Urgent"];

// 42 -> "REQ-0042"
export function requestCode(id) {
  return "REQ-" + String(id).padStart(4, "0");
}

// The database stores UTC text like "2026-10-06 09:12:00".
export function formatDate(text) {
  if (!text) return "";
  const date = new Date(text.replace(" ", "T") + "Z");
  return date.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// 5.33 -> "5h 20m"
export function formatHours(hours) {
  if (hours === null || hours === undefined) return "No data yet";
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
