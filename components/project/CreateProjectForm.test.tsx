import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createProjectFrom } from "@/lib/api/projects";
import { MESSAGES, renderWithIntl } from "@/test/intl";
import CreateProjectForm from "./CreateProjectForm";

const DEFAULT_PROJECT_NAME = MESSAGES.vi.app.createProject.defaultName;

vi.mock("@/lib/api/projects", () => ({ createProjectFrom: vi.fn() }));

const submit = () => screen.getByRole("button", { name: /Bắt đầu|Đang tạo/ });
const pickNew = (required: boolean) => {
  fireEvent.click(screen.getByRole("radio", { name: /Dự án mới/ }));
  fireEvent.click(screen.getByRole("radio", { name: required ? "Có" : "Không" }));
};

describe("CreateProjectForm (UC-13/14, FLF-335 — Dự án mới / Dự án có sẵn)", () => {
  beforeEach(() => {
    vi.mocked(createProjectFrom).mockReset();
  });

  it("điền sẵn tên; khoá nút khi chưa chọn hoặc chưa trả lời câu mẫu bắt buộc hoặc tên rỗng", () => {
    renderWithIntl(<CreateProjectForm variant="inline" onCreated={() => {}} />);
    const name = screen.getByLabelText("Tên dự án");

    expect(name).toHaveValue(DEFAULT_PROJECT_NAME);
    expect(submit()).toBeDisabled();
    expect(screen.getByText("Chọn một cách bắt đầu ở trên để tiếp tục.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: /Dự án mới/ }));
    expect(submit()).toBeDisabled();
    expect(screen.getByText(/Cho biết khách có bắt buộc theo mẫu không/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "Không" }));
    expect(submit()).toBeEnabled();

    fireEvent.change(name, { target: { value: "   " } });
    expect(submit()).toBeDisabled();
  });

  it("Dự án mới · không mẫu ⇒ gửi {name đã trim, source new, has_required_template false, ngôn ngữ} — không gửi mode", async () => {
    const created = { _id: "p9", name: "Lumen", mode: "fpt" };
    vi.mocked(createProjectFrom).mockResolvedValue({ data: created, error: null } as never);
    const onCreated = vi.fn();
    renderWithIntl(<CreateProjectForm variant="dialog" onCreated={onCreated} />);

    pickNew(false);
    fireEvent.change(screen.getByLabelText("Tên dự án"), { target: { value: "  Lumen " } });
    fireEvent.click(submit());

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(created));
    expect(createProjectFrom).toHaveBeenCalledWith({ name: "Lumen", source: "new", has_required_template: false, documentLanguage: "vi" });
  });

  it("Dự án mới · có mẫu bắt buộc ⇒ ngôn ngữ theo file (ẩn nhóm ngôn ngữ), has_required_template true", async () => {
    vi.mocked(createProjectFrom).mockResolvedValue({ data: { _id: "p1", mode: "import" }, error: null } as never);
    renderWithIntl(<CreateProjectForm variant="dialog" onCreated={() => {}} />);
    pickNew(true);
    expect(screen.queryByRole("radiogroup", { name: "Ngôn ngữ tài liệu" })).toBeNull();
    expect(screen.getByText(MESSAGES.vi.app.createProject.language.importHint)).toBeInTheDocument();
    fireEvent.click(submit());
    await waitFor(() => expect(createProjectFrom).toHaveBeenCalledWith({ name: DEFAULT_PROJECT_NAME, source: "new", has_required_template: true }));
  });

  it("Dự án có sẵn ⇒ không hỏi mẫu, ngôn ngữ theo file, gửi source existing", async () => {
    vi.mocked(createProjectFrom).mockResolvedValue({ data: { _id: "p1", mode: "import" }, error: null } as never);
    renderWithIntl(<CreateProjectForm variant="dialog" onCreated={() => {}} />);
    fireEvent.click(screen.getByRole("radio", { name: /Dự án có sẵn/ }));
    expect(screen.queryByRole("radiogroup", { name: /mẫu không/ })).toBeNull();
    expect(submit()).toBeEnabled();
    fireEvent.click(submit());
    await waitFor(() => expect(createProjectFrom).toHaveBeenCalledWith({ name: DEFAULT_PROJECT_NAME, source: "existing" }));
  });

  it("lỗi hiện dưới form, giữ nguyên lựa chọn và tên để thử lại", async () => {
    vi.mocked(createProjectFrom).mockRejectedValue(new Error("Hết hạn phiên"));
    const onCreated = vi.fn();
    renderWithIntl(<CreateProjectForm variant="inline" onCreated={onCreated} />);

    pickNew(false);
    fireEvent.click(submit());

    expect(await screen.findByRole("alert")).toHaveTextContent("Hết hạn phiên");
    expect(screen.getByRole("radio", { name: /Dự án mới/ })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "Không" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByLabelText("Tên dự án")).toHaveValue(DEFAULT_PROJECT_NAME);
    expect(submit()).toBeEnabled();
    expect(onCreated).not.toHaveBeenCalled();
  });

  it("dialog có nút Huỷ gọi onCancel, không tạo gì", () => {
    const onCancel = vi.fn();
    renderWithIntl(<CreateProjectForm variant="dialog" onCreated={() => {}} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole("button", { name: "Huỷ" }));

    expect(onCancel).toHaveBeenCalledOnce();
    expect(createProjectFrom).not.toHaveBeenCalled();
  });
});

