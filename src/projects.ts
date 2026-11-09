import type { Session } from "./rpc";

export function projects(sessions: Session[]) {
  return Array.from(
    Map.groupBy(sessions, (session) => session.projectID),
    ([id, entries]) => ({
      id,
      directory: entries
        .map((session) => session.directory)
        .sort((a, b) => a.length - b.length)[0],
      sessions: entries,
      running: entries.filter((session) => session.status === "running").length,
      waiting: entries.filter((session) => session.status === "waiting").length,
      cost: entries.reduce((sum, session) => sum + session.cost, 0),
      tokens: entries.reduce((sum, session) => sum + session.tokens, 0),
    }),
  ).sort(
    (a, b) =>
      b.running - a.running ||
      b.waiting - a.waiting ||
      a.directory.localeCompare(b.directory),
  );
}
