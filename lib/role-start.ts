export type Role = "advisor" | "coordinator" | "delegate";

export type Signals = {
  agent?: string;
  envRole?: string;
  roleFile?: string;
  worktreePath?: string;
  brief?: string;
  interactive: boolean;
  resumedRole?: Role;
  model?: string;
  allowedModels?: Partial<Record<Role, string[]>>;
};

export type RoleResolution =
  | { kind: "role"; role: Role; setIdentity: boolean }
  | { kind: "ask"; choices: string[] }
  | { kind: "answer-only" }
  | { kind: "blocked"; reason: string };

const roles: Role[] = ["advisor", "coordinator", "delegate"];
const choices = [...roles, "none of these: just answer a question"];

function explicitRole(value: string): Role | undefined {
  const normalized = value.trim();
  return roles.find((role) => role === normalized);
}

function makeRole(role: Role, s: Signals): RoleResolution {
  if (
    s.model !== undefined &&
    s.allowedModels !== undefined &&
    !s.allowedModels[role]?.includes(s.model)
  ) {
    return { kind: "blocked", reason: `blocked: model ${s.model} is not listed for role ${role}` };
  }
  return { kind: "role", role, setIdentity: role !== "advisor" };
}

export function resolveRole(s: Signals): RoleResolution {
  if (s.resumedRole !== undefined) return makeRole(s.resumedRole, s);

  const signals: Array<[string, string | undefined]> = [
    ["agent", s.agent],
    ["envRole (BIVE_ROLE)", s.envRole],
    ["roleFile", s.roleFile],
    ["worktreePath", s.worktreePath],
    ["brief", s.brief],
  ];
  const present = signals.flatMap(([name, value]) => {
    if (value === undefined || value.trim() === "") return [];
    if (name === "worktreePath") {
      return /\.worktrees\/issue-\d+/.test(value) ? [[name, "delegate"] as const] : [];
    }
    if (name === "brief") {
      const found = roles.filter((role) => new RegExp(`\\b${role}\\b`, "i").test(value));
      if (found.length > 1) return [[name, `conflicting roles: ${found.join(", ")}`] as const];
      return found.length === 1 ? [[name, found[0]] as const] : [];
    }
    const role = explicitRole(value);
    return [[name, role ?? `invalid value "${value.trim()}"`] as const];
  });

  const invalid = present.find(([, value]) => value.startsWith("invalid value") || value.startsWith("conflicting roles"));
  if (invalid) return { kind: "blocked", reason: `blocked: ${invalid[0]} has ${invalid[1]}` };

  const named = present as Array<[string, Role]>;
  if (named.length === 0) {
    return s.interactive
      ? { kind: "ask", choices: [...choices] }
      : { kind: "blocked", reason: "blocked: no role assigned" };
  }
  const unique = [...new Set(named.map(([, role]) => role))];
  if (unique.length > 1) {
    return { kind: "blocked", reason: `blocked: role signals disagree: ${named.map(([name, role]) => `${name}=${role}`).join(", ")}` };
  }
  return makeRole(unique[0], s);
}

export function afterAnswer(choice: string, s: Signals): RoleResolution {
  const role = explicitRole(choice);
  if (role) return makeRole(role, s);
  return { kind: "answer-only" };
}
