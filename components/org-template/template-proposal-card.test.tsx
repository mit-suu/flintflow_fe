import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl, vietnameseLeftovers } from "@/test/intl";
import { ApiClientError } from "@/lib/api/client";
import * as api from "@/lib/api/org-library";
import type { TemplateProposal } from "@/types/org-library";
import TemplateProposalCard from "./template-proposal-card";
import SaveStructureEntry from "./save-structure-entry";

vi.mock("@/lib/api/org-library", () => ({
  getTemplateProposal: vi.fn(),
  actOnTemplateProposal: vi.fn(),
  createTemplateProposal: vi.fn(),
  chatOnTemplateProposal: vi.fn(),
}));

const proposal: TemplateProposal = {
  id: "x1",
  project_id: "p1",
  project_name: "Lumen",
  status: "proposed",
  headings: ["1 Introduction", "9 {Customer name} Integration"],
  replaced_names: [
    { key: "B0001", original: "9 Lumen Integration", generic: "9 {Customer name} Integration", reason: null },
    { key: "B0002", original: "9 Team Notes", generic: null, reason: "Internal notes" },
  ],
  created_by: { id: "u1", name: "Bình" },
  created_at: "2026-11-17T00:00:00.000Z",
  template_id: null,
  version: null,
};

beforeEach(() => {
  vi.mocked(api.getTemplateProposal).mockReset().mockResolvedValue(proposal);
  vi.mocked(api.actOnTemplateProposal).mockReset();
  vi.mocked(api.createTemplateProposal).mockReset();
});

