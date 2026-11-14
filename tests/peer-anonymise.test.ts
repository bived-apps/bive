import { test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { anonymise, leaks } from "../lib/peer-anonymise.ts"
import { addPackage } from "../lib/peer-collect-cli.ts"

const RAW = [
  "Skip to content", "Log in", "Share", "You are a design studio ... prompt text ... 1. CONCEPT (max 120 words): the idea", "",
  "Thought for 2m 41s", "1. CONCEPT", "A quiet office. Made with GPT-6.1 by OpenAI, also compare Gemini and Claude Opus.",
  "2. PALETTE", "Ink #1F2430. See https://chatgpt.com/share/abc-123 or mail me@example.com on 2026-11-14.",
  "8. PROVENANCE LOG", "Model: OpenAI GPT-6. Date 2026-11-14. Rights: OpenAI assigns outputs to the user.",
  "9. RISKS", "Weak consistency.", "PACKAGE COMPLETE.", "ChatGPT can make mistakes.",
].join("\n")

test("the author's identity, links, email, dates, provenance and site chrome are removed", () => {
  const { text, removed } = anonymise(RAW)
  assert.deepEqual(leaks(text), [])
  assert.doesNotMatch(text, /GPT|OpenAI|Gemini|Claude|Opus|chatgpt|share\/abc|me@example|2026-11-14|Skip to content|Log in|prompt text/i)
  assert.match(text, /^1\. CONCEPT/)
  assert.match(text, /PACKAGE COMPLETE\.$/m)
  assert.match(text, /\[provenance withheld until the review is finished\]/)
  assert.match(text, /9\. RISKS/)
  assert.match(text, /Ink #1F2430/, "design content is kept")
  assert.ok(removed.some((r) => r.startsWith("word: ")) && removed.includes("provenance section"))
})

test("a completion line in the middle does not cut the sections that follow, and sign-in footers are removed", () => {
  const raw = ["1 CONCEPT", "Idea.", "4 IMAGES", "PACKAGE PART COMPLETE", "5 ACCESSIBILITY", "Contrast fine.", "8 PROVENANCE", "Model: unknown. Date: November 14, 2026.",
    "9 RISKS", "Too abstract.", "10 NOT DELIVERED", "Files.", "Connectez-vous pour acc\u00e9der aux applis Google", "Se connecter"].join("\n")
  const { text } = anonymise(raw)
  assert.match(text, /5 ACCESSIBILITY/)
  assert.match(text, /9 RISKS/)
  assert.match(text, /10 NOT DELIVERED/)
  assert.doesNotMatch(text, /Connectez-vous|Google|Model: unknown/)
  assert.deepEqual(leaks(text), [])
})

test("a clean text is left alone, and leaks() sees what remains", () => {
  assert.equal(anonymise("1. CONCEPT\nA plain idea.\nPACKAGE COMPLETE.\n").text, "1. CONCEPT\nA plain idea.\nPACKAGE COMPLETE.\n")
  assert.deepEqual(leaks("fine text"), [])
  assert.ok(leaks("by Anthropic").includes("anthropic"))
  assert.ok(leaks("see http://x.y").includes("url"))
})

test("storing: random letter, anonymised package under packages/, key kept apart, a leak refuses to store", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "peer-"))
  try {
    const raw = path.join(dir, "raw.txt")
    fs.writeFileSync(raw, RAW)
    const r = addPackage(raw, "site-x", "model-y", "1", dir)
    assert.match(r.letter, /^[A-HJ-NP-Z]$/)
    const pkg = fs.readFileSync(path.join(dir, "packages", r.letter, "package.md"), "utf8")
    assert.deepEqual(leaks(pkg), [])
    const key = JSON.parse(fs.readFileSync(path.join(dir, "key.json"), "utf8"))
    assert.deepEqual(key[r.letter], { site: "site-x", model: "model-y", trial: "1" })
    assert.doesNotMatch(pkg, /site-x|model-y/)
    assert.equal(fs.readdirSync(path.join(dir, "packages", r.letter)).includes("key.json"), false)
    // letters are not reused
    const r2 = addPackage(raw, "site-z", "model-w", undefined, dir)
    assert.notEqual(r2.letter, r.letter)
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})
