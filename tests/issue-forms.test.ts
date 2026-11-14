import assert from "node:assert/strict"
import test from "node:test"
import fs from "node:fs"
import path from "node:path"

// No YAML parser is available: the repository has no package.json and no node_modules. These files use a small,
// fixed subset of YAML (mappings, sequences, block scalars), parsed here line by line with indentation.

const ROOT = path.resolve(import.meta.dirname, "..")
const TEMPLATES = ".github/ISSUE_TEMPLATE"

type Yaml = string | boolean | Yaml[] | { [key: string]: Yaml }

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf8")
}

function parseYaml(text: string): { [key: string]: Yaml } {
  const lines = text.split(/\r?\n/)
  let i = 0

  const indentOf = (line: string): number => line.length - line.trimStart().length
  const isSkippable = (line: string): boolean => line.trim() === "" || line.trimStart().startsWith("#")

  function skip(): void {
    while (i < lines.length && isSkippable(lines[i])) i++
  }

  function scalar(raw: string): Yaml {
    let value = raw.trim()
    const inline = value.indexOf(" #")
    if (inline !== -1) value = value.slice(0, inline).trim()
    if (value === "[]") return []
    if (value === "{}") return {}
    if (value === "true") return true
    if (value === "false") return false
    if (value.length > 1 && ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))) {
      return value.slice(1, -1)
    }
    return value
  }

  function blockScalar(indent: number, style: "|" | ">"): string {
    const kept: string[] = []
    let contentIndent = -1
    while (i < lines.length) {
      const line = lines[i]
      if (line.trim() === "") {
        kept.push("")
        i++
        continue
      }
      if (indentOf(line) <= indent) break
      if (contentIndent === -1) contentIndent = indentOf(line)
      kept.push(line.slice(contentIndent))
      i++
    }
    while (kept.length > 0 && kept[kept.length - 1] === "") kept.pop()
    return style === "|" ? kept.join("\n") : kept.join(" ").replace(/\s+/g, " ").trim()
  }

  function block(indent: number): Yaml {
    skip()
    if (i < lines.length && lines[i].trimStart().startsWith("- ")) return sequence(indent)
    return mapping(indent)
  }

  function mapping(indent: number): { [key: string]: Yaml } {
    const out: { [key: string]: Yaml } = {}
    for (;;) {
      skip()
      if (i >= lines.length) break
      const line = lines[i]
      if (indentOf(line) !== indent || line.trimStart().startsWith("- ")) break
      const match = /^([A-Za-z0-9_-]+):(?: (.*))?$/.exec(line.trim())
      if (match === null) throw new Error(`unsupported YAML at line ${i + 1}: ${line}`)
      i++
      const rest = (match[2] ?? "").trim()
      if (/^[|>]-?$/.test(rest)) {
        out[match[1]] = blockScalar(indent, rest.startsWith("|") ? "|" : ">")
      } else if (rest !== "") {
        out[match[1]] = scalar(rest)
      } else {
        skip()
        out[match[1]] = i < lines.length && indentOf(lines[i]) > indent ? block(indentOf(lines[i])) : ""
      }
    }
    return out
  }

  function sequence(indent: number): Yaml[] {
    const out: Yaml[] = []
    for (;;) {
      skip()
      if (i >= lines.length) break
      const line = lines[i]
      if (indentOf(line) !== indent || !line.trimStart().startsWith("- ")) break
      const rest = line.trimStart().slice(2).trim()
      i++
      if (rest === "") {
        skip()
        out.push(i < lines.length && indentOf(lines[i]) > indent ? block(indentOf(lines[i])) : "")
        continue
      }
      const match = /^([A-Za-z0-9_-]+):(?: (.*))?$/.exec(rest)
      if (match === null) {
        out.push(scalar(rest))
        continue
      }
      const item: { [key: string]: Yaml } = {}
      const value = (match[2] ?? "").trim()
      if (value !== "") {
        item[match[1]] = scalar(value)
      } else {
        skip()
        item[match[1]] = i < lines.length && indentOf(lines[i]) > indent ? block(indentOf(lines[i])) : ""
      }
      skip()
      if (i < lines.length && !isSkippable(lines[i]) && indentOf(lines[i]) > indent) {
        Object.assign(item, mapping(indentOf(lines[i])))
      }
      out.push(item)
    }
    return out
  }

  const parsed = mapping(0)
  skip()
  assert.equal(i, lines.length, `unparsed YAML after line ${i}: ${lines[i]}`)
  return parsed
}

function objects(value: Yaml, where: string): Array<{ [key: string]: Yaml }> {
  assert.ok(Array.isArray(value), `${where} must be a list`)
  return value.map((item, index) => {
    assert.ok(typeof item === "object" && item !== null && !Array.isArray(item), `${where}[${index}] must be a mapping`)
    return item as { [key: string]: Yaml }
  })
}