describe("TemplateProposalCard (UC-85)", () => {
  it("hiện mọi tên đã thay và mục bị bỏ; Analyst gửi Lead ⇒ còn dòng chờ duyệt", async () => {
    vi.mocked(api.actOnTemplateProposal).mockResolvedValue({ ...proposal, status: "sent" });
    renderWithIntl(<TemplateProposalCard projectId="p1" orgRole="analyst" />);
    expect(await screen.findByRole("heading", { name: "Lưu cấu trúc này thành mẫu của tổ chức?" })).toBeInTheDocument();
    expect(screen.getByText("9 Lumen Integration")).toBeInTheDocument();
    expect(screen.getByText("9 {Customer name} Integration")).toBeInTheDocument();
    expect(screen.getByText("Bỏ khỏi mẫu: Internal notes")).toBeInTheDocument();
    // Analyst không lưu thẳng vào thư viện
    expect(screen.queryByRole("button", { name: "Lưu vào thư viện" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Gửi Lead duyệt" }));
    expect(await screen.findByText("Đã gửi cấu trúc này cho Lead duyệt.")).toBeInTheDocument();
    expect(api.actOnTemplateProposal).toHaveBeenCalledWith("p1", "send");
  });

  it("Lead lưu vào thư viện ⇒ báo đã lưu và gọi onSaved", async () => {
    const onSaved = vi.fn();
    vi.mocked(api.actOnTemplateProposal).mockResolvedValue({ ...proposal, status: "approved", version: 1 });
    renderWithIntl(<TemplateProposalCard projectId="p1" orgRole="lead" onSaved={onSaved} />);
    expect(screen.queryByRole("button", { name: "Gửi Lead duyệt" })).not.toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: "Lưu vào thư viện" }));
    expect(await screen.findByText("Đã lưu vào thư viện mẫu. Dự án này giờ theo mẫu đó.")).toBeInTheDocument();
    expect(onSaved).toHaveBeenCalled();
  });

  it("Không lưu lỗi ⇒ báo lỗi, thẻ vẫn còn", async () => {
    vi.mocked(api.actOnTemplateProposal).mockRejectedValue(new ApiClientError(409, "TEMPLATE_PROPOSAL_CONFLICT", "Đề xuất vừa được xử lý ở nơi khác - tải lại để xem."));
    renderWithIntl(<TemplateProposalCard projectId="p1" orgRole="analyst" />);
    fireEvent.click(await screen.findByRole("button", { name: "Không lưu" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Đề xuất mẫu vừa thay đổi ở phiên khác. Vui lòng tải lại trang.");
    expect(screen.getByRole("heading", { name: "Lưu cấu trúc này thành mẫu của tổ chức?" })).toBeInTheDocument();
  });

  it("không có đề xuất ⇒ không hiện gì", async () => {
    vi.mocked(api.getTemplateProposal).mockResolvedValue(null);
    const { container } = renderWithIntl(<TemplateProposalCard projectId="p1" orgRole="lead" />);
    await waitFor(() => expect(api.getTemplateProposal).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("tiếng Anh: không sót chuỗi tiếng Việt", async () => {
    const { container } = renderWithIntl(<TemplateProposalCard projectId="p1" orgRole="lead" />, "en");
    expect(await screen.findByRole("heading", { name: "Save this structure as an organization template?" })).toBeInTheDocument();
    expect(vietnameseLeftovers(container)).toEqual([]);
  });
});

describe("SaveStructureEntry (UC-85, Lead)", () => {
  it("tạo đề xuất ⇒ báo cho workspace đọc lại thẻ", async () => {
    const onCreated = vi.fn();
    vi.mocked(api.createTemplateProposal).mockResolvedValue(proposal);
    renderWithIntl(<SaveStructureEntry projectId="p1" onCreated={onCreated} />);
    fireEvent.click(screen.getByRole("button", { name: "Lưu cấu trúc thành mẫu" }));
    await waitFor(() => expect(onCreated).toHaveBeenCalled());
  });

  it("không lưu được ⇒ hiện lý do BE trả", async () => {
    vi.mocked(api.createTemplateProposal).mockRejectedValue(new ApiClientError(409, "TEMPLATE_PROPOSAL_UNAVAILABLE", "Cấu trúc này đã có trong thư viện mẫu của tổ chức."));
    renderWithIntl(<SaveStructureEntry projectId="p1" onCreated={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Lưu cấu trúc thành mẫu" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Đề xuất mẫu này không còn khả dụng.");
  });
});

describe("TemplateProposalCard FLF-466 P10 (chat sửa & nhãn guidance/column)", () => {
  it("hiện nhãn Chữ hướng dẫn / Tiêu đề cột và gửi chat sửa đề xuất cập nhật thẻ", async () => {
    const rich: TemplateProposal = {
      ...proposal,
      replaced_names: [
        { key: "G0001", original: "[Điền tên dự án Lumen]", generic: "[Điền tên dự án {Project name}]", reason: null, kind: "guidance" },
        { key: "C0001", original: "Lumen Module", generic: "{Module}", reason: null, kind: "column" },
      ],
    };
    const revised: TemplateProposal = {
      ...rich,
      replaced_names: [{ key: "G0001", original: "[Điền tên dự án Lumen]", generic: "[Tên đối tác]", reason: null, kind: "guidance" }],
    };
    vi.mocked(api.getTemplateProposal).mockResolvedValue(rich);
    vi.mocked(api.chatOnTemplateProposal).mockResolvedValue(revised);

    renderWithIntl(<TemplateProposalCard projectId="p1" orgRole="lead" />);
    expect(await screen.findByText("Chữ hướng dẫn")).toBeInTheDocument();
    expect(screen.getByText("Tiêu đề cột")).toBeInTheDocument();

    const input = screen.getByLabelText("Muốn sửa gì ở đề xuất này?");
    fireEvent.change(input, { target: { value: "Đổi thành Tên đối tác" } });
    fireEvent.click(screen.getByRole("button", { name: "Gửi yêu cầu sửa" }));
    await waitFor(() => expect(api.chatOnTemplateProposal).toHaveBeenCalledWith("p1", "Đổi thành Tên đối tác"));
    expect(await screen.findByText("[Tên đối tác]")).toBeInTheDocument();
  });
});
