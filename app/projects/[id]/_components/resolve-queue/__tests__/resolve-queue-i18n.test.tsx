import { screen } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import vi from "@/messages/vi.json";
import { mockServer } from "@/mocks/server";
import { renderWithIntl } from "@/test/intl";
import { Harness, item, makeHandlers, queueOf } from "./resolve-queue-harness";

beforeAll(() => mockServer.listen({ onUnhandledRequest: "error" }));
beforeEach(() => window.localStorage.clear());
afterEach(() => mockServer.resetHandlers());
afterAll(() => mockServer.close());

const keysOf = (node: unknown, prefix = ""): string[] =>
  node !== null && typeof node === "object" ? Object.entries(node).flatMap(([k, v]) => keysOf(v, `${prefix}${k}.`)) : [prefix.slice(0, -1)];
const strings = (node: unknown): string[] =>
  typeof node === "string" ? [node] : node !== null && typeof node === "object" ? Object.values(node).flatMap(strings) : [];

describe("workspace.resolveQueue i18n", () => {
  it("vi và en có cùng cấu trúc key", () => {
    expect(keysOf(en.workspace.resolveQueue).sort()).toEqual(keysOf(vi.workspace.resolveQueue).sort());
  });

  it("không có em dash, 'FPT', Sparkle hay thuật ngữ nội bộ trong chữ hiển thị", () => {
    for (const text of [...strings(vi.workspace.resolveQueue), ...strings(en.workspace.resolveQueue)]) {
      expect(text).not.toMatch(/—|FPT|Spine|skeleton|sparkle/i);
    }
  });

  it("dải đổi sang tiếng Anh theo locale", async () => {
    renderWithIntl(<Harness initial={queueOf(item("screen:S01", "screen", { screen_id: "S01" }))} handlers={makeHandlers()} />, "en");
    expect(await screen.findByText("1 item waiting for your decision")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Resolve one by one" })).toBeInTheDocument();
  });
});
