import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { http, HttpResponse } from "msw";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { API_BASE_URL } from "@/lib/api/client";
import { mockServer } from "@/mocks/server";
import { resetMockState } from "@/mocks/state";
import { MODE1_PROJECT_ID, resetMode1MockState } from "@/mocks/mode1/state";
import * as mode1State from "@/mocks/mode1/state";
import ImportWizard from "./ImportWizard";

const P = MODE1_PROJECT_ID;
const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  useParams: () => ({ id: MODE1_PROJECT_ID }),
}));

beforeAll(() => mockServer.listen({ onUnhandledRequest: "error" }));
beforeEach(() => {
  resetMockState();
  resetMode1MockState();
  push.mockClear();
});
afterEach(() => mockServer.resetHandlers());
afterAll(() => mockServer.close());

const docx = (name = "SRS_Lumen.docx") =>
  new File(["PK mock"], name, { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });

const renderWizard = (credits: number | null = 100) => renderWithIntl(<ImportWizard projectId={P} credits={credits} pollMs={5} />);

/** Upload ⇒ màn báo credit một lần (FLF-343); trả nút Bắt đầu. */
const uploadToStart = async (credits: number | null = 100) => {
  renderWizard(credits);
  fireEvent.change(await screen.findByTestId("docx-input"), { target: { files: [docx()] } });
  expect(await screen.findByText("Sẵn sàng đọc tài liệu")).toBeInTheDocument();
  return screen.getByRole("button", { name: "Bắt đầu" });
};

