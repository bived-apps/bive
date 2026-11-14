// Anonymise a captured design package before it is stored or shown to a peer reviewer (docs/COMPETENCIES.md).
// Conservative: it removes what identifies the author (model, vendor, share links, accounts, dates, provenance section,
// site chrome) and then FAILS when a denylisted word is still present, so a leak is an error, not a silent pass.
// Not a privacy guarantee: a style can still betray an author, and the owner reads the output before anything is published.

export const IDENTITY_WORDS = [
  "openai", "chatgpt", "gpt", "dall-e", "dalle", "sora", "anthropic", "claude", "sonnet", "opus", "haiku", "fable",
  "google", "gemini", "nano banana", "imagen", "veo", "meta ai", "llama", "mistral", "deepseek", "glm", "zhipu", "qwen",
  "grok", "xai", "x.ai", "perplexity", "copilot", "microsoft", "midjourney", "flux", "stable diffusion", "stability ai",
  "pollinations", "perchance", "hugging face", "huggingface", "recraft", "ideogram", "firefly", "adobe", "kimi", "moonshot",
  "longcat", "mimo", "nvidia", "flash-lite", "cohere", "sunburst", "terra", "astra", "luna",
]

const SITE_CHROME = [
  /^Ignorer et passer au contenu$/i, /^Skip to content$/i, /^Historique de chat$/i, /^Nouveau chat$/i, /^Se connecter$/i,
  /^Inscription gratuite$/i, /^Partager$/i, /^Share$/i, /^Log in$/i, /^Sign up/i, /^Afficher plus$/i, /^Show more$/i,
  /^Signaler la conversation$/i, /^Ceci est une copie/i, /^This is a copy of a/i, /peut se tromper\.?$/i,
  /can make mistakes/i, /^(R[ée]fl[ée]chi|Thought|Thinking) (pendant|for) /i, /^Voir les offres/i, /^Param[eè]tres$/i, /^Connectez-vous/i, /^Flash([- ]Lite)?$/i, /^(Rapide|Fast|Thinking|Raisonnement)$/i, /n'est pas un [êe]tre humain/i,
  /^S'ouvre dans une nouvelle fen[êe]tre$/i, /^[ÀA] propos de\b/i, /^Abonnements$/i, /^Pour les entreprises$/i, /^Confidentialit[ée]$/i, /^Aide$/i, /^Sign in/i, /^Se connecter$/i,
]

export type Anonymised = { text: string, removed: string[] }

function removeSection(text: string, startRe: RegExp, nextRe: RegExp, placeholder: string): { text: string, hit: boolean } {
  const lines = text.split("\n")
  const start = lines.findIndex((l) => startRe.test(l.trim()))
  if (start === -1) return { text, hit: false }
  let end = lines.findIndex((l, i) => i > start && nextRe.test(l.trim()))
  if (end === -1) end = lines.length
  return { text: [...lines.slice(0, start), placeholder, ...lines.slice(end)].join("\n"), hit: true }
}

export function anonymise(raw: string): Anonymised {
  const removed: string[] = []
  let text = raw.replace(/\r\n/g, "\n")

  // Keep the package itself: from its own first heading (a line that is only the heading) to its last "COMPLETE" line.
  const lines = text.split("\n")
  const first = lines.findIndex((l) => /^1\.?\s*(CONCEPT|THE IDEA)\s*$/i.test(l.trim()))
  if (first === -1) {
    // A free-form answer without numbered headings: nothing marks where the answer starts, so keep everything except the
    // site chrome (removed below); the owner reads it before anything is published.
    removed.push("no package heading found: kept the whole text")
  }
  if (first !== -1) {
    let last = -1
    lines.forEach((l, i) => { if (/PACKAGE (PART )?COMPLETE\.?\s*$/i.test(l.trim())) last = i })
    // A model may print the completion line in the middle (after the images) and carry on with numbered sections: then
    // nothing after it is cut. Only trailing page text after the final completion line, with no heading after it, is cut.
    const headingAfter = last !== -1 && lines.slice(last + 1).some((l) => /^\d{1,2}\.?\s+[A-Z][A-Z /&-]{3,}\s*$/.test(l.trim()))
    text = lines.slice(first, last === -1 || headingAfter ? lines.length : last + 1).join("\n")
    removed.push("text before the package heading" + (last !== -1 && !headingAfter ? " and after the completion line" : ""))
  }

  text = text.split("\n").filter((l) => !SITE_CHROME.some((re) => re.test(l.trim()))).join("\n")

  const prov = removeSection(text, /^(8\.?\s*)?PROVENANCE( LOG)?$/i, /^(9\.?\s*)?RISKS$/i, "[provenance withheld until the review is finished]")
  text = prov.text
  if (prov.hit) removed.push("provenance section")

  const before = text
  text = text.replace(/https?:\/\/\S+/g, "[link removed]")
  text = text.replace(/\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g, "[email removed]")
  if (text !== before) removed.push("links and email addresses")

  const dateRe = /\b(20\d{2}-\d{2}-\d{2}|\d{1,2} (?:janvier|f[ée]vrier|mars|avril|mai|juin|juillet|ao[uû]t|septembre|octobre|novembre|d[ée]cembre) 20\d{2}|(?:January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}, 20\d{2})\b/gi
  if (dateRe.test(text)) removed.push("dates")
  text = text.replace(dateRe, "[date]")

  for (const w of IDENTITY_WORDS) {
    const re = new RegExp(`(?<![A-Za-z])${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:[-\\s]?[A-Za-z0-9.]*\\d[A-Za-z0-9.]*)?(?![A-Za-z])`, "gi")
    if (re.test(text)) { removed.push(`word: ${w}`); text = text.replace(re, "[name removed]") }
  }
  text = text.replace(/(\[name removed\]\s*){2,}/g, "[name removed] ").replace(/\n{3,}/g, "\n\n").trim() + "\n"
  return { text, removed }
}

// Words that must not survive: returns the leaks (empty when clean).
export function leaks(text: string): string[] {
  const found: string[] = []
  for (const w of IDENTITY_WORDS) {
    const re = new RegExp(`(?<![A-Za-z])${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![A-Za-z])`, "i")
    if (re.test(text)) found.push(w)
  }
  if (/https?:\/\//i.test(text)) found.push("url")
  if (/\b[\w.+-]+@[\w-]+\.[\w.-]+\b/.test(text)) found.push("email")
  return found
}
