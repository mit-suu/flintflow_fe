import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { MESSAGES, renderWithIntl } from "@/test/intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiClientError } from "@/lib/api/client";
import { deleteProject, renameProject, setDocumentLanguage } from "@/lib/api/projects";
import { getTranslationStatus, runTranslation } from "@/lib/api/translations";
import type { TranslationStatus } from "@/types/document";
import type { Project } from "@/types/project";
import ProjectActionDialogs from "./ProjectActionDialogs";

vi.mock("@/lib/api/projects", () => ({ renameProject: vi.fn(), deleteProject: vi.fn(), setDocumentLanguage: vi.fn() }));
// FLF-265: đổi ngôn ngữ xong đọc ước tính dịch — mặc định không còn mục nào (đổi xong là đóng như trước)
const { NOTHING_MISSING } = vi.hoisted(() => ({
  NOTHING_MISSING: { locale: "vi", source_locale: "en", total: 120, missing: 0, batches: 0, estimated_credits: 0 } satisfies TranslationStatus,
}));
vi.mock("@/lib/api/translations", () => ({
  getTranslationStatus: vi.fn(async () => ({ data: NOTHING_MISSING, error: null })),
  runTranslation: vi.fn(),
}));

const project: Project = {
  _id: "p1",
  name: "Lumen",
  status: "active",
  mode: "import",
  import_state: null,
  createdAt: "2026-09-01T00:00:00Z",
  updatedAt: "2026-09-01T00:00:00Z",
};

