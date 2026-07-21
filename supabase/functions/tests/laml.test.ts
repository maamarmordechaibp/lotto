// Deno tests for the LaML builder. Run: deno test --allow-all
import { assertStringIncludes, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { LamlBuilder } from "../_shared/signalwire/laml.ts";

Deno.test("LamlBuilder renders a valid Response document", () => {
  const xml = new LamlBuilder().say("Hello").hangup().toXml();
  assertStringIncludes(xml, '<?xml version="1.0" encoding="UTF-8"?>');
  assertStringIncludes(xml, "<Response>");
  assertStringIncludes(xml, "<Say");
  assertStringIncludes(xml, "Hello");
  assertStringIncludes(xml, "<Hangup/>");
});

Deno.test("LamlBuilder escapes XML in Say text", () => {
  const xml = new LamlBuilder().say("Tom & Jerry <3").toXml();
  assertStringIncludes(xml, "Tom &amp; Jerry &lt;3");
  assert(!xml.includes("Tom & Jerry <3"));
});

Deno.test("LamlBuilder nests prompts inside Gather", () => {
  const xml = new LamlBuilder()
    .gather({ action: "/next", numDigits: 1 }, (g) => g.say("Press 1"))
    .toXml();
  assertStringIncludes(xml, '<Gather action="/next"');
  assertStringIncludes(xml, "Press 1");
  assertStringIncludes(xml, 'input="dtmf"');
});