describe("CreateProjectForm trong thư mục", () => {
  it("có folderId ⇒ tạo thẳng trong thư mục (một request)", async () => {
    vi.mocked(createProjectFrom).mockReset().mockResolvedValue({ data: { _id: "p1", mode: "fpt" }, error: null } as never);
    renderWithIntl(<CreateProjectForm variant="dialog" onCreated={() => {}} folderId="f1" />);

    pickNew(false);
    fireEvent.click(screen.getByRole("button", { name: /Bắt đầu/ }));

    await waitFor(() => expect(createProjectFrom).toHaveBeenCalledWith({ name: DEFAULT_PROJECT_NAME, source: "new", has_required_template: false, folderId: "f1", documentLanguage: "vi" }));
  });
});

describe("CreateProjectForm — ngôn ngữ tài liệu (FLF-265)", () => {
  beforeEach(() => {
    vi.mocked(createProjectFrom).mockReset().mockResolvedValue({ data: { _id: "p1", mode: "fpt" }, error: null } as never);
  });

  const languageGroup = () => screen.getByRole("radiogroup", { name: /Ngôn ngữ tài liệu|Document language/ });

  it("mặc định theo ngôn ngữ giao diện", () => {
    renderWithIntl(<CreateProjectForm variant="dialog" onCreated={() => {}} />);
    expect(languageGroup()).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Tiếng Việt" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "Tiếng Anh" })).toHaveAttribute("aria-checked", "false");
  });

  it("giao diện tiếng Anh ⇒ mặc định English", () => {
    renderWithIntl(<CreateProjectForm variant="dialog" onCreated={() => {}} />, "en");
    expect(screen.getByRole("radio", { name: "English" })).toHaveAttribute("aria-checked", "true");
  });

  it("đổi được (chuột lẫn phím mũi tên) và gửi trong request", async () => {
    renderWithIntl(<CreateProjectForm variant="dialog" onCreated={() => {}} />);
    pickNew(false);
    fireEvent.click(screen.getByRole("radio", { name: "Tiếng Anh" }));
    expect(screen.getByRole("radio", { name: "Tiếng Anh" })).toHaveAttribute("aria-checked", "true");

    fireEvent.keyDown(screen.getByRole("radio", { name: "Tiếng Anh" }), { key: "ArrowRight" });
    expect(screen.getByRole("radio", { name: "Tiếng Việt" })).toHaveAttribute("aria-checked", "true");
    fireEvent.keyDown(screen.getByRole("radio", { name: "Tiếng Việt" }), { key: "ArrowLeft" });

    fireEvent.click(submit());
    await waitFor(() => expect(createProjectFrom).toHaveBeenCalledWith({ name: DEFAULT_PROJECT_NAME, source: "new", has_required_template: false, documentLanguage: "en" }));
  });
});