const form = parseYaml(read(`${TEMPLATES}/task.yml`))
const body = objects(form.body, "task.yml body")

function field(id: string): { [key: string]: Yaml } {
  const found = body.find((item) => item.id === id)
  assert.ok(found !== undefined, `task.yml has no field "${id}"`)
  return found
}

function requiredValidation(id: string): Yaml {
  const validations = field(id).validations
  assert.ok(typeof validations === "object" && validations !== null && !Array.isArray(validations), `field "${id}" has no validations`)
  return (validations as { [key: string]: Yaml }).required
}

function attr(id: string, key: string): Yaml {
  const attributes = field(id).attributes
  assert.ok(typeof attributes === "object" && attributes !== null && !Array.isArray(attributes), `field "${id}" has no attributes`)
  return (attributes as { [key: string]: Yaml })[key]
}

test("the form states that required fields bind the web form only and the coordinator rejects incomplete tasks", () => {
  const description = String(form.description)
  assert.match(description, /web form only/i, "the form description names the web form as the limit")
  assert.match(description, /\bgh\b/i, "the form description names gh")
  assert.match(description, /\bAPI\b/, "the form description names the API")
  assert.match(description, /rejects incomplete tasks/i, "the form description says incomplete tasks are rejected")
  assert.match(description, /gate 1/i, "the rejection happens before gate 1")
  assert.match(description, /delegation/i, "the rejection happens before delegation")
  assert.ok(description.length <= 200, `the GitHub form description is limited to 200 characters, got ${description.length}`)
  assert.ok(String(form.name).trim() !== "", "the form has a name")
  const note = body[0].attributes as { [key: string]: Yaml }
  assert.match(String(note.value), /bypasses them/, "the form body repeats the gh/API bypass")
})

test("Goal, Files, Done when and Checks are required textareas", () => {
  const expected: Array<[string, string]> = [
    ["goal", "Goal"],
    ["files", "Files"],
    ["done_when", "Done when"],
    ["checks", "Checks"],
  ]
  for (const [id, label] of expected) {
    assert.equal(field(id).type, "textarea", `"${id}" is a textarea`)
    assert.equal(attr(id, "label"), label, `"${id}" is labelled "${label}"`)
    assert.ok(String(attr(id, "description") ?? "").trim() !== "", `"${id}" has a description`)
    assert.equal(requiredValidation(id), true, `"${id}" is required`)
  }
})

test("the role dropdown requires one of Delegate work or Coordinator work", () => {
  assert.equal(field("work_type").type, "dropdown", "the role field is a dropdown")
  assert.equal(requiredValidation("work_type"), true, "the role dropdown is required")
  assert.deepEqual(attr("work_type", "options"), ["Delegate work", "Coordinator work"])
})

test("the old briefing fields survive as optional fields", () => {
  for (const id of ["read", "steps", "context", "docs"]) {
    assert.equal(field(id).type, "textarea", `"${id}" is an optional textarea`)
    assert.equal(requiredValidation(id), false, `"${id}" is not required`)
  }
})

test("the form carries no labels and the old Markdown template is gone", () => {
  assert.deepEqual(form.labels, [], "task.yml asks for no automatic label")
  assert.equal(fs.existsSync(path.join(ROOT, `${TEMPLATES}/delegate.md`)), false, "delegate.md must not stay next to the form")
  const files = fs.readdirSync(path.join(ROOT, TEMPLATES)).sort()
  assert.deepEqual(files, ["config.yml", "task.yml"], "only the form and its config remain in the picker")
})

test("config.yml states the blank-issue policy explicitly and keeps a generic route", () => {
  const text = read(`${TEMPLATES}/config.yml`)
  assert.match(text, /^blank_issues_enabled: (?:true|false)$/m, "blank_issues_enabled is set explicitly")
  const config = parseYaml(text)
  assert.equal(config.blank_issues_enabled, true, "blank issues stay enabled so generic bugs and questions can be filed")
  const links = objects(config.contact_links, "config.yml contact_links")
  assert.ok(links.length > 0, "config.yml has a contact link")
  const first = links[0]
  assert.ok(String(first.name ?? "").trim() !== "", "the contact link has a name")
  assert.ok(String(first.about ?? "").trim() !== "", "the contact link has an about")
  const url = String(first.url)
  assert.match(url, /^https:\/\/github\.com\/bived-apps\/bive\/(?:blob\/[^/]+\/docs\/COORDINATING\.md|discussions)$/, "the contact link routes to docs/COORDINATING.md or Discussions")
})
