import assert from "node:assert/strict"
import test from "node:test"
import os from "node:os"
import path from "node:path"
import fs from "node:fs"
import http from "node:http"
import { provisionCatalog, provisionLocal, computeRevision, MissingSkillError, SkillRevisionMismatchError, PathSafetyError } from "../lib/skill-provisioning.ts"

function mkroot() { return fs.mkdtempSync(path.join(os.tmpdir(), "bive-cat-")) }

function writeSkillDir(tmp: string, id: string, content = "# skill\n") {
  const dir = path.join(tmp, id)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, "SKILL.md"), content)
  return dir
}

function makeManifest(root: string, role: string, skills: Record<string, any>) {
  const manifest = { version: 1, roles: { [role]: Object.keys(skills) }, skills }
  fs.mkdirSync(path.join(root, ".bive"), { recursive: true })
  fs.writeFileSync(path.join(root, ".bive", "skills.json"), JSON.stringify(manifest))
}

function startServer(handler: (req: http.IncomingMessage, res: http.ServerResponse) => void) {
  const server = http.createServer(handler)
  return new Promise<{ server: http.Server; base: string }>((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      resolve({ server, base: `http://127.0.0.1:${(server.address() as any).port}` })
    })
  })
}

test("catalog provisions a declared skill over HTTP", async () => {
  const root = mkroot()
  const tmp = mkroot()
  const content = "# catalog skill\n"
  writeSkillDir(tmp, "s", content)
  const hash = computeRevision(path.join(tmp, "s"))
  makeManifest(root, "delegate", { s: { source: "catalog", revision: hash } })

  const { server, base } = await startServer((req, res) => {
    if (req.url === "/index.json") {
      res.setHeader("content-type", "application/json")
      res.end(JSON.stringify([{ name: "s", version: "1", files: ["SKILL.md"] }]))
    } else if (req.url === "/s/SKILL.md") {
      res.end(content)
    } else {
      res.statusCode = 404
      res.end()
    }
  })
  try {
    const report = await provisionCatalog({ root, role: "delegate", catalog: base })
    assert.equal(report.skills.length, 1)
    assert.equal(report.skills[0].source, "catalog")
    assert.equal(report.skills[0].observed_revision, hash)
    assert.ok(fs.existsSync(path.join(root, ".opencode", "skills", "s", "SKILL.md")))
  } finally {
    server.close()
  }
})

test("catalog missing entry fails clearly", async () => {
  const root = mkroot()
  makeManifest(root, "delegate", { s: { source: "catalog", revision: "abc" } })
  const { server, base } = await startServer((req, res) => {
    if (req.url === "/index.json") {
      res.setHeader("content-type", "application/json")
      res.end(JSON.stringify([{ name: "other", version: "1", files: ["SKILL.md"] }]))
    } else {
      res.statusCode = 404
      res.end()
    }
  })
  try {
    await assert.rejects(
      () => provisionCatalog({ root, role: "delegate", catalog: base }),
      (e: any) => e instanceof MissingSkillError,
    )
  } finally {
    server.close()
  }
})

test("catalog revision mismatch fails clearly", async () => {
  const root = mkroot()
  const content = "# v1\n"
  makeManifest(root, "delegate", { s: { source: "catalog", revision: "deadbeef" } })
  const { server, base } = await startServer((req, res) => {
    if (req.url === "/index.json") {
      res.setHeader("content-type", "application/json")
      res.end(JSON.stringify([{ name: "s", version: "1", files: ["SKILL.md"] }]))
    } else if (req.url === "/s/SKILL.md") {
      res.end(content)
    } else {
      res.statusCode = 404
      res.end()
    }
  })
  try {
    await assert.rejects(
      () => provisionCatalog({ root, role: "delegate", catalog: base }),
      (e: any) => e instanceof SkillRevisionMismatchError,
    )
  } finally {
    server.close()
  }
})

test("catalog unsafe file path fails", async () => {
  const root = mkroot()
  const content = "# v1\n"
  const tmp = mkroot()
  const dir = writeSkillDir(tmp, "s", content)
  const hash = computeRevision(dir)
  makeManifest(root, "delegate", { s: { source: "catalog", revision: hash } })
  const { server, base } = await startServer((req, res) => {
    if (req.url === "/index.json") {
      res.setHeader("content-type", "application/json")
      res.end(JSON.stringify([{ name: "s", version: "1", files: ["../evil.md"] }]))
    } else {
      res.statusCode = 404
      res.end()
    }
  })
  try {
    await assert.rejects(
      () => provisionCatalog({ root, role: "delegate", catalog: base }),
      (e: any) => e instanceof PathSafetyError,
    )
  } finally {
    server.close()
  }
})

test("catalog version mismatch fails", async () => {
  const root = mkroot()
  const content = "# v1\n"
  const tmp = mkroot()
  const dir = writeSkillDir(tmp, "s", content)
  const hash = computeRevision(dir)
  makeManifest(root, "delegate", { s: { source: "catalog", revision: hash, version: "2" } })
  const { server, base } = await startServer((req, res) => {
    if (req.url === "/index.json") {
      res.setHeader("content-type", "application/json")
      res.end(JSON.stringify([{ name: "s", version: "1", files: ["SKILL.md"] }]))
    } else if (req.url === "/s/SKILL.md") {
      res.end(content)
    } else {
      res.statusCode = 404
      res.end()
    }
  })
  try {
    await assert.rejects(
      () => provisionCatalog({ root, role: "delegate", catalog: base }),
      (e: any) => e instanceof MissingSkillError,
    )
  } finally {
    server.close()
  }
})

test("provisionLocal delegates catalog source", async () => {
  const root = mkroot()
  const content = "# catalog skill\n"
  const tmp = mkroot()
  const dir = writeSkillDir(tmp, "s", content)
  const hash = computeRevision(dir)
  makeManifest(root, "delegate", { s: { source: "catalog", revision: hash } })
  const { server, base } = await startServer((req, res) => {
    if (req.url === "/index.json") {
      res.setHeader("content-type", "application/json")
      res.end(JSON.stringify([{ name: "s", version: "1", files: ["SKILL.md"] }]))
    } else if (req.url === "/s/SKILL.md") {
      res.end(content)
    } else {
      res.statusCode = 404
      res.end()
    }
  })
  try {
    const report = await provisionLocal({ root, role: "delegate", catalog: base })
    assert.equal(report.skills.length, 1)
  } finally {
    server.close()
  }
})
