import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/intl";
import TargetPicker from "./TargetPicker";

vi.mock("@/lib/api/token-store", async (importOriginal) => ({ ...(await importOriginal<object>()), getActiveOrgId: () => "o1" }));
vi.mock("@/lib/api/org-library", () => ({
  listOrgTemplates: vi.fn(async () => [
    {
      id: "t1",
      name: "Mẫu ngân hàng",
      source_file_name: "bank.docx",
      heading_count: 42,
      custom_count: 9,
      template_family: null,
      uses: 2,
      created_at: "2026-10-20T00:00:00.000Z",
      latest_version: 3,
      project_count: 1,
      pending_count: 0,
      skeleton: false,
      versions: [
        { version: 4, status: "draft" },
        { version: 3, status: "published", source_file_name: "bank-v3.docx", heading_count: 42 },
        { version: 2, status: "published", source_file_name: "bank-v2.docx", heading_count: 40 },
        { version: 1, status: "published", source_file_name: "bank-v1.docx", heading_count: 30 },
      ],
    },
  ]),
}));

const radio = () => screen.findByRole("radio", { name: /Mẫu ngân hàng/ });
const openFile = () => fireEvent.click(screen.getByRole("button", { name: /Tải file mẫu/ }));

describe("TargetPicker", () => {
  it("chọn một mẫu rồi bấm một nút chính; dòng thông tin theo bản đang chọn", async () => {
    const onStart = vi.fn();
    renderWithIntl(<TargetPicker orgId="o1" canPublish={false} busy={false} preselect={null} previous={null} onStart={onStart} />);
    expect(await screen.findByText("bank-v3.docx · 42 mục · Bản 3 (mới nhất)")).toBeInTheDocument();
    // Chưa chọn mẫu ⇒ nút chính khoá; không còn nút ở từng dòng
    expect(screen.getByRole("button", { name: "Đổi sang mẫu này" })).toBeDisabled();
    fireEvent.click(await radio());
    expect(await radio()).toHaveAttribute("aria-checked", "true");
    fireEvent.change(screen.getByLabelText("Bản của mẫu Mẫu ngân hàng"), { target: { value: "1" } });
    expect(screen.getByText("bank-v1.docx · 30 mục · Bản 1")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Đổi sang mẫu Mẫu ngân hàng bản 1" }));
    expect(onStart).toHaveBeenCalledWith({ kind: "template", template_id: "t1", version: 1 });
  });

  it("không cho chọn bản nháp", async () => {
    renderWithIntl(<TargetPicker orgId="o1" canPublish={false} busy={false} preselect={null} previous={null} onStart={vi.fn()} />);
    fireEvent.click(await radio());
    const select = screen.getByLabelText("Bản của mẫu Mẫu ngân hàng") as HTMLSelectElement;
    expect(Array.from(select.options).map((o) => o.value)).toEqual(["3", "2", "1"]);
  });

  it("tìm theo tên không phân biệt dấu; không khớp thì báo", async () => {
    renderWithIntl(<TargetPicker orgId="o1" canPublish={false} busy={false} preselect={null} previous={null} onStart={vi.fn()} />);
    await radio();
    fireEvent.change(screen.getByRole("searchbox", { name: "Tìm mẫu" }), { target: { value: "ngan hang" } });
    expect(await radio()).toBeInTheDocument();
    fireEvent.change(screen.getByRole("searchbox", { name: "Tìm mẫu" }), { target: { value: "bệnh viện" } });
    expect(screen.getByText('Không có mẫu nào khớp "bệnh viện".')).toBeInTheDocument();
  });

  it("chưa biết org của dự án ⇒ đang tải, không báo tổ chức chưa có mẫu", () => {
    renderWithIntl(<TargetPicker orgId={undefined} canPublish={false} busy={false} preselect={null} previous={null} onStart={vi.fn()} />);
    expect(screen.getByRole("list", { name: "Đang tải danh sách mẫu…" })).toBeInTheDocument();
    expect(screen.queryByText("Tổ chức chưa có mẫu đã đăng.")).not.toBeInTheDocument();
  });

  it("chọn file bằng nút có chữ theo ngôn ngữ giao diện, hiện tên file đã chọn", () => {
    renderWithIntl(<TargetPicker orgId="o1" canPublish={false} busy={false} preselect={null} previous={null} onStart={vi.fn()} />);
    openFile();
    expect(screen.getByText("Chưa chọn file")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Chọn file" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("File mẫu (.docx)"), { target: { files: [new File(["x"], "mau.docx")] } });
    expect(screen.getByText("mau.docx")).toBeInTheDocument();
  });

  it("điền sẵn mẫu + bản từ thông báo và có lối quay về mẫu trước", async () => {
    const onStart = vi.fn();
    renderWithIntl(
      <TargetPicker
        orgId="o1"
        canPublish={false}
        busy={false}
        preselect={{ templateId: "t1", version: 2 }}
        previous={{ template_id: "t1", version: 1, name: "Mẫu ngân hàng", visibility: "org" }}
        onStart={onStart}
      />
    );
    expect(await radio()).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText("Có bản mới")).toBeInTheDocument();
    expect((screen.getByLabelText("Bản của mẫu Mẫu ngân hàng") as HTMLSelectElement).value).toBe("2");
    fireEvent.click(screen.getByRole("button", { name: "Quay về mẫu trước" }));
    expect(onStart).toHaveBeenCalledWith({ kind: "template", template_id: "t1", version: 1 });
  });

  it("chỉ Lead thấy ô đăng lên thư viện; Analyst tải file làm bản riêng", async () => {
    const onStart = vi.fn();
    const file = new File(["x"], "mau.docx");
    const { unmount } = renderWithIntl(<TargetPicker orgId="o1" canPublish={false} busy={false} preselect={null} previous={null} onStart={onStart} />);
    openFile();
    expect(screen.queryByLabelText("Đăng lên thư viện của tổ chức")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("File mẫu (.docx)"), { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "Dùng file này" }));
    expect(onStart).toHaveBeenCalledWith({ kind: "file", file });
    unmount();

    onStart.mockClear();
    renderWithIntl(<TargetPicker orgId="o1" canPublish busy={false} preselect={null} previous={null} onStart={onStart} />);
    openFile();
    fireEvent.change(screen.getByLabelText("File mẫu (.docx)"), { target: { files: [file] } });
    fireEvent.click(screen.getByLabelText("Đăng lên thư viện của tổ chức"));
    expect(screen.getByRole("button", { name: "Dùng file này" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Tên mẫu trong thư viện"), { target: { value: "Mẫu mới" } });
    fireEvent.click(screen.getByRole("button", { name: "Dùng file này" }));
    expect(onStart).toHaveBeenCalledWith({ kind: "file", file, publish_to_org: true, name: "Mẫu mới" });

    // Đăng thành bản mới của họ mẫu có sẵn: không cần tên, gửi template_id
    onStart.mockClear();
    fireEvent.change(await screen.findByLabelText("Đăng vào"), { target: { value: "t1" } });
    expect(screen.queryByLabelText("Tên mẫu trong thư viện")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Dùng file này" }));
    expect(onStart).toHaveBeenCalledWith({ kind: "file", file, publish_to_org: true, template_id: "t1" });
  });

  it("bản dự án đang theo thì nút chính khoá; chọn bản khác của cùng mẫu thì bấm được", async () => {
    renderWithIntl(<TargetPicker orgId="o1" canPublish={false} busy={false} preselect={null} previous={null} current={{ template_id: "t1", version: 3 }} onStart={vi.fn()} />);
    fireEvent.click(await radio());
    expect(screen.getByText("Đang theo")).toBeInTheDocument();
    expect(screen.getByText("Dự án đang theo bản này")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Đổi sang mẫu Mẫu ngân hàng bản 3" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Bản của mẫu Mẫu ngân hàng"), { target: { value: "2" } });
    expect(screen.getByRole("button", { name: "Đổi sang mẫu Mẫu ngân hàng bản 2" })).toBeEnabled();
  });
});
