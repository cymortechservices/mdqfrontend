import { Fragment, useMemo, useState } from "react";
import { Alert, Badge, EmptyState, Skeleton } from "../../components/ui/Feedback";
import { Button } from "../../components/ui/Button";
import { Dialog } from "../../components/ui/Dialog";
import { Icon } from "../../components/ui/Icon";
import { TextField } from "../../components/ui/Field";
import { request, ApiError } from "../../lib/api";
import { formatDate } from "../../lib/format";
import { usePageMeta } from "../../lib/meta";
import { useAsync } from "../../hooks/useAsync";
import type { AdminAssessment, AdminUser, AdminUsersResponse } from "../../types/api";

interface Loaded {
  users: AdminUser[];
  adminUserId: string | number | undefined;
  recentlyDeleted: number;
}

class ForbiddenError extends Error {}

/** Name shown for a student: saved name, else a readable form of the e-mail, else a neutral note (same rules as the original admin.js). */
function adminDisplayName(user: AdminUser): string {
  if (user.displayName) return user.displayName;
  const local = String(user.studentEmail || "").split("@")[0] ?? "";
  const idLike = local.replace(/[._-]/g, "");
  if (/^[a-z\d]+$/i.test(idLike) && /\d/.test(idLike)) return "Name not provided";
  return (
    local
      .replace(/[._-]+/g, " ")
      .replace(/(^|\s)\p{L}/gu, (letter) => letter.toUpperCase()) || "—"
  );
}

function groupKey(user: AdminUser): { key: string; label: string } {
  const date = user.createdAt ? new Date(user.createdAt) : null;
  if (!date || Number.isNaN(date.getTime())) return { key: "unknown", label: "Date unavailable" };
  return {
    key: `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`,
    label: date.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" }),
  };
}

function assessmentTitle(a: AdminAssessment): string {
  return [String(a.testType || "Assessment").toUpperCase(), a.title || a.subject].filter(Boolean).join(" · ");
}

