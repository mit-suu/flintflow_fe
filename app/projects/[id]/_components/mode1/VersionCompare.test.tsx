import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { http, HttpResponse } from "msw";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { API_BASE_URL } from "@/lib/api/client";
import { mockServer } from "@/mocks/server";
import { resetMockState } from "@/mocks/state";
import { MODE1_PROJECT_ID, resetMode1MockState } from "@/mocks/mode1/state";
import type { CompareResponse, DocVersion } from "@/types/doc-version";
import VersionCompare from "./VersionCompare";

const P = MODE1_PROJECT_ID;

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useParams: () => ({ id: MODE1_PROJECT_ID }),
}));

beforeAll(() => mockServer.listen({ onUnhandledRequest: "error" }));
beforeEach(() => {
  resetMockState();
  resetMode1MockState();
});
afterEach(() => mockServer.resetHandlers());
afterAll(() => mockServer.close());

const version = (v: string, kind: DocVersion["kind"] = "cr_revision"): DocVersion => ({
  version: v,
  kind,
  based_on: null,
  cr_ids: [],
  baseline_id: null,
  has_clean_file: kind === "release",
  has_tracked_file: kind === "cr_revision",
  has_original_file: kind === "imported",
  other_language_available: false,
  created_by: "u1",
  created_at: "2026-09-19T00:00:00.000Z",
});

/** Mới nhất trước, như GET /versions. */
const VERSIONS = [version("1.0", "release"), version("0.2"), version("0.1", "imported")];

const serveCompare = (res: (from: string, to: string) => CompareResponse | Response) => {
  const seen: { from: string | null; to: string | null }[] = [];
  mockServer.use(
    http.get(`${API_BASE_URL}/projects/:projectId/versions/compare`, ({ request }) => {
      const url = new URL(request.url);
      const from = url.searchParams.get("from");
      const to = url.searchParams.get("to");
      seen.push({ from, to });
      const out = res(from ?? "", to ?? "");
      return out instanceof Response ? out : HttpResponse.json({ data: out, error: null });
    })
  );
  return seen;
};

/** `FilterSelect` là combobox tự dựng (không phải `<select>` gốc): tên lấy từ `label`, chọn bằng mousedown trên option. */
const combo = (label: string) => screen.getByRole("combobox", { name: label });
const pick = (label: string, version: string) => {
  fireEvent.click(combo(label));
  fireEvent.mouseDown(screen.getByRole("option", { name: version }));
};

const EMPTY = { summary: { added: 0, removed: 0, modified: 0, moved: 0 }, blocks: [], sections: [] };