describe("ProjectActionDialogs", () => {
  beforeEach(() => {
    vi.mocked(renameProject).mockReset().mockResolvedValue({ data: null, error: null } as never);
    vi.mocked(deleteProject).mockReset().mockResolvedValue({ data: null, error: null } as never);
  });

  it("không có target ⇒ không render", () => {
    const { container } = renderWithIntl(<ProjectActionDialogs target={null} onClose={() => {}} onDone={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("đổi tên: điền sẵn tên cũ, gửi tên mới đã trim, tải lại rồi đóng", async () => {
    const onDone = vi.fn();
    const onClose = vi.fn();
    renderWithIntl(<ProjectActionDialogs target={{ action: "rename", project }} onClose={onClose} onDone={onDone} />);

    const input = screen.getByLabelText("Tên dự án mới");
    expect(input).toHaveValue("Lumen");
    expect(screen.getByRole("button", { name: "Lưu thay đổi" })).toBeDisabled(); // chưa đổi gì

    fireEvent.change(input, { target: { value: " Lumen 2 " } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(renameProject).toHaveBeenCalledWith("p1", "Lumen 2");
    expect(onDone).toHaveBeenCalled();
  });

  it.each([
    ["archive", "Lưu trữ", { hard: false }],
    ["delete", "Xoá vĩnh viễn", { hard: true }],
  ] as const)("%s: xác nhận ⇒ DELETE đúng kiểu", async (action, cta, opts) => {
    const onClose = vi.fn();
    renderWithIntl(<ProjectActionDialogs target={{ action, project }} onClose={onClose} onDone={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: cta }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(deleteProject).toHaveBeenCalledWith("p1", opts);
  });

  it("lỗi BE hiện trong dialog, không đóng", async () => {
    vi.mocked(deleteProject).mockRejectedValue(new Error("Không có quyền"));
    const onClose = vi.fn();
    renderWithIntl(<ProjectActionDialogs target={{ action: "delete", project }} onClose={onClose} onDone={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Xoá vĩnh viễn" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Không có quyền");
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("ProjectActionDialogs — ngôn ngữ tài liệu (FLF-265)", () => {
  const fpt: Project = { ...project, mode: "fpt", documentLanguage: "en" };

  beforeEach(() => {
    vi.mocked(setDocumentLanguage).mockReset().mockResolvedValue({ data: { ...fpt, documentLanguage: "vi" }, error: null } as never);
  });

  it("chọn sẵn ngôn ngữ hiện tại, có câu giải thích; chưa đổi ⇒ khoá nút", () => {
    renderWithIntl(<ProjectActionDialogs target={{ action: "documentLanguage", project: fpt }} onClose={() => {}} onDone={() => {}} />);
    expect(screen.getByRole("radio", { name: "Tiếng Anh" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText(/sơ đồ giữ tiếng Anh/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Đổi ngôn ngữ" })).toBeDisabled();
  });

  it("dự án cũ chưa có field ⇒ coi là tiếng Anh", () => {
    renderWithIntl(
      <ProjectActionDialogs target={{ action: "documentLanguage", project: { ...fpt, documentLanguage: undefined } }} onClose={() => {}} onDone={() => {}} />
    );
    expect(screen.getByRole("radio", { name: "Tiếng Anh" })).toHaveAttribute("aria-checked", "true");
  });

  it("đổi ⇒ gọi setDocumentLanguage, tải lại rồi đóng", async () => {
    const onDone = vi.fn();
    const onClose = vi.fn();
    renderWithIntl(<ProjectActionDialogs target={{ action: "documentLanguage", project: fpt }} onClose={onClose} onDone={onDone} />);
    fireEvent.click(screen.getByRole("radio", { name: "Tiếng Việt" }));
    fireEvent.click(screen.getByRole("button", { name: "Đổi ngôn ngữ" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(setDocumentLanguage).toHaveBeenCalledWith("p1", "vi");
    expect(onDone).toHaveBeenCalled();
  });

  it("409 DOCUMENT_LANGUAGE_LOCKED ⇒ câu đã dịch theo mã lỗi, không đóng", async () => {
    vi.mocked(setDocumentLanguage).mockRejectedValue(new ApiClientError(409, "DOCUMENT_LANGUAGE_LOCKED", "Document language follows the imported file"));
    const onClose = vi.fn();
    renderWithIntl(<ProjectActionDialogs target={{ action: "documentLanguage", project: fpt }} onClose={onClose} onDone={() => {}} />);
    fireEvent.click(screen.getByRole("radio", { name: "Tiếng Việt" }));
    fireEvent.click(screen.getByRole("button", { name: "Đổi ngôn ngữ" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(MESSAGES.vi.errors.DOCUMENT_LANGUAGE_LOCKED);
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("ProjectActionDialogs — đổi ngôn ngữ rồi mời dịch phần đã có (FLF-265, phase 1 §1.7)", () => {
  const fpt: Project = { ...project, mode: "fpt", documentLanguage: "en" };
  const missing: TranslationStatus = { locale: "vi", source_locale: "en", total: 120, missing: 120, batches: 3, estimated_credits: 6 };

  const changeToVietnamese = (props: Partial<React.ComponentProps<typeof ProjectActionDialogs>> = {}) => {
    const onDone = vi.fn();
    const onClose = vi.fn();
    const onCreditsSpent = vi.fn();
    renderWithIntl(
      <ProjectActionDialogs target={{ action: "documentLanguage", project: fpt }} onClose={onClose} onDone={onDone} onCreditsSpent={onCreditsSpent} {...props} />
    );
    fireEvent.click(screen.getByRole("radio", { name: "Tiếng Việt" }));
    fireEvent.click(screen.getByRole("button", { name: "Đổi ngôn ngữ" }));
    return { onDone, onClose, onCreditsSpent };
  };

  beforeEach(() => {
    vi.mocked(setDocumentLanguage).mockReset().mockResolvedValue({ data: { ...fpt, documentLanguage: "vi" }, error: null } as never);
    vi.mocked(getTranslationStatus).mockClear();
    vi.mocked(runTranslation).mockReset();
  });

  it("còn mục chưa dịch ⇒ chuyển sang hộp “Dịch tài liệu” với ước tính vừa đọc, danh sách đã tải lại, chưa đóng", async () => {
    vi.mocked(getTranslationStatus).mockResolvedValueOnce({ data: missing, error: null });
    const { onDone, onClose } = changeToVietnamese();

    const dialog = await screen.findByRole("dialog", { name: "Dịch tài liệu" });
    expect(dialog).toHaveTextContent("120 mục · ~6 credit");
    expect(setDocumentLanguage).toHaveBeenCalledWith("p1", "vi");
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
    // Ước tính đã đọc một lần để quyết mở hộp — hộp không đọc lại
    expect(getTranslationStatus).toHaveBeenCalledTimes(1);
  });

  it("không còn mục nào (missing 0) ⇒ đóng như cũ, không mở hộp dịch", async () => {
    const { onClose } = changeToVietnamese();

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(getTranslationStatus).toHaveBeenCalledWith("p1");
    expect(screen.queryByRole("dialog", { name: "Dịch tài liệu" })).toBeNull();
  });

  it("đọc ước tính lỗi ⇒ vẫn đóng (ngôn ngữ đã đổi; workspace còn cảnh báo mời dịch)", async () => {
    vi.mocked(getTranslationStatus).mockRejectedValueOnce(new Error("Không kết nối được máy chủ"));
    const { onClose } = changeToVietnamese();

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("dịch xong trong hộp ⇒ trang tải lại số dư (onCreditsSpent); Đóng ⇒ onClose", async () => {
    vi.mocked(getTranslationStatus).mockResolvedValueOnce({ data: missing, error: null });
    vi.mocked(runTranslation).mockResolvedValue({ data: { translated: 120, remaining: 0, credits_used: 6 }, error: null });
    const { onClose, onCreditsSpent } = changeToVietnamese();

    fireEvent.click(await screen.findByRole("button", { name: "Dịch ngay" }));
    expect(await screen.findByText("Đã dịch xong 120 mục.")).toBeInTheDocument();
    expect(onCreditsSpent).toHaveBeenCalledTimes(1);

    fireEvent.click(within(screen.getByRole("dialog")).getAllByRole("button", { name: "Đóng" }).at(-1)!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
