import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
  has_original_file: kind === "imported",
  created_by: "u1",
  created_at: "2026-09-19T00:00:00.000Z",
});

/** Mới nhất trước, như GET /versions. */
const VERSIONS = [version("1.0", "release"), version("0.1"), version("0.0", "imported")];

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

const selects = () => {
  const [from, to] = screen.getAllByRole("combobox");
  return { from, to };
};

describe("VersionCompare — so sánh 2 version theo block (UC-55)", () => {
  it("ít hơn 2 version ⇒ báo không so sánh được", () => {
    render(<VersionCompare projectId={P} versions={[version("0.0", "imported")]} />);
    expect(screen.getByText("Cần ít nhất 2 version để so sánh.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "So sánh" })).not.toBeInTheDocument();
  });

  it("mặc định: bản ngay trước → bản mới nhất; gửi đúng from/to và hiện đủ 4 loại khác biệt", async () => {
    const seen = serveCompare((from, to) => ({
      from,
      to,
      summary: { added: 1, removed: 1, modified: 1, moved: 1 },
      blocks: [
        { block_id: null, change: "added", after: "NFR-P03: 500 concurrent learners." },
        { block_id: "B0012", change: "removed", before: "[SmartArt]" },
        { block_id: "B0008", change: "modified", before: "one session", after: "all sessions" },
        { block_id: "B0003", change: "moved" },
      ],
    }));
    render(<VersionCompare projectId={P} versions={VERSIONS} />);
    expect(selects().from).toHaveValue("0.1");
    expect(selects().to).toHaveValue("1.0");

    fireEvent.click(screen.getByRole("button", { name: "So sánh" }));
    expect(await screen.findByText("0.1 → 1.0: 1 thêm · 1 xoá · 1 sửa · 1 di chuyển")).toBeInTheDocument();
    expect(seen).toEqual([{ from: "0.1", to: "1.0" }]);

    const items = screen.getAllByRole("listitem");
    expect(within(items[0]).getByText("Thêm")).toBeInTheDocument();
    expect(within(items[0]).getByText("block mới")).toBeInTheDocument();
    expect(within(items[0]).getByText("NFR-P03: 500 concurrent learners.").tagName).toBe("INS");
    expect(within(items[1]).getByText("Xoá")).toBeInTheDocument();
    expect(within(items[1]).getByText("[SmartArt]").tagName).toBe("DEL");
    expect(within(items[2]).getByText("one session").tagName).toBe("DEL");
    expect(within(items[2]).getByText("all sessions").tagName).toBe("INS");
    expect(within(items[3]).getByText("Di chuyển")).toBeInTheDocument();
    expect(items[3].querySelector("ins, del")).toBeNull();
  });

  it("chọn cùng một version ⇒ nút khoá kèm gợi ý; chọn lại thì so được", async () => {
    const seen = serveCompare((from, to) => ({ from, to, summary: { added: 0, removed: 0, modified: 0, moved: 0 }, blocks: [] }));
    render(<VersionCompare projectId={P} versions={VERSIONS} />);

    fireEvent.change(selects().from, { target: { value: "1.0" } });
    expect(screen.getByRole("button", { name: "So sánh" })).toBeDisabled();
    expect(screen.getByText("Chọn hai version khác nhau.")).toBeInTheDocument();

    fireEvent.change(selects().from, { target: { value: "0.0" } });
    fireEvent.click(screen.getByRole("button", { name: "So sánh" }));
    expect(await screen.findByText("Không có khác biệt.")).toBeInTheDocument();
    expect(seen).toEqual([{ from: "0.0", to: "1.0" }]);
  });

  it("BE lỗi ⇒ hiện thông điệp; so lại thành công thì xoá lỗi", async () => {
    let fail = true;
    serveCompare((from, to) =>
      fail
        ? HttpResponse.json({ data: null, error: { code: "DOC_VERSION_NOT_FOUND", message: `Không có version ${from}` } }, { status: 404 })
        : { from, to, summary: { added: 0, removed: 0, modified: 0, moved: 0 }, blocks: [] }
    );
    render(<VersionCompare projectId={P} versions={VERSIONS} />);

    fireEvent.click(screen.getByRole("button", { name: "So sánh" }));
    expect(await screen.findByText("Không có version 0.1")).toBeInTheDocument();

    fail = false;
    fireEvent.click(screen.getByRole("button", { name: "So sánh" }));
    await waitFor(() => expect(screen.queryByText("Không có version 0.1")).not.toBeInTheDocument());
    expect(screen.getByText(/0.1 → 1.0: 0 thêm/)).toBeInTheDocument();
  });
});
