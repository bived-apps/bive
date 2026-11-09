// Bounded reader for a Fetch Request body: enforces the registry's 8,192-byte
// limit while streaming, instead of buffering an arbitrarily large body first.
const DEFAULT_LIMIT = 8192;

export class ReportBodyTooLargeError extends Error {
  constructor(message = "report body too large") {
    super(message);
    this.name = "ReportBodyTooLargeError";
  }
}

async function readReportBody(input, limit = DEFAULT_LIMIT) {
  const stream =
    input && typeof input.getReader === "function"
      ? input
      : input && input.body && typeof input.body.getReader === "function"
        ? input.body
        : null;
  if (!stream) return "";
  const reader = stream.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = value instanceof Uint8Array ? value : new Uint8Array(value);
      total += chunk.byteLength;
      if (total > limit) {
        try { await reader.cancel(); } catch { /* ignore */ }
        throw new ReportBodyTooLargeError();
      }
      chunks.push(chunk);
    }
  } catch (err) {
    if (err instanceof ReportBodyTooLargeError) throw err;
    try { await reader.cancel(); } catch { /* ignore */ }
    throw err;
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) { out.set(c, offset); offset += c.byteLength; }
  return new TextDecoder().decode(out);
}

export { readReportBody };
export const readBody = readReportBody;
export const readRequestBody = readReportBody;
export const readBoundedBody = readReportBody;
export const readBodyText = readReportBody;

export const MAX_REPORT_BODY_BYTES = DEFAULT_LIMIT;
export const MAX_BODY_BYTES = DEFAULT_LIMIT;
export const BODY_LIMIT = DEFAULT_LIMIT;
export const LIMIT = DEFAULT_LIMIT;

export default readReportBody;