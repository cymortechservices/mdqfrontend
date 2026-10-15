export function formatDate(value: unknown, fallback = "Date unavailable"): string {
  if (!value) return fallback;
  const date = new Date(value as string);
  if (Number.isNaN(date.getTime())) return fallback;
  return new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" }).format(date);
}

export function formatDateTime(value: unknown, fallback = "Date unavailable"): string {
  if (!value) return fallback;
  const date = new Date(value as string);
  if (Number.isNaN(date.getTime())) return fallback;
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function getGreeting(now: Date = new Date()): string {
  const hour = now.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/** Same derivation as the original portal: the part of the e-mail name after the first dot, title-cased. */
export function lastNameFromEmail(email: unknown): string {
  const localPart = String(email || "").split("@")[0] ?? "";
  const lastName = localPart.split(".").slice(1).join(" ").trim();
  if (!lastName) return "there";
  return lastName.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

/** A friendly display name: saved name if the API provides one, else derived from the e-mail. */
export function displayNameFor(user: { displayName?: string; studentEmail?: string } | null | undefined): string {
  if (user?.displayName?.trim()) return user.displayName.trim();
  const local = String(user?.studentEmail || "").split("@")[0] ?? "";
  const words = local
    .replace(/[0-9]+/g, " ")
    .split(/[._-]+/)
    .map((word) => word.trim())
    .filter(Boolean);
  if (!words.length) return "Student";
  return words.map((word) => word[0]!.toUpperCase() + word.slice(1)).join(" ");
}

export function initialsFor(user: { displayName?: string; studentEmail?: string } | null | undefined): string {
  const name = displayNameFor(user);
  const parts = name.split(/\s+/).filter(Boolean);
  const letters = (parts[0]?.[0] ?? "S") + (parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "");
  return letters.toUpperCase();
}

export function pct(value: number): string {
  return `${Math.round(value)}%`;
}

export function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}

export function formatBytes(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
