// Command-line wrapper of lib/models-check.ts (the only file with I/O). Usage: node lib/models-check-cli.ts [--probe]
import { execFile, execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { loadAliases } from "./delegate-session.ts"
import { checkModels, formatReport, parseModelList, probeModels } from "./models-check.ts"

function readIfExists(path: string): string | undefined {
  return existsSync(path) ? readFileSync(path, "utf8") : undefined
}

let config: Record<string, string[]>
try {
  config = JSON.parse(readFileSync(".bive/models.json", "utf8"))
} catch (e) {
  console.error(`cannot read .bive/models.json: ${(e as Error).message}`)
  process.exit(2)
}
const { aliases, warning } = loadAliases(readIfExists(".bive/state/models.local.json"))
if (warning) console.error(warning)

let available: string[]
try {
  available = parseModelList(execFileSync("opencode", ["models"], { encoding: "utf8", timeout: 30000 }))
} catch (e) {
  console.error(`opencode models failed: ${(e as Error).message}`)
  process.exit(2)
}

const result = checkModels(config, available, aliases)
console.log(formatReport(result))

if (process.argv.includes("--probe")) {
  const send = (model: string, prompt: string, timeoutMs: number) =>
    new Promise<string>((resolve, reject) => {
      execFile("opencode", ["run", "-m", model, prompt], { timeout: timeoutMs }, (err, stdout, stderr) =>
        err ? reject(new Error(stderr.trim() || err.message)) : resolve(stdout),
      )
    })
  for (const checks of Object.values(result.roles)) {
    const first = checks.find((c) => c.status !== "missing")
    if (!first) continue
    for (const p of await probeModels([first.resolved], send)) console.log(`probe ${p.model}: ${p.ok ? "ok" : "FAILED " + p.reason}`)
  }
}
process.exit(result.ok ? 0 : 1)
