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
    ["getTemplateProposal", () => api.getTemplateProposal("p1"), "/projects/p1/template-proposal", undefined],
    ["createTemplateProposal", () => api.createTemplateProposal("p1"), "/projects/p1/template-proposal", { method: "POST" }],
    ["actOnTemplateProposal send", () => api.actOnTemplateProposal("p1", "send"), "/projects/p1/template-proposal/send", { method: "POST" }],
    ["actOnTemplateProposal decline", () => api.actOnTemplateProposal("p1", "decline"), "/projects/p1/template-proposal/decline", { method: "POST" }],
    ["listTemplateProposals", () => api.listTemplateProposals("o1"), "/orgs/o1/template-proposals", undefined],
    ["getOrgTemplateProposal", () => api.getOrgTemplateProposal("o1", "x1"), "/orgs/o1/template-proposals/x1", undefined],
    ["decideTemplateProposal", () => api.decideTemplateProposal("o1", "x1", "approve"), "/orgs/o1/template-proposals/x1/approve", { method: "POST" }],
  ] as const)("%s gọi đúng endpoint", async (_name, call, path, init) => {
    await call();
    if (init === undefined) expect(apiCall).toHaveBeenCalledWith(path);
    else expect(apiCall).toHaveBeenCalledWith(path, init);
  });
});