describe("VersionCompare - so sánh 2 version kiểu code review (UC-50)", () => {
  it("ít hơn 2 version ⇒ báo không so sánh được, không gọi API", () => {
    renderWithIntl(<VersionCompare projectId={P} versions={[version("0.1", "imported")]} />);
    expect(screen.getByText("Cần ít nhất 2 version để so sánh.")).toBeInTheDocument();
  });

  it("mặc định: bản ngay trước → bản mới nhất, tự so; nhóm theo mục, đủ 4 loại khác biệt", async () => {
    const seen = serveCompare((from, to) => ({
      from,
      to,
      summary: { added: 1, removed: 1, modified: 1, moved: 1 },
      blocks: [
        { block_id: null, change: "added", after: "NFR-P03: 500 concurrent learners.", section: "4.2.3 Performance", kind: "paragraph" },
        { block_id: "B0012", change: "removed", before: "[SmartArt]", section: "4.2.3 Performance", kind: "paragraph" },
        { block_id: "B0008", change: "modified", before: "one session", after: "all sessions", section: "3.2.1 Login", kind: "paragraph" },
        { block_id: "B0003", change: "moved", before: "Glossary", after: "Glossary", section: "5.5 Glossary", kind: "paragraph" },
      ],
      sections: [],
    }));
    renderWithIntl(<VersionCompare projectId={P} versions={VERSIONS} />);
    expect(combo("Từ")).toHaveTextContent("0.2");
    expect(combo("Đến")).toHaveTextContent("1.0");
    expect(await screen.findByText("1 thêm · 1 xoá · 1 sửa · 1 di chuyển")).toBeInTheDocument();
    expect(seen).toEqual([{ from: "0.2", to: "1.0" }]);

    const perf = screen.getByRole("region", { name: "4.2.3 Performance" });
    expect(within(perf).getByText("NFR-P03: 500 concurrent learners.")).toHaveClass("text-success");
    expect(within(perf).getByText("[SmartArt]")).toHaveClass("line-through");
    // `block_id` là id bookmark neo trong file Word, không mang nghĩa cho user ⇒ không in ra UI
    expect(screen.queryByText("B0012")).toBeNull();
    const login = screen.getByRole("region", { name: "3.2.1 Login" });
    expect(within(login).getByText("one").tagName).toBe("DEL");
    expect(within(login).getByText("all").tagName).toBe("INS");
    const glossary = screen.getByRole("region", { name: "5.5 Glossary" });
    expect(within(glossary).getByText("đổi chỗ")).toBeInTheDocument();
    expect(glossary.querySelector("ins, del")).toBeNull();
  });

  it("mount lúc danh sách còn rỗng rồi mới có dữ liệu ⇒ chọn sẵn đúng hai version, không gọi API với mã rỗng", async () => {
    const seen = serveCompare((from, to) => ({ from, to, ...EMPTY }));
    const { rerender } = renderWithIntl(<VersionCompare projectId={P} versions={[]} />);
    expect(screen.getByText("Cần ít nhất 2 version để so sánh.")).toBeInTheDocument();
    rerender(<VersionCompare projectId={P} versions={VERSIONS} />);
    expect(combo("Từ")).toHaveTextContent("0.2");
    expect(await screen.findByText("Không có khác biệt.")).toBeInTheDocument();
    expect(seen).toEqual([{ from: "0.2", to: "1.0" }]);
  });

  it("đổi version ⇒ so lại; version đang chọn bị xoá khỏi danh sách ⇒ rơi về mặc định", async () => {
    const seen = serveCompare((from, to) => ({ from, to, ...EMPTY }));
    const { rerender } = renderWithIntl(<VersionCompare projectId={P} versions={VERSIONS} />);
    await screen.findByText("Không có khác biệt.");
    pick("Từ", "0.1");
    await waitFor(() => expect(seen).toEqual([{ from: "0.2", to: "1.0" }, { from: "0.1", to: "1.0" }]));
    rerender(<VersionCompare projectId={P} versions={[version("1.0", "release"), version("0.2")]} />);
    expect(combo("Từ")).toHaveTextContent("0.2");
    await waitFor(() => expect(seen.at(-1)).toEqual({ from: "0.2", to: "1.0" }));
  });

  it("chọn cùng một version ⇒ gợi ý, không gọi API", async () => {
    const seen = serveCompare((from, to) => ({ from, to, ...EMPTY }));
    renderWithIntl(<VersionCompare projectId={P} versions={VERSIONS} />);
    await screen.findByText("Không có khác biệt.");
    pick("Từ", "1.0");
    expect(screen.getByText("Chọn hai version khác nhau.")).toBeInTheDocument();
    expect(seen).toEqual([{ from: "0.2", to: "1.0" }]);
  });

  it("BE lỗi ⇒ hiện thông điệp; đổi version so lại thành công thì xoá lỗi", async () => {
    let fail = true;
    serveCompare((from, to) =>
      fail ? HttpResponse.json({ data: null, error: { code: "DOC_VERSION_NOT_FOUND", message: `Không có version ${from}` } }, { status: 404 }) : { from, to, ...EMPTY }
    );
    renderWithIntl(<VersionCompare projectId={P} versions={VERSIONS} />);
    expect(await screen.findByText("Không có version 0.2")).toBeInTheDocument();
    fail = false;
    pick("Từ", "0.1");
    await waitFor(() => expect(screen.queryByText("Không có version 0.2")).not.toBeInTheDocument());
    expect(await screen.findByText("Không có khác biệt.")).toBeInTheDocument();
  });
});
