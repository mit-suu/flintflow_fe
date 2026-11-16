import { http, HttpResponse } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { mockServer } from "@/mocks/server";
import { API_BASE_URL } from "./client";
import { patchMigrationMapping, restoreTemplateMigration, startTemplateMigration } from "./template-migration";

beforeAll(() => mockServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => mockServer.resetHandlers());
afterAll(() => mockServer.close());

const ok = (data: unknown = { id: "m1" }) => HttpResponse.json({ data, error: null });
const URL_ = `${API_BASE_URL}/projects/p1/template-migrations`;

describe("lib/api/template-migration", () => {
  it("start từ mẫu org gửi JSON { template_id, version }", async () => {
    let body: unknown;
    mockServer.use(http.post(URL_, async ({ request }) => ((body = await request.json()), ok())));
    await startTemplateMigration("p1", { kind: "template", template_id: "t1", version: 2 });
    expect(body).toEqual({ template_id: "t1", version: 2 });
  });

  it("start từ file gửi multipart; chỉ kèm publish_to_org / name / template_id khi Lead đăng", async () => {
    const seen: Record<string, string>[] = [];
    mockServer.use(
      http.post(URL_, async ({ request }) => {
        const form = await request.formData();
        seen.push(Object.fromEntries([...form.entries()].map(([k, v]) => [k, typeof v === "string" ? v : "(file)"])));
        return ok();
      })
    );
    const file = new File(["x"], "mau.docx");
    await startTemplateMigration("p1", { kind: "file", file });
    await startTemplateMigration("p1", { kind: "file", file, publish_to_org: true, name: "Mẫu mới" });
    await startTemplateMigration("p1", { kind: "file", file, publish_to_org: true, template_id: "t9" });
    expect(seen[0]).toEqual({ file: "(file)" });
    expect(seen[1]).toEqual({ file: "(file)", publish_to_org: "true", name: "Mẫu mới" });
    expect(seen[2]).toEqual({ file: "(file)", publish_to_org: "true", template_id: "t9" });
  });

  it("sửa mapping và khôi phục đúng đường dẫn", async () => {
    const calls: string[] = [];
    let mappingBody: unknown;
    mockServer.use(
      http.patch(`${URL_}/m1/mapping`, async ({ request }) => ((mappingBody = await request.json()), calls.push("mapping"), ok())),
      http.post(`${URL_}/m1/restore`, () => (calls.push("restore"), ok()))
    );
    await patchMigrationMapping("p1", "m1", [{ key: "n2", section_id: "fixed:1" }]);
    await restoreTemplateMigration("p1", "m1");
    expect(mappingBody).toEqual({ edits: [{ key: "n2", section_id: "fixed:1" }] });
    expect(calls).toEqual(["mapping", "restore"]);
  });
});
