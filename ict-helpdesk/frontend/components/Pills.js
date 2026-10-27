// Coloured labels for status and priority, e.g. "In Progress" -> class "status-in-progress".

function slug(text) {
  return text.toLowerCase().replaceAll(" ", "-");
}

export function StatusPill({ status, large = false }) {
  return <span className={`pill status-${slug(status)} ${large ? "pill-large" : ""}`}>{status}</span>;
}

export function PriorityPill({ priority }) {
  return <span className={`pill priority-${slug(priority)}`}>{priority}</span>;
}
