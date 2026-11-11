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
    [
      "listOrgTemplatesPage",
      () => api.listOrgTemplatesPage("o1", { page: 2, q: "ngân hàng", sort: "name" }),
      "/orgs/o1/templates?page=2&limit=20&sort=name&q=ng%C3%A2n+h%C3%A0ng",
      undefined,
    ],
    ["deleteOrgTemplate", () => api.deleteOrgTemplate("o1", "t1"), "/orgs/o1/templates/t1", { method: "DELETE" }],
    [
      "importFromOrgTemplate",
      () => api.importFromOrgTemplate("p1", "t1"),
      "/projects/p1/import/from-org",
      { method: "POST", body: JSON.stringify({ org_template_id: "t1" }) },
    ],
    ["saveImportToOrg", () => api.saveImportToOrg("p1", "IEEE"), "/projects/p1/import/save-to-org", { method: "POST", body: JSON.stringify({ name: "IEEE" }) }],
  ] as const)("%s gọi đúng endpoint", async (_name, call, path, init) => {
    await call();
    if (init === undefined) expect(apiCall).toHaveBeenCalledWith(path);
    else expect(apiCall).toHaveBeenCalledWith(path, init);
  });
});
