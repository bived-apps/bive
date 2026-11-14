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
    "9 RISKS", "Too abstract.", "10 NOT DELIVERED", "Files.", "D'apr\u00e8s votre adresse IP", "Flash-Lite", "X n'est pas un \u00eatre humain. V\u00e9rifiez ses r\u00e9ponses.", "\u00c0 propos de X", "Abonnements", "Connectez-vous pour acc\u00e9der aux applis Google", "Se connecter"].join("\n")
  const { text } = anonymise(raw)
  assert.match(text, /5 ACCESSIBILITY/)
  assert.match(text, /9 RISKS/)
  assert.match(text, /10 NOT DELIVERED/)
  assert.doesNotMatch(text, /Connectez-vous|Google|Model: unknown|Flash|humain|propos|Abonnements|adresse IP/)
  assert.deepEqual(leaks(text), [])
})

test("a package that opens with THE IDEA (second batch prompt) is recognised too", () => {
  const { text } = anonymise(["Log in", "echo of the prompt", "1 THE IDEA", "Pocket companions.", "7 NOT DELIVERED", "Nothing.", "8 PROVENANCE", "Model: x", "PACKAGE PART COMPLETE"].join("\n"))
  assert.match(text, /^1 THE IDEA/)
  assert.doesNotMatch(text, /echo of the prompt|Model: x/)
})

test("a free-form answer without headings is kept whole, minus chrome, and still leak-checked", () => {
  const { text, removed } = anonymise(["Log in", "Meet Pip, a patient advisor with a lantern. Written by Claude.", "Se connecter"].join("\n"))
  assert.match(text, /Meet Pip/)
  assert.doesNotMatch(text, /Log in|Claude|Se connecter/)
  assert.ok(removed.some((r) => r.startsWith("no package heading")))
  assert.deepEqual(leaks(text), [])
})

test("a heading that ends with a colon starts the package, and the echoed prompt line with text after it does not", () => {
  const raw = ["Conversation", "1 THE IDEA: the one concept behind the cast (max 120 words).", "More prompt.", "1 THE IDEA:", "Clockwork garden.", "2 THE CAST", "Pip."].join("\n")
  const { text } = anonymise(raw)
  assert.match(text, /^1 THE IDEA:\nClockwork garden\./)
  assert.doesNotMatch(text, /More prompt|max 120/)
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
    // images are copied beside the package, listed in the key, and a non-image is refused
    const pic = path.join(dir, "x.png"); fs.writeFileSync(pic, "png")
    const r3 = addPackage(raw, "site-i", "model-i", "3", dir, { images: [pic], note: "owner: memorable" })
    assert.ok(fs.existsSync(path.join(dir, "packages", r3.letter, "images", "image-1.png")))
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, "key.json"), "utf8"))[r3.letter].images, ["image-1.png"])
    assert.throws(() => addPackage(raw, "s", "m", "4", dir, { images: [raw] }), /not an image/)
    const clean = path.join(dir, "ok.svg"); fs.writeFileSync(clean, '<svg xmlns="http://www.w3.org/2000/svg"><circle r="1"/></svg>')
    const r4 = addPackage(raw, "s", "m", "5", dir, { images: [clean] })
    assert.ok(fs.existsSync(path.join(dir, "packages", r4.letter, "images", "image-1.svg")))
    const bad = path.join(dir, "bad.svg"); fs.writeFileSync(bad, '<svg onload="alert(1)"></svg>')
    assert.throws(() => addPackage(raw, "s", "m", "6", dir, { images: [bad] }), /refusing an SVG/)
    // letters are not reused
    const r2 = addPackage(raw, "site-z", "model-w", undefined, dir)
    assert.notEqual(r2.letter, r.letter)
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})
