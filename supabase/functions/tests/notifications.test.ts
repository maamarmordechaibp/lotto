// Deno tests for notification template rendering. Run: deno test --allow-all
import { assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { renderTemplate, type NotificationContext } from "../_shared/notifications.ts";

const ctx: NotificationContext = {
  firstName: "Jane",
  lastName: "Doe",
  lotteryName: "Summer Grand Prize",
  ticketNumber: 247,
  amountDollars: 247,
  prize: "Electric Vehicle",
  drawingDate: "Aug 1, 2026",
  confirmationUrl: "https://x/confirm?ticket=247",
};

Deno.test("renderTemplate substitutes placeholders", () => {
  const out = renderTemplate("Ticket {{ticketNumber}} for {{firstName}} — ${{amountDollars}}", ctx);
  assertEquals(out, "Ticket 247 for Jane — $247");
});

Deno.test("renderTemplate leaves unknown placeholders empty", () => {
  const out = renderTemplate("Hi {{unknownKey}}!", ctx);
  assertEquals(out, "Hi !");
});

Deno.test("renderTemplate handles the default SMS shape", () => {
  const out = renderTemplate(
    "Lottery: {{lotteryName}}\nTicket Number: {{ticketNumber}}\nPrize: {{prize}}",
    ctx,
  );
  assertStringIncludes(out, "Summer Grand Prize");
  assertStringIncludes(out, "247");
  assertStringIncludes(out, "Electric Vehicle");
});
