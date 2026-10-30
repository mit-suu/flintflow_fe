import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiCall } from "./client";
import * as api from "./org-library";

vi.mock("./client", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  apiCall: vi.fn(async () => ({ data: [], error: null })),
}));

describe("org-library API (FLF-278 trên FLF-335/336)", () => {
  beforeEach(() => vi.mocked(apiCall).mockClear());

  it.each([
    ["listOrgTemplates", () => api.listOrgTemplates("o1"), "/orgs/o1/templates", undefined],
    ["deleteOrgTemplate", () => api.deleteOrgTemplate("o1", "t1"), "/orgs/o1/templates/t1", { method: "DELETE" }],
    ["listContentLibrary", () => api.listContentLibrary("o1"), "/orgs/o1/content-library", undefined],
    [
      "upsertContentEntry",
      () => api.upsertContentEntry("o1", { title: "References", blocks: [{ kind: "paragraph", text: "IEEE 830" }] }),
      "/orgs/o1/content-library",
      { method: "POST", body: JSON.stringify({ title: "References", blocks: [{ kind: "paragraph", text: "IEEE 830" }] }) },
    ],
    ["updateContentEntry", () => api.updateContentEntry("o1", "e1", { title: "X" }), "/orgs/o1/content-library/e1", { method: "PATCH", body: JSON.stringify({ title: "X" }) }],
    ["deleteContentEntry", () => api.deleteContentEntry("o1", "e1"), "/orgs/o1/content-library/e1", { method: "DELETE" }],
    [
      "importFromOrgTemplate",
      () => api.importFromOrgTemplate("p1", "t1", "fixed"),
      "/projects/p1/import/from-org",
      { method: "POST", body: JSON.stringify({ org_template_id: "t1", intent: "fixed" }) },
    ],
    ["saveImportToOrg", () => api.saveImportToOrg("p1", "IEEE"), "/projects/p1/import/save-to-org", { method: "POST", body: JSON.stringify({ name: "IEEE" }) }],
    ["libraryMatches", () => api.libraryMatches("p1"), "/projects/p1/library-matches", undefined],
    ["saveSectionToLibrary", () => api.saveSectionToLibrary("p1", "CS01"), "/projects/p1/library", { method: "POST", body: JSON.stringify({ custom_section_id: "CS01" }) }],
  ] as const)("%s gọi đúng endpoint", async (_name, call, path, init) => {
    await call();
    if (init === undefined) expect(apiCall).toHaveBeenCalledWith(path);
    else expect(apiCall).toHaveBeenCalledWith(path, init);
  });
});