describe("ImportWizard — FLF-343 một mạch trên mock", () => {
  it("upload ⇒ màn báo credit (ước tính gồm kiểm tra + câu hỏi bản mới nhất) ⇒ Bắt đầu một lần ⇒ không bước nào khác ⇒ trang tạo CR", async () => {
    const start = await uploadToStart();
    // ước tính một lần: lượt trích + lượt kiểm tra AI
    expect(screen.getByText(/lượt kiểm tra/)).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /bản mới nhất/ })).toBeChecked();
    expect(screen.queryByText(/Xác nhận mapping/)).toBeNull();
    fireEvent.click(start);

    await waitFor(() => expect(push).toHaveBeenCalledWith(`/projects/${P}`));
    expect(mode1State.mode1State.project.import_state).toBe("gap_review");
    expect(mode1State.mode1State.importDoc?.confirmed_latest_at).not.toBeNull();
    expect(mode1State.mode1State.baselines.filter((b) => b.type === "imported")).toHaveLength(1);
    // không còn nút xác nhận field / tạo baseline / Record of Changes
    expect(screen.queryByRole("button", { name: /Xác nhận tất cả field|Tạo baseline 0.1/ })).toBeNull();
  });

  it("bỏ tick 'bản mới nhất' ⇒ không chạy, cùng câu từ chối như trước; chọn file khác ⇒ về bước tải lên", async () => {
    const start = await uploadToStart();
    fireEvent.click(screen.getByRole("checkbox", { name: /bản mới nhất/ }));
    expect(start).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent("Hãy xác nhận đây là bản mới nhất trước.");
    expect(mode1State.mode1State.importDoc?.status).toBe("extracting");
    expect(mode1State.mode1State.extractRunning).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Chọn file khác" }));
    expect(await screen.findByTestId("docx-input")).toBeInTheDocument();
  });

  it("số dư nhỏ hơn ước tính ⇒ khoá Bắt đầu, gợi ý nạp credit", async () => {
    mode1State.mode1State.credits = 1;
    const start = await uploadToStart(1);
    expect(start).toBeDisabled();
    expect(screen.getByText(/Số dư chưa đủ cho ước tính này/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Nạp credit" })).toHaveAttribute("href", "/home/billing");
  });

  it("FLF-265: đang chạy hiện ngôn ngữ tài liệu nhận diện từ file (chỉ đọc)", async () => {
    const start = await uploadToStart();
    mode1State.mode1State.profile!.language = "vi";
    mode1State.mode1State.credits = 2; // dừng giữa lúc trích ⇒ ở lại bước chạy
    fireEvent.click(start);
    expect(await screen.findByText(/Trích field đang tạm dừng/)).toBeInTheDocument();
    expect(screen.getByText(/Ngôn ngữ tài liệu:/)).toHaveTextContent("Ngôn ngữ tài liệu: Tiếng Việt (nhận diện từ file)");
    expect(screen.queryByRole("radio")).toBeNull();
  });

  it("FLF-265: ngôn ngữ lạ / thiếu ⇒ coi là Tiếng Anh như BE (D1)", async () => {
    const start = await uploadToStart();
    mode1State.mode1State.profile!.language = "fr";
    mode1State.mode1State.credits = 2;
    fireEvent.click(start);
    expect(await screen.findByText(/Trích field đang tạm dừng/)).toBeInTheDocument();
    expect(screen.getByText(/Ngôn ngữ tài liệu:/)).toHaveTextContent("Ngôn ngữ tài liệu: Tiếng Anh (nhận diện từ file)");
  });

  it("kiểm tra hết credit trong job nền ⇒ dừng ở checking, banner; nạp rồi Tiếp tục ⇒ trang tạo CR", async () => {
    const start = await uploadToStart();
    // đủ trích 3 section (2 credit / lượt), hết ở bước kiểm tra
    mode1State.mode1State.credits = mode1State.mode1State.sections.length * 2;
    fireEvent.click(start);
    expect(await screen.findByText(/Đọc file và tạo bản gốc đang tạm dừng — hết credit/)).toBeInTheDocument();
    expect(mode1State.mode1State.importDoc?.status).toBe("checking");
    expect(push).not.toHaveBeenCalled();
    mode1State.mode1State.credits = 100;
    fireEvent.click(screen.getByRole("button", { name: "Tiếp tục" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith(`/projects/${P}`));
    expect(mode1State.mode1State.baselines.filter((b) => b.type === "imported")).toHaveLength(1);
  });

  it("tạo bản gốc lỗi giữa chừng ⇒ banner 'bị gián đoạn' ở baselining; Tiếp tục chạy lại tới trang tạo CR", async () => {
    const start = await uploadToStart();
    mode1State.mode1State.failNextFinalize = true;
    fireEvent.click(start);
    expect(await screen.findByText(/Đọc file và tạo bản gốc đang tạm dừng — bị gián đoạn/)).toBeInTheDocument();
    expect(screen.getByText(/phần dở đã được đưa về như trước/)).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Tiếp tục" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith(`/projects/${P}`));
  });

  it("hết credit giữa lúc trích ⇒ banner paused; nạp xong bấm Tiếp tục chạy tiếp tới trang tạo CR", async () => {
    const start = await uploadToStart();
    mode1State.mode1State.credits = 2; // đủ 1 section
    fireEvent.click(start);

    expect(await screen.findByText(/Trích field đang tạm dừng — hết credit/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Nạp credit" })).toHaveAttribute("href", "/home/billing");

    mode1State.mode1State.credits = 100;
    fireEvent.click(screen.getByRole("button", { name: "Tiếp tục" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith(`/projects/${P}`));
  });

  it("mở lại trang khi import đã xong ⇒ thẻ xong với link màn chat (workspace, không popup CR) + gap report, không tự chuyển", async () => {
    const start = await uploadToStart();
    fireEvent.click(start);
    await waitFor(() => expect(push).toHaveBeenCalled());
    push.mockClear();
    renderWizard();
    const links = await screen.findAllByRole("link", { name: "Mở màn hình chat" });
    expect(links[0]).toHaveAttribute("href", `/projects/${P}`);
    expect(push).not.toHaveBeenCalled();
  });

  it("FLF-357: thanh bước chỉ còn 3 bước (không “Kết quả đọc file”, không “Tạo change request”); xong ⇒ cả 3 bước đã qua", async () => {
    const start = await uploadToStart();
    const steps = within(screen.getByRole("list", { name: "Các bước import" })).getAllByRole("listitem");
    expect(steps.map((li) => li.textContent)).toEqual(["1. Tải lên", "2. Báo credit & bắt đầu", "3. Đọc file & tạo bản gốc"]);
    expect(screen.queryByText(/Tạo change request|Kết quả đọc file/)).not.toBeInTheDocument();
    fireEvent.click(start);
    await waitFor(() => expect(push).toHaveBeenCalledWith(`/projects/${P}`));
    push.mockClear();
    renderWizard();
    await screen.findAllByRole("link", { name: "Mở màn hình chat" });
    const done = within(screen.getAllByRole("list", { name: "Các bước import" }).at(-1)!).getAllByRole("listitem");
    expect(done).toHaveLength(3);
    for (const li of done) expect(li).not.toHaveAttribute("aria-current");
  });

  describe("Kết quả đọc file theo loại dự án (FLF-278)", () => {
    /** Upload qua mock rồi để GET /import trả `incomplete` + cấu trúc đích chế độ 3. */
    const incomplete = async () => {
      const { uploadImport } = await import("@/lib/api/import");
      await uploadImport(P, docx("Mau_SRS.docx"));
      const st = mode1State.mode1State;
      const doc = { ...st.importDoc!, status: "incomplete" as const, intent: "fixed" as const };
      const target_structure = {
        target: "template",
        intent: "fixed",
        resolved_mode: 3,
        compared_at: "2026-11-05T01:00:00.000Z",
        missing: ["fixed:4.2"],
        sections: [
          { section_id: "slot:vision", title: "1.1 Purpose", status: "present", owner_steps: [] },
          { section_id: "fixed:4.2", title: "3.2 Functional Requirements", status: "missing", owner_steps: ["S-5.1"] },
        ],
      };
      let continued = 0;
      mockServer.use(
        http.get(`${API_BASE_URL}/projects/:projectId/import`, () =>
          HttpResponse.json({ data: { import: doc, profile: st.profile, extraction: { sections: [], review_fields: [] }, blocks_count: 0, credit_estimate: null, target_structure }, error: null })
        ),
        http.get(`${API_BASE_URL}/projects/:projectId/spine`, () => HttpResponse.json({ data: { spine_version: 7 }, error: null })),
        http.post(`${API_BASE_URL}/projects/:projectId/import/continue`, async ({ request }) => {
          continued += 1;
          expect(await request.json()).toMatchObject({ import_id: doc.id, base_version: 7 });
          return HttpResponse.json({ data: { project_mode: "fpt", import_state: "drafting", current_step: "B-1.1", spine_version: 8 }, error: null });
        })
      );
      return () => continued;
    };

    it("dự án mới + mẫu bắt buộc ⇒ bước 'Đọc mẫu', chỉ Viết với FlintFlow ⇒ /import/continue rồi mở workspace", async () => {
      const continued = await incomplete();
      renderWithIntl(<ImportWizard projectId={P} credits={100} pollMs={5} startKind="new" templateIntent="fixed" />);
      const reading = await screen.findByRole("region", { name: "Kết quả đọc file" });
      expect(within(reading).getAllByRole("button").map((b) => b.textContent)).toEqual(["Viết với FlintFlow"]);
      expect(within(screen.getByRole("list", { name: "Các bước import" })).getAllByRole("listitem").at(-1)).toHaveTextContent("3. Đọc mẫu");
      fireEvent.click(within(reading).getByRole("button", { name: "Viết với FlintFlow" }));
      await waitFor(() => expect(push).toHaveBeenCalledWith(`/projects/${P}`));
      expect(continued()).toBe(1);
    });

    it("dự án có sẵn ⇒ một nút Tiếp tục sửa với FlintFlow, không có Viết với FlintFlow", async () => {
      await incomplete();
      renderWithIntl(<ImportWizard projectId={P} credits={100} pollMs={5} startKind="existing" templateIntent="fixed" />);
      const reading = await screen.findByRole("region", { name: "Kết quả đọc file" });
      expect(within(reading).getAllByRole("button").map((b) => b.textContent)).toEqual(["Tiếp tục sửa với FlintFlow"]);
    });
  });

  describe("bản ghi cũ (trước FLF-343) đi tiếp tới trang tạo CR", () => {
    /** Upload qua mock rồi đưa bản ghi về trạng thái cũ. */
    const legacy = async (status: "awaiting_latest_confirm" | "mapping_review" | "fields_review") => {
      const { uploadImport } = await import("@/lib/api/import");
      await uploadImport(P, docx());
      const st = mode1State.mode1State;
      st.importDoc!.status = status;
      st.project.import_state = status;
      if (status === "awaiting_latest_confirm") {
        st.profile = null;
        st.sections = [];
      }
      if (status === "mapping_review") {
        st.importDoc!.confirmed_latest_at = "2026-10-01T00:00:00.000Z";
        for (const h of st.profile!.heading_map) Object.assign(h, { confirmed: false, auto_confirmed: undefined });
      }
      if (status === "fields_review") {
        st.importDoc!.confirmed_latest_at = "2026-10-01T00:00:00.000Z";
        for (const sec of st.sections) Object.assign(sec, { status: "done", fields_total: 3 });
      }
    };

    it("awaiting_latest_confirm ⇒ màn Bắt đầu (hỏi bản mới nhất) ⇒ trang tạo CR", async () => {
      await legacy("awaiting_latest_confirm");
      renderWizard();
      expect(await screen.findByRole("checkbox", { name: /bản mới nhất/ })).toBeChecked();
      fireEvent.click(screen.getByRole("button", { name: "Bắt đầu" }));
      await waitFor(() => expect(push).toHaveBeenCalledWith(`/projects/${P}`));
      expect(mode1State.mode1State.importDoc?.confirmed_latest_at).not.toBeNull();
    });

    it("mapping_review ⇒ màn Bắt đầu (không hỏi lại) ⇒ mapping tự nhận ⇒ trang tạo CR", async () => {
      await legacy("mapping_review");
      renderWizard();
      fireEvent.click(await screen.findByRole("button", { name: "Bắt đầu" }));
      await waitFor(() => expect(push).toHaveBeenCalledWith(`/projects/${P}`));
      expect(mode1State.mode1State.profile!.heading_map.filter((h) => h.confidence < 0.8).every((h) => h.confirmed && h.auto_confirmed)).toBe(true);
    });

    it("fields_review ⇒ Tiếp tục ⇒ baseline 0.1 ⇒ trang tạo CR", async () => {
      await legacy("fields_review");
      renderWizard();
      fireEvent.click(await screen.findByRole("button", { name: "Tiếp tục" }));
      await waitFor(() => expect(push).toHaveBeenCalledWith(`/projects/${P}`));
      expect(mode1State.mode1State.baselines.filter((b) => b.type === "imported")).toHaveLength(1);
    });
  });

  it("tải lại trang giữa lúc job đã bật (BE không trả ước tính, cursor chưa ghi) ⇒ không hiện lại màn Bắt đầu, vẫn poll tới trang tạo CR", async () => {
    const { uploadImport, startExtraction } = await import("@/lib/api/import");
    const id = (await uploadImport(P, docx())).data!.import.id;
    await startExtraction(P, id, true);
    renderWizard();
    await waitFor(() => expect(mode1State.mode1State.importDoc?.status).toBe("gap_review"));
    expect(screen.queryByText("Sẵn sàng đọc tài liệu")).toBeNull();
  });

  it("preflight từ chối ⇒ danh sách lỗi kèm vị trí và cách sửa, cho tải file đã sửa", async () => {
    const rejected = {
      id: "66f000000000000000000001",
      project_id: P,
      original_name: "SRS_tracked.docx",
      size: 10,
      sha256: "a".repeat(64),
      status: "preflight_rejected",
      preflight: {
        status: "rejected",
        issues: [{ code: "FOREIGN_TRACK_CHANGE", message: "Track Changes của \"Nguyen Van A\" chưa được Accept/Reject", location: { block_ord: 5, text: "3.2.5 Create SRS project" } }],
      },
      stamp: null,
      confirmed_latest_at: null,
      paused: null,
      extract_cursor: null,
      created_at: "2026-09-19T00:00:00.000Z",
      updated_at: "2026-09-19T00:00:00.000Z",
    };
    let uploaded = false;
    mockServer.use(
      http.post(`${API_BASE_URL}/projects/:projectId/import`, () => {
        uploaded = true;
        return HttpResponse.json(
          { data: null, meta: { import_id: rejected.id, issues: rejected.preflight.issues }, error: { code: "IMPORT_FILE_REJECTED", message: "File chưa nhập được" } },
          { status: 422 }
        );
      }),
      http.get(`${API_BASE_URL}/projects/:projectId/import`, () =>
        HttpResponse.json({ data: { import: uploaded ? rejected : null, profile: null, extraction: { sections: [], review_fields: [] }, blocks_count: 0 }, error: null })
      )
    );
    renderWizard();
    fireEvent.change(await screen.findByTestId("docx-input"), { target: { files: [docx("SRS_tracked.docx")] } });

    expect(await screen.findByText("Track Changes chưa xử lý")).toBeInTheDocument();
    expect(screen.getByText(/đoạn thứ 5 — “3.2.5 Create SRS project”/)).toBeInTheDocument();
    expect(screen.getByText(/Accept\/Reject tất cả thay đổi/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tải lên file đã sửa" })).toBeInTheDocument();
  });

  it("file lớn hơn 40 MB bị chặn ở FE, không gọi API", async () => {
    renderWizard();
    const big = docx("big.docx");
    Object.defineProperty(big, "size", { value: 41 * 1024 * 1024 });
    fireEvent.change(await screen.findByTestId("docx-input"), { target: { files: [big] } });
    expect(await screen.findByText(/lớn hơn giới hạn 40 MB/)).toBeInTheDocument();
    expect(mode1State.mode1State.importDoc).toBeNull();
  });

  it("bước upload báo trước: file theo mẫu / đủ mục giữ nguyên file, thiếu mục thì in lại theo mẫu FlintFlow; file gốc tải lại được", async () => {
    renderWizard();
    await screen.findByTestId("docx-input");
    expect(screen.getByText("giữ nguyên file")).toBeInTheDocument();
    expect(screen.getByText(/in lại theo mẫu FlintFlow, không giữ định dạng Word/)).toBeInTheDocument();
    expect(screen.getByText(/File gốc luôn tải lại được/)).toBeInTheDocument();
  });

  it("dự án có sẵn theo mẫu cố định: chọn file khác sau khi upload ⇒ ý định vẫn là mẫu cố định (không rơi về tự do)", async () => {
    const { uploadImport } = await import("@/lib/api/import");
    await uploadImport(P, docx(), "fixed");
    renderWithIntl(<ImportWizard projectId={P} credits={100} pollMs={5} startKind="existing" templateIntent={null} />);
    await screen.findByText("Sẵn sàng đọc tài liệu");
    fireEvent.click(screen.getByRole("checkbox", { name: /bản mới nhất/ }));
    fireEvent.click(screen.getByRole("button", { name: "Chọn file khác" }));
    expect(await screen.findByRole("radio", { name: /Theo một mẫu cố định/ })).toBeChecked();
  });
});
