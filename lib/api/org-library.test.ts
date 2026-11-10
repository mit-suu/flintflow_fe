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
      () => api.importFromOrgTemplate("p1", "t1"),
      "/projects/p1/import/from-org",
      { method: "POST", body: JSON.stringify({ org_template_id: "t1" }) },
    ],
    [
      "importFromOrgTemplate chọn bản",
      () => api.importFromOrgTemplate("p1", "t1", 1),
      "/projects/p1/import/from-org",
      { method: "POST", body: JSON.stringify({ org_template_id: "t1", version: 1 }) },
    ],
    ["deleteTemplateVersion", () => api.deleteTemplateVersion("o1", "t1", 2), "/orgs/o1/templates/t1/versions/2", { method: "DELETE" }],
    [
      "publishTemplateVersion",
      () => api.publishTemplateVersion("o1", "t1", 2, [{ index: 3, section_id: "fixed:2.1" }]),
      "/orgs/o1/templates/t1/versions/2/publish",
      { method: "POST", body: JSON.stringify({ headings: [{ index: 3, section_id: "fixed:2.1" }] }) },
    ],
    ["getTemplateVersion", () => api.getTemplateVersion("o1", "t1", 2), "/orgs/o1/templates/t1/versions/2", undefined],
    ["getSkeletonPending", () => api.getSkeletonPending("p1"), "/projects/p1/template-skeleton", undefined],
    [
      "decideSkeletonPending",
      () => api.decideSkeletonPending("p1", [{ key: "B0001", decision: "keep" }]),
      "/projects/p1/template-skeleton/decisions",
      { method: "POST", body: JSON.stringify({ decisions: [{ key: "B0001", decision: "keep" }] }) },
    ],
    ["suggestSkeletonNames", () => api.suggestSkeletonNames("p1"), "/projects/p1/template-skeleton/suggest", { method: "POST" }],
    ["saveImportToOrg", () => api.saveImportToOrg("p1", "IEEE"), "/projects/p1/import/save-to-org", { method: "POST", body: JSON.stringify({ name: "IEEE" }) }],
    ["libraryMatches", () => api.libraryMatches("p1"), "/projects/p1/library-matches", undefined],
    ["saveSectionToLibrary", () => api.saveSectionToLibrary("p1", "CS01"), "/projects/p1/library", { method: "POST", body: JSON.stringify({ custom_section_id: "CS01" }) }],
  ] as const)("%s gọi đúng endpoint", async (_name, call, path, init) => {
    await call();
    if (init === undefined) expect(apiCall).toHaveBeenCalledWith(path);
    else expect(apiCall).toHaveBeenCalledWith(path, init);
  });
});
