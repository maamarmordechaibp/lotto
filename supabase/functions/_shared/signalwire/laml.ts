// ============================================================
// _shared/signalwire/laml.ts
// Minimal LaML (TwiML-compatible) response builder for SignalWire
// voice webhooks. Produces XML for <Say>, <Play>, <Gather>, etc.
// ============================================================

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Default TTS voice (male). Override per-call via say({ voice }).
const DEFAULT_VOICE = "en-US-Neural2-D";
const DEFAULT_LANGUAGE = "en-US";

interface GatherOptions {
  action: string;
  input?: "dtmf" | "speech" | "dtmf speech";
  numDigits?: number;
  finishOnKey?: string;
  timeout?: number;
  speechTimeout?: string; // "auto" or seconds (speech input)
  method?: "POST" | "GET";
}

export class LamlBuilder {
  private parts: string[] = [];

  say(text: string, opts: { voice?: string; language?: string } = {}): this {
    const voice = opts.voice ?? DEFAULT_VOICE;
    const language = opts.language ?? DEFAULT_LANGUAGE;
    this.parts.push(
      `<Say voice="${escapeXml(voice)}" language="${escapeXml(language)}">${escapeXml(text)}</Say>`,
    );
    return this;
  }

  play(url: string): this {
    this.parts.push(`<Play>${escapeXml(url)}</Play>`);
    return this;
  }

  pause(seconds = 1): this {
    this.parts.push(`<Pause length="${seconds}"/>`);
    return this;
  }

  /** Collect DTMF and/or speech input; nested prompts render inside <Gather>. */
  gather(opts: GatherOptions, build: (inner: LamlBuilder) => void): this {
    const inner = new LamlBuilder();
    build(inner);
    const input = opts.input ?? "dtmf";
    const usesSpeech = input.includes("speech");
    const attrs = [
      `action="${escapeXml(opts.action)}"`,
      `input="${input}"`,
      opts.numDigits ? `numDigits="${opts.numDigits}"` : "",
      opts.finishOnKey ? `finishOnKey="${escapeXml(opts.finishOnKey)}"` : "",
      usesSpeech ? `speechTimeout="${escapeXml(opts.speechTimeout ?? "auto")}"` : "",
      `timeout="${opts.timeout ?? 8}"`,
      `method="${opts.method ?? "POST"}"`,
    ].filter(Boolean).join(" ");
    this.parts.push(`<Gather ${attrs}>${inner.innerXml()}</Gather>`);
    return this;
  }

  redirect(url: string, method: "POST" | "GET" = "POST"): this {
    this.parts.push(`<Redirect method="${method}">${escapeXml(url)}</Redirect>`);
    return this;
  }

  hangup(): this {
    this.parts.push("<Hangup/>");
    return this;
  }

  private innerXml(): string {
    return this.parts.join("");
  }

  /** Full LaML document. */
  toXml(): string {
    return `<?xml version="1.0" encoding="UTF-8"?><Response>${this.innerXml()}</Response>`;
  }

  toResponse(): Response {
    return new Response(this.toXml(), {
      status: 200,
      headers: { "Content-Type": "application/xml" },
    });
  }
}
