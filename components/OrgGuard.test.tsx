import { screen, waitFor } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchMyOrganizations, switchOrganization } from "@/lib/api/orgs";
import { getActiveOrgId } from "@/lib/api/token-store";
import OrgGuard, { ONBOARDING_PATH } from "./OrgGuard";

const replace = vi.fn();
let pathname = "/home";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  usePathname: () => pathname,
}));
vi.mock("@/lib/api/orgs", () => ({ fetchMyOrganizations: vi.fn(), switchOrganization: vi.fn() }));
vi.mock("@/lib/api/token-store", () => ({ getActiveOrgId: vi.fn() }));

const org = (id: string) => ({ id, name: "Org " + id, role: "lead" as const, joinedAt: "2026-09-25T00:00:00Z" });

const reload = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  pathname = "/home";
  Object.defineProperty(window, "location", { value: { ...window.location, reload }, writable: true });
});

describe("OrgGuard (BPMN Flow 10.6 — chặn trước khi BE trả 409)", () => {
  it("token đã mang orgId thì vào thẳng, không gọi BE", async () => {
    vi.mocked(getActiveOrgId).mockReturnValue("org-1");

    renderWithIntl(
      <OrgGuard>
        <p>nội dung</p>
      </OrgGuard>
    );

    expect(screen.getByText("nội dung")).toBeInTheDocument();
    expect(fetchMyOrganizations).not.toHaveBeenCalled();
  });

  it("token cũ chưa có orgId nhưng đã thuộc org ⇒ tự mở org rồi tải lại trang", async () => {
    vi.mocked(getActiveOrgId).mockReturnValue(null);
    vi.mocked(fetchMyOrganizations).mockResolvedValue([org("org-9")]);
    vi.mocked(switchOrganization).mockResolvedValue({
      accessToken: "t",
      organization: org("org-9"),
    });

    renderWithIntl(
      <OrgGuard>
        <p>nội dung</p>
      </OrgGuard>
    );

    expect(screen.queryByText("nội dung")).not.toBeInTheDocument();
    await waitFor(() => expect(switchOrganization).toHaveBeenCalledWith("org-9"));
    // Tải lại hẳn: ProjectsProvider ở layout đã tải bằng token cũ và giữ lỗi 409 nếu chỉ render lại tại chỗ
    await waitFor(() => expect(reload).toHaveBeenCalledOnce());
    expect(screen.queryByText("nội dung")).not.toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("chưa thuộc org nào ⇒ đẩy sang onboarding", async () => {
    vi.mocked(getActiveOrgId).mockReturnValue(null);
    vi.mocked(fetchMyOrganizations).mockResolvedValue([]);

    renderWithIntl(
      <OrgGuard>
        <p>nội dung</p>
      </OrgGuard>
    );

    await waitFor(() => expect(replace).toHaveBeenCalledWith(ONBOARDING_PATH));
    expect(switchOrganization).not.toHaveBeenCalled();
  });

  it("gọi BE lỗi thì vẫn đẩy sang onboarding, không kẹt ở spinner", async () => {
    vi.mocked(getActiveOrgId).mockReturnValue(null);
    vi.mocked(fetchMyOrganizations).mockRejectedValue(new Error("mất mạng"));

    renderWithIntl(
      <OrgGuard>
        <p>nội dung</p>
      </OrgGuard>
    );

    await waitFor(() => expect(replace).toHaveBeenCalledWith(ONBOARDING_PATH));
  });

  it("ở chính trang onboarding thì không chặn (tránh vòng lặp)", async () => {
    pathname = ONBOARDING_PATH;
    vi.mocked(getActiveOrgId).mockReturnValue(null);

    renderWithIntl(
      <OrgGuard>
        <p>nội dung</p>
      </OrgGuard>
    );

    expect(screen.getByText("nội dung")).toBeInTheDocument();
    expect(fetchMyOrganizations).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });
});
