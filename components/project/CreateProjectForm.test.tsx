import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createProjectFrom } from "@/lib/api/projects";
import { precheckDocx, uploadProjectDocument } from "@/lib/api/documents";
import { uploadImport } from "@/lib/api/import";
import { MESSAGES, renderWithIntl } from "@/test/intl";
import CreateProjectForm from "./CreateProjectForm";

const DEFAULT_PROJECT_NAME = MESSAGES.vi.app.createProject.defaultName;

vi.mock("@/lib/api/projects", () => ({ createProjectFrom: vi.fn() }));
vi.mock("@/lib/api/documents", () => ({ precheckDocx: vi.fn(), uploadProjectDocument: vi.fn() }));
vi.mock("@/lib/api/import", () => ({ uploadImport: vi.fn() }));
vi.mock("@/lib/api/org-library", () => ({ importFromOrgTemplate: vi.fn(), listOrgTemplates: vi.fn(async () => []) }));

const submit = () => screen.getByRole("button", { name: /Bắt đầu|Đang tạo/ });
const docx = (name: string) => new File(["PK"], name, { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
const srsInput = () => document.querySelector<HTMLInputElement>('input[type="file"][accept=".docx"]')!;
const refInput = () => document.querySelector<HTMLInputElement>('input[type="file"][multiple]')!;
const created = { data: { _id: "p1", mode: "import" }, error: null } as never;

beforeEach(() => {
  vi.mocked(createProjectFrom).mockReset().mockResolvedValue(created);
  vi.mocked(uploadImport).mockReset().mockResolvedValue({ data: {}, error: null } as never);
  vi.mocked(uploadProjectDocument).mockReset().mockResolvedValue({ data: {}, error: null } as never);
  vi.mocked(precheckDocx).mockReset().mockResolvedValue({ data: { looks_like_srs: false, stamp: null }, error: null } as never);
});

describe("CreateProjectForm — hộp Tạo dự án hai ô (business-flow §1)", () => {
  it("không còn câu hỏi Dự án mới / có sẵn; điền sẵn tên; tên rỗng ⇒ khoá nút", () => {
    renderWithIntl(<CreateProjectForm variant="dialog" onCreated={() => {}} />);
    expect(screen.queryByText(/Dự án có sẵn|Khách có bắt buộc/)).not.toBeInTheDocument();
    expect(screen.getByLabelText("Tên dự án")).toHaveValue(DEFAULT_PROJECT_NAME);
    expect(submit()).toBeEnabled();
    fireEvent.change(screen.getByLabelText("Tên dự án"), { target: { value: "  " } });
    expect(submit()).toBeDisabled();
  });

  it("không có SRS ⇒ has_srs_file false + ngôn ngữ; ô chọn Bổ sung không hiện", async () => {
    const onCreated = vi.fn();
    renderWithIntl(<CreateProjectForm variant="dialog" onCreated={onCreated} />);
    expect(screen.queryByLabelText(/Bổ sung các mục còn thiếu/)).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Tên dự án"), { target: { value: "  Lumen  " } });
    fireEvent.click(submit());
    await waitFor(() => expect(createProjectFrom).toHaveBeenCalledWith({ name: "Lumen", has_srs_file: false, documentLanguage: "vi" }));
    expect(uploadImport).not.toHaveBeenCalled();
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith({ _id: "p1", mode: "import" }));
  });

  it("có SRS ⇒ ẩn chọn ngôn ngữ, gửi has_srs_file (không tick ⇒ không gửi complete_to_standard) rồi tải file lên /import", async () => {
    renderWithIntl(<CreateProjectForm variant="dialog" onCreated={() => {}} />);
    const file = docx("SRS.docx");
    fireEvent.change(srsInput(), { target: { files: [file] } });
    expect(screen.getByText("SRS.docx")).toBeInTheDocument();
    expect(screen.queryByRole("radiogroup", { name: /Ngôn ngữ tài liệu/ })).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Bổ sung các mục còn thiếu/)).not.toBeChecked();
    fireEvent.click(submit());
    await waitFor(() => expect(createProjectFrom).toHaveBeenCalledWith({ name: DEFAULT_PROJECT_NAME, has_srs_file: true }));
    await waitFor(() => expect(uploadImport).toHaveBeenCalledWith("p1", file));
  });

  it("tick Bổ sung ⇒ complete_to_standard true; ⓘ có chữ giải thích nối vào ô chọn", async () => {
    renderWithIntl(<CreateProjectForm variant="dialog" onCreated={() => {}} />);
    fireEvent.change(srsInput(), { target: { files: [docx("SRS.docx")] } });
    const checkbox = screen.getByLabelText(/Bổ sung các mục còn thiếu/);
    expect(screen.getByRole("tooltip")).toHaveTextContent(/Mặc định FlintFlow giữ đúng các mục của file/);
    expect(checkbox).toHaveAccessibleDescription(/Mặc định FlintFlow giữ đúng các mục của file/);
    fireEvent.click(checkbox);
    fireEvent.click(submit());
    await waitFor(() => expect(createProjectFrom).toHaveBeenCalledWith({ name: DEFAULT_PROJECT_NAME, has_srs_file: true, complete_to_standard: true }));
  });

  it("ô SRS chỉ nhận .docx", () => {
    renderWithIntl(<CreateProjectForm variant="dialog" onCreated={() => {}} />);
    fireEvent.change(srsInput(), { target: { files: [new File(["x"], "SRS.pdf")] } });
    expect(screen.getByRole("alert")).toHaveTextContent("Ô SRS chỉ nhận file .docx.");
    expect(screen.queryByText("SRS.pdf")).not.toBeInTheDocument();
  });

  it("tài liệu tham khảo trông như SRS khi ô SRS trống ⇒ gợi ý; Chuyển sang ô SRS ⇒ file vào ô SRS", async () => {
    vi.mocked(precheckDocx).mockResolvedValue({ data: { looks_like_srs: true, stamp: null }, error: null } as never);
    renderWithIntl(<CreateProjectForm variant="dialog" onCreated={() => {}} />);
    fireEvent.change(refInput(), { target: { files: [docx("SRS cu.docx")] } });
    expect(await screen.findByText(/File này trông như một SRS/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Chuyển sang ô SRS" }));
    expect(screen.getByLabelText(/Bổ sung các mục còn thiếu/)).toBeInTheDocument();
    expect(screen.queryByText(/File này trông như một SRS/)).not.toBeInTheDocument();
  });

  it("có SRS + tham khảo trông như SRS ⇒ cảnh báo bản khác, Giữ làm tham khảo ⇒ ẩn gợi ý; tham khảo tải lên sau khi tạo", async () => {
    vi.mocked(precheckDocx).mockResolvedValue({ data: { looks_like_srs: true, stamp: null }, error: null } as never);
    renderWithIntl(<CreateProjectForm variant="dialog" onCreated={() => {}} />);
    fireEvent.change(srsInput(), { target: { files: [docx("SRS.docx")] } });
    const ref = docx("SRS khac.docx");
    fireEvent.change(refInput(), { target: { files: [ref] } });
    expect(await screen.findByText(/trông như một bản SRS khác/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Giữ làm tham khảo" }));
    expect(screen.queryByText(/trông như một bản SRS khác/)).not.toBeInTheDocument();
    fireEvent.click(submit());
    await waitFor(() => expect(uploadProjectDocument).toHaveBeenCalledWith("p1", ref));
  });

  it("FLF-398: chọn lại file trùng nội dung (kể cả đổi tên) hoặc chọn 2 file giống nhau ⇒ chỉ giữ một, báo trùng", async () => {
    renderWithIntl(<CreateProjectForm variant="dialog" onCreated={() => {}} />);
    const a = new File(["Biên bản họp 15/10"], "Bien ban.txt", { type: "text/plain" });
    fireEvent.change(refInput(), { target: { files: [a] } });
    expect(await screen.findByText("Bien ban.txt")).toBeInTheDocument();

    fireEvent.change(refInput(), { target: { files: [new File(["Biên bản họp 15/10"], "Bien ban (1).txt", { type: "text/plain" })] } });
    expect(await screen.findByText(/Đã có trong danh sách: Bien ban \(1\)\.txt/)).toBeInTheDocument();
    expect(screen.queryByText("Bien ban (1).txt")).not.toBeInTheDocument();

    const email = new File(["Email khách"], "email.txt", { type: "text/plain" });
    fireEvent.change(refInput(), { target: { files: [email, new File(["Email khách"], "email copy.txt", { type: "text/plain" })] } });
    expect(await screen.findByText("email.txt")).toBeInTheDocument();
    expect(screen.getByText(/Đã có trong danh sách: email copy\.txt/)).toBeInTheDocument();
    expect(screen.queryByText("email copy.txt")).not.toBeInTheDocument();
  });

  it("tải tham khảo lỗi không chặn: vào dự án ngay, file tải nền (lỗi báo ở trang dự án)", async () => {
    vi.mocked(uploadProjectDocument).mockRejectedValue(new Error("network"));
    const onCreated = vi.fn();
    renderWithIntl(<CreateProjectForm variant="dialog" onCreated={onCreated} />);
    const ref = new File(["x"], "Bien ban.txt", { type: "text/plain" });
    fireEvent.change(refInput(), { target: { files: [ref] } });
    // FLF-398: file vào danh sách sau khi đọc xong (so trùng nội dung)
    await screen.findByText("Bien ban.txt");
    fireEvent.click(submit());
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith({ _id: "p1", mode: "import" }));
    await waitFor(() => expect(uploadProjectDocument).toHaveBeenCalledWith("p1", ref));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("lỗi tạo dự án ⇒ hiện dưới form, giữ nguyên lựa chọn để thử lại", async () => {
    vi.mocked(createProjectFrom).mockRejectedValueOnce(new Error("boom"));
    renderWithIntl(<CreateProjectForm variant="dialog" onCreated={() => {}} />);
    fireEvent.change(srsInput(), { target: { files: [docx("SRS.docx")] } });
    fireEvent.click(submit());
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("SRS.docx")).toBeInTheDocument();
    expect(submit()).toBeEnabled();
  });

  it("dialog có nút Huỷ gọi onCancel, không tạo gì", () => {
    const onCancel = vi.fn();
    renderWithIntl(<CreateProjectForm variant="dialog" onCreated={() => {}} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole("button", { name: "Huỷ" }));
    expect(onCancel).toHaveBeenCalled();
    expect(createProjectFrom).not.toHaveBeenCalled();
  });

  it("có folderId ⇒ tạo thẳng trong thư mục", async () => {
    renderWithIntl(<CreateProjectForm variant="dialog" onCreated={() => {}} folderId="f1" />);
    fireEvent.click(submit());
    await waitFor(() => expect(createProjectFrom).toHaveBeenCalledWith({ name: DEFAULT_PROJECT_NAME, has_srs_file: false, folderId: "f1", documentLanguage: "vi" }));
  });
});

describe("CreateProjectForm — ngôn ngữ tài liệu (FLF-265)", () => {
  it("mặc định theo ngôn ngữ giao diện", () => {
    renderWithIntl(<CreateProjectForm variant="dialog" onCreated={() => {}} />);
    expect(screen.getByRole("radio", { name: "Tiếng Việt" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "Tiếng Anh" })).toHaveAttribute("aria-checked", "false");
  });

  it("giao diện tiếng Anh ⇒ mặc định English", () => {
    renderWithIntl(<CreateProjectForm variant="dialog" onCreated={() => {}} />, "en");
    expect(screen.getByRole("radio", { name: "English" })).toHaveAttribute("aria-checked", "true");
  });

  it("đổi được (chuột lẫn phím mũi tên) và gửi trong request", async () => {
    renderWithIntl(<CreateProjectForm variant="dialog" onCreated={() => {}} />);
    fireEvent.click(screen.getByRole("radio", { name: "Tiếng Anh" }));
    expect(screen.getByRole("radio", { name: "Tiếng Anh" })).toHaveAttribute("aria-checked", "true");
    fireEvent.keyDown(screen.getByRole("radio", { name: "Tiếng Anh" }), { key: "ArrowRight" });
    expect(screen.getByRole("radio", { name: "Tiếng Việt" })).toHaveAttribute("aria-checked", "true");
    fireEvent.keyDown(screen.getByRole("radio", { name: "Tiếng Việt" }), { key: "ArrowLeft" });
    fireEvent.click(submit());
    await waitFor(() => expect(createProjectFrom).toHaveBeenCalledWith({ name: DEFAULT_PROJECT_NAME, has_srs_file: false, documentLanguage: "en" }));
  });
});