function assessmentDetails(a: AdminAssessment): string {
  return [
    a.subject && a.title ? a.subject : null,
    a.year ? `Year ${a.year}` : null,
    formatDate(a.completedAt, "—"),
    a.score != null || a.totalMarks != null ? `${a.score ?? "—"}/${a.totalMarks ?? "—"}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

export default function AdminPage() {
  usePageMeta({ title: "Admin | MDQ", path: "/admin" });
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [term, setTerm] = useState("");
  const [verified, setVerified] = useState<"all" | "yes" | "no">("all");
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [pendingDelete, setPendingDelete] = useState<AdminUser | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const state = useAsync<Loaded>(async (signal) => {
    const result = await request<AdminUsersResponse & { error?: string }>("/api/admin/users", { signal });
    if (result.status === 403) throw new ForbiddenError("Your account is not authorized to view this dashboard.");
    if (!result.ok) throw new Error(result.data.error || "Could not load the user dashboard.");
    return {
      users: Array.isArray(result.data.users) ? result.data.users : [],
      adminUserId: result.data.adminUserId,
      recentlyDeleted: result.data.verificationStats?.recentlyDeleted ?? 0,
    };
  });

  const users = useMemo(() => (state.data?.users ?? []).filter((u) => !removed.has(String(u.id))), [state.data, removed]);

  const stats = useMemo(
    () => ({
      total: users.length,
      verified: users.filter((u) => u.emailVerified).length,
      pending: users.filter((u) => !u.emailVerified).length,
      assessments: users.reduce((sum, u) => sum + (Array.isArray(u.assessments) ? u.assessments.length : 0), 0),
    }),
    [users],
  );

  const filtered = useMemo(() => {
    const needle = term.trim().toLowerCase();
    return users.filter((user) => {
      if (verified === "yes" && !user.emailVerified) return false;
      if (verified === "no" && user.emailVerified) return false;
      if (!needle) return true;
      return [adminDisplayName(user), user.studentEmail, user.whatsAppNumber].some((v) => String(v || "").toLowerCase().includes(needle));
    });
  }, [users, term, verified]);

  const groups = useMemo(() => {
    const map = new Map<string, { label: string; users: AdminUser[] }>();
    for (const user of filtered) {
      const g = groupKey(user);
      const entry = map.get(g.key) ?? { label: g.label, users: [] };
      entry.users.push(user);
      map.set(g.key, entry);
    }
    return [...map.entries()];
  }, [filtered]);

  const toggle = (id: string) =>
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const confirmDelete = async () => {
    const user = pendingDelete;
    if (!user) return;
    setDeleting(true);
    setFeedback(null);
    try {
      const response = await request<{ error?: string }>(`/api/admin/users/${encodeURIComponent(String(user.id))}`, { method: "DELETE" });
      if (!response.ok) throw new Error(response.data.error || `The server rejected the request (HTTP ${response.status}).`);
      setRemoved((current) => new Set(current).add(String(user.id)));
      setFeedback({ tone: "success", text: `Successfully deleted ${user.studentEmail} and all associated records.` });
      setPendingDelete(null);
    } catch (cause) {
      const message = cause instanceof ApiError || cause instanceof Error ? cause.message : "Unknown error";
      setFeedback({ tone: "error", text: `Deletion failed for ${user.studentEmail}: ${message}` });
      setPendingDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  const summary = [
    { label: "Total users", value: stats.total, icon: "users" },
    { label: "Verified", value: stats.verified, icon: "shieldCheck" },
    { label: "Pending verification", value: stats.pending, icon: "clock" },
    { label: "Recently deleted unverified", value: state.data?.recentlyDeleted ?? 0, icon: "trash" },
    { label: "Completed assessments", value: stats.assessments, icon: "listChecks" },
  ] as const;

  return (
    <div className="admin">
      <div className="page-head">
        <div>
          <p className="eyebrow">Administration</p>
          <h1 className="h1">User dashboard</h1>
          <p className="muted">Review accounts, verification status and completed assessments.</p>
        </div>
      </div>

      {state.loading ? (
        <div aria-busy="true" aria-label="Loading users">
          <Skeleton className="skeleton--block" style={{ height: 96 }} />
          <Skeleton className="skeleton--block" style={{ height: 320, marginTop: 16 }} />
        </div>
      ) : state.error ? (
        <Alert tone="error" title="Dashboard unavailable" action={<Button size="sm" variant="secondary" onClick={state.reload}>Try again</Button>}>
          {state.error}
        </Alert>
      ) : (
        <>
          <ul className="admin__stats" aria-label="Summary">
            {summary.map((item) => (
              <li key={item.label} className="card card--pad stat">
                <span className="stat__icon">
                  <Icon name={item.icon} size={18} />
                </span>
                <strong>{item.value}</strong>
                <span className="muted">{item.label}</span>
              </li>
            ))}
          </ul>

          {feedback ? (
            <Alert tone={feedback.tone}>{feedback.text}</Alert>
          ) : null}

          <div className="admin__tools">
            <TextField
              label="Search users"
              type="search"
              icon="search"
              placeholder="Name, email or WhatsApp number"
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              autoComplete="off"
            />
            <div className="seg" role="group" aria-label="Verification filter">
              {(
                [
                  ["all", "All"],
                  ["yes", "Verified"],
                  ["no", "Not verified"],
                ] as const
              ).map(([id, label]) => (
                <button key={id} type="button" className={`seg__btn ${verified === id ? "is-active" : ""}`} aria-pressed={verified === id} onClick={() => setVerified(id)}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <p className="muted" role="status" aria-live="polite">
            {term || verified !== "all" ? `${filtered.length} of ${users.length} accounts shown.` : `${users.length} account${users.length === 1 ? "" : "s"} shown.`}
          </p>

          {filtered.length ? (
            <div className="table-wrap" tabIndex={0} role="region" aria-label="Users table, scrollable">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Name</th>
                    <th scope="col">Student email</th>
                    <th scope="col">WhatsApp</th>
                    <th scope="col">Verification</th>
                    <th scope="col">Joined</th>
                    <th scope="col">Assessments</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {groups.map(([key, group]) => (
                    <Fragment key={key}>
                      <tr className="table__group">
                        <th scope="rowgroup" colSpan={7}>
                          {group.label} · {group.users.length} new account{group.users.length === 1 ? "" : "s"}
                        </th>
                      </tr>
                      {group.users.map((user) => {
                        const id = String(user.id);
                        const list = Array.isArray(user.assessments) ? user.assessments : [];
                        const expanded = open.has(id);
                        const isAdmin = id === String(state.data?.adminUserId);
                        return (
                          <tr key={id}>
                            <td data-label="Name">{adminDisplayName(user)}</td>
                            <td data-label="Email" className="break">{user.studentEmail || "—"}</td>
                            <td data-label="WhatsApp">{user.whatsAppNumber || "—"}</td>
                            <td data-label="Verification">
                              <Badge tone={user.emailVerified ? "success" : "warning"} icon={user.emailVerified ? "checkCircle" : "clock"}>
                                {user.emailVerified ? "Verified" : "Not verified"}
                              </Badge>
                            </td>
                            <td data-label="Joined">{formatDate(user.createdAt, "—")}</td>
                            <td data-label="Assessments">
                              {list.length ? (
                                <>
                                  <button type="button" className="link-btn" aria-expanded={expanded} aria-controls={`assess-${id}`} onClick={() => toggle(id)}>
                                    {expanded ? "Hide" : "Show"} completed ({list.length})
                                  </button>
                                  <ul id={`assess-${id}`} className="assess-list" hidden={!expanded}>
                                    {list.map((a, i) => (
                                      <li key={i}>
                                        <strong>{assessmentTitle(a)}</strong>
                                        <span className="muted">{assessmentDetails(a)}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </>
                              ) : (
                                "None completed"
                              )}
                            </td>
                            <td data-label="Actions">
                              {isAdmin ? (
                                <Badge tone="accent">Current admin</Badge>
                              ) : (
                                <Button variant="danger" size="sm" iconLeft="trash" onClick={() => setPendingDelete(user)}>
                                  Delete user
                                </Button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icon="users" title={term || verified !== "all" ? "No accounts match your filters." : "No accounts found."} />
          )}
        </>
      )}

      <Dialog
        open={pendingDelete !== null}
        onClose={() => (deleting ? undefined : setPendingDelete(null))}
        dismissible={!deleting}
        size="sm"
        title="Delete this user?"
        description={pendingDelete ? `Permanently delete ${pendingDelete.studentEmail} and all associated records? This cannot be undone.` : undefined}
        footer={
          <>
            <Button variant="ghost" onClick={() => setPendingDelete(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="danger" iconLeft="trash" loading={deleting} onClick={() => void confirmDelete()}>
              Confirm delete
            </Button>
          </>
        }
      >
        <Alert tone="warning">This calls the existing admin delete endpoint and removes the account together with its records.</Alert>
      </Dialog>
    </div>
  );
}
