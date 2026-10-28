import { describe, expect, it } from "vitest";
import { formatDate, formatDateTime } from "./format";

describe("fechas", () => {
  it("fecha sola", () => expect(formatDate("2026-10-27")).toBe("27/10/2026"));
  it("timestamp en hora de Argentina", () => expect(formatDate("2026-10-28T01:00:00Z")).toBe("27/10/2026"));
  it("fecha y hora", () => expect(formatDateTime("2026-10-27T17:30:00Z")).toBe("27/10/2026 14:30"));
});
