// The Bive registry: receives anonymous session counts and serves them publicly.
// POST /v1/session {v: 1, project: uuid, human, agent, violations, loc} -> 204. GET /v1/stats -> totals. GET / -> the page.
// The client's IP is never read or stored; the day is the server's, so no client clock is kept either.
import page from "./index.html";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const MAX_TOKENS = 10_000_000;            // per report
const MAX_LOC = 100_000_000;
const MAX_VIOLATIONS = 100_000;          // per report
const MAX_REPORTS_PER_DAY = 500;          // per project

const json = (data, status = 200, extra = {}) => new Response(JSON.stringify(data), {
  status, headers: { "content-type": "application/json", "access-control-allow-origin": "*", ...extra } });
const int = (x, max) => Number.isInteger(x) && x >= 0 && x <= max;

async function report(request, env) {
  const text = await request.text();
  if (text.length > 1024) return json({ error: "too large" }, 413);
  let b;
  try { b = JSON.parse(text); } catch { return json({ error: "not JSON" }, 400); }
  if (b?.v !== 1 || !UUID.test(b.project ?? "") || !int(b.human, MAX_TOKENS) || !int(b.agent, MAX_TOKENS)
      || !int(b.violations ?? 0, MAX_VIOLATIONS) || !int(b.loc, MAX_LOC)) {
    return json({ error: "expected {v: 1, project: uuid, human, agent, violations, loc}" }, 400);
  }
  const day = new Date().toISOString().slice(0, 10);
  const { n } = await env.DB.prepare("SELECT COUNT(*) AS n FROM sessions WHERE project = ? AND day = ?")
    .bind(b.project, day).first();
  if (n >= MAX_REPORTS_PER_DAY) return json({ error: "too many reports today" }, 429);
  await env.DB.prepare("INSERT INTO sessions (project, day, human, agent, violations, loc) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(b.project, day, b.human, b.agent, b.violations ?? 0, b.loc).run();
  return new Response(null, { status: 204 });
}

async function stats(env) {
  const total = await env.DB.prepare(`SELECT COUNT(DISTINCT project) AS projects, COUNT(*) AS sessions,
      COALESCE(SUM(human), 0) AS human, COALESCE(SUM(agent), 0) AS agent,
      COALESCE(SUM(violations), 0) AS violations FROM sessions`).first();
  // Each project's current size is its latest non-zero report; the id itself is never returned.
  const { results: projects } = await env.DB.prepare(`SELECT project, SUM(human) AS human, SUM(agent) AS agent,
      SUM(violations) AS violations, COUNT(*) AS sessions, MIN(day) AS since,
      (SELECT s2.loc FROM sessions s2 WHERE s2.project = s.project AND s2.loc > 0 ORDER BY s2.rowid DESC LIMIT 1) AS loc
      FROM sessions s GROUP BY project ORDER BY agent DESC LIMIT 200`).all();
  const { results: days } = await env.DB.prepare(`SELECT day, COUNT(*) AS sessions, SUM(human) AS human,
      SUM(agent) AS agent, SUM(violations) AS violations FROM sessions WHERE day >= date('now', '-90 day')
      GROUP BY day ORDER BY day`).all();
  // The time dimension: each listed project's cumulative path, one point per active day, [day, human, agent, loc,
  // violations]. Rows are matched by position, never by id.
  const index = new Map(projects.map((p, i) => [p.project, i]));
  const { results: steps } = await env.DB.prepare(`SELECT project, day, SUM(human) AS h, SUM(agent) AS a,
      SUM(violations) AS v, MAX(loc) AS l FROM sessions GROUP BY project, day ORDER BY day`).all();
  const paths = projects.map(() => []);
  const acc = projects.map(() => ({ h: 0, a: 0, v: 0, l: 0 }));
  for (const st of steps) {
    const i = index.get(st.project);
    if (i === undefined) continue;
    const c = acc[i];
    c.h += st.h; c.a += st.a; c.v += st.v; c.l = st.l || c.l;
    paths[i].push([st.day, c.h, c.a, c.l, c.v]);
  }
  const loc = projects.reduce((n, p) => n + (p.loc || 0), 0);
  return json({ ...total, loc, rows: projects.map(({ project, since, ...p }) => ({ ...p, since: since.slice(0, 7) })),
                days, paths }, 200, { "cache-control": "public, max-age=60" });
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (request.method === "POST" && pathname === "/v1/session") return report(request, env);
    if (request.method === "GET" && pathname === "/v1/stats") return stats(env);
    if (request.method === "GET" && pathname === "/") {
      return new Response(page, { headers: { "content-type": "text/html; charset=utf-8" } });
    }
    return json({ error: "not found" }, 404);
  },
};
