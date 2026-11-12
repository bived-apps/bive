// Parse a pull request body and return the issue numbers GitHub will close on merge.
// GitHub links only the issues each closing keyword names: `Closes #1, #2` closes #1 only;
// each issue needs its own `Closes #N` line. `Part of #N` does not close.
// Contract: issue #117.
const CLOSING_KEYWORDS = /\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\b/i

export function closingIssueNumbers(body: string): number[] {
  const out: number[] = []
  if (typeof body !== "string") return out
  const lines = body.split(/\r?\n/)
  for (const line of lines) {
    // A closing keyword must start the line (possibly after whitespace) to count as a close directive.
    const m = line.match(/^\s*(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s*#(\d+)/i)
    if (m) out.push(Number(m[1]))
  }
  return out
}