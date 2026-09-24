import { fireEvent, screen } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Mode1Popup from "./Mode1Popup";

const P = "650000000000000000000001";
const router = { push: vi.fn(), replace: vi.fn() };
let query = "";

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => `/projects/650000000000000000000001`,
  useSearchParams: () => new URLSearchParams(query),
}));
// Nội dung popup đã có test riêng — ở đây chỉ kiểm popup chọn đúng màn và truyền đúng tham số
vi.mock("./GapReportView", () => ({ default: () => <p>nội dung gap report</p> }));
vi.mock("./CrWorkspace", () => ({ default: ({ crId }: { crId: string }) => <p>chi tiết {crId}</p> }));
vi.mock("./ChangeRequestList", () => ({
  default: ({ prefill }: { prefill: { title?: string } | null }) => <p>danh sách CR{prefill ? ` · điền sẵn: ${prefill.title}` : ""}</p>,
}));

const open = (q: string) => {
  query = q;
  return renderWithIntl(<Mode1Popup projectId={P} />);
};

describe("Mode1Popup — gap report / change request dạng popup trên màn Tài liệu & version", () => {
  beforeEach(() => router.replace.mockClear());

  it("không có panel ⇒ không hiện gì", () => {
    open("");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("panel=gap ⇒ popup Gap report; đóng ⇒ bỏ query, ở lại màn tài liệu", () => {
    open("panel=gap");
    expect(screen.getByRole("dialog", { name: "Gap report" })).toBeInTheDocument();
    expect(screen.getByText("nội dung gap report")).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(router.replace).toHaveBeenCalledWith(`/projects/${P}`, { scroll: false });
  });

  it("panel=cr ⇒ danh sách CR; kèm new=1&… ⇒ form điền sẵn", () => {
    open("panel=cr&new=1&title=B%E1%BB%95%20sung%20m%E1%BB%A5c&source=gap_report");
    expect(screen.getByRole("dialog", { name: "Change request" })).toBeInTheDocument();
    expect(screen.getByText("danh sách CR · điền sẵn: Bổ sung mục")).toBeInTheDocument();
  });

  it("panel=cr&cr=… ⇒ chi tiết CR ngay trong popup, có đường quay lại danh sách", () => {
    open("panel=cr&cr=CR-003");
    expect(screen.getByRole("dialog", { name: "Change request CR-003" })).toBeInTheDocument();
    expect(screen.getByText("chi tiết CR-003")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "← Danh sách change request" })).toHaveAttribute("href", `/projects/${P}?panel=cr`);
  });
});
