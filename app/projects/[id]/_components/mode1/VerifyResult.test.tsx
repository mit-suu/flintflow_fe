import { screen, within } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getCr, patchLocation, runCrAction } from "@/lib/api/change-requests";
import { mockServer } from "@/mocks/server";
import { resetMockState } from "@/mocks/state";
import { MODE1_PROJECT_ID, resetMode1MockState } from "@/mocks/mode1/state";
import { crSteps, importToGapReview, newCr } from "@/mocks/mode1/flows";
import { MAX_REDO_PER_LOCATION, type CrLocation } from "@/types/change-request";
import VerifyResult from "./VerifyResult";

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

const AT = "2026-09-19T00:00:00.000Z";
const location = (over: Partial<CrLocation> = {}): CrLocation => ({
  location_id: "L001",
  path: "nfrs[id=NFR-P02]",
  section_id: "fixed:4.2.3",
  section_title: "Performance",
  current_text: "",
  found_by: ["mention"],
  entity_paths: [],
  owner_step: null,
  conclusion: "edit",
  reason: null,
  proposal: { old_text: "a", new_text: "b", comment_text: null, spine_ops: [], assumptions: [] },
  manual: false,
  redo_count: 0,
  verify: null,
  group_id: null,
  ...over,
});

const result = () => screen.getByLabelText("Kết quả kiểm L001");

describe("VerifyResult - kết quả kiểm một vị trí (C-5, UC-82)", () => {
  it("chưa kiểm ⇒ không render", () => {
    const { container } = renderWithIntl(<VerifyResult location={location()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("code đạt, không cờ ⇒ nhãn xanh, không có số lần làm lại", () => {
    renderWithIntl(<VerifyResult location={location({ verify: { code_ok: true, violations: [], ai_flags: [], at: AT } })} />);
    const badge = within(result()).getByText("Kiểm tra tự động: đạt");
    expect(badge.className).toContain("text-[#1F7A45]");
    expect(within(result()).queryByText(/AI đã làm lại/)).not.toBeInTheDocument();
  });

  it("vi phạm code ⇒ đỏ (trượt) + MỘT câu dễ hiểu, không in thông điệp / mã luật nội bộ (FLF-375)", () => {
    renderWithIntl(
      <VerifyResult
        location={location({
          verify: {
            code_ok: false,
            violations: [
              { rule: "OLD_TEXT_MISMATCH", message: "Text block đã đổi so với old_text" },
              { rule: "SPINE_INVARIANT", message: "Xoá actor còn được use case tham chiếu", path: "actors[id=A01]" },
            ],
            ai_flags: [],
            at: AT,
          },
        })}
      />
    );
    const badge = within(result()).getByText("Kiểm tra tự động: chưa đạt");
    expect(badge.className).toContain("text-[#B03030]");
    const line = within(result()).getByText("AI chưa sửa tự động được chỗ này - gõ hướng sửa trong khung chat, hoặc bỏ chỗ này.");
    expect(line.className).toContain("text-[#B03030]");
    expect(within(result()).queryByText(/Text block đã đổi so với old_text/)).not.toBeInTheDocument();
    expect(within(result()).queryByText(/Xoá actor còn được use case tham chiếu/)).not.toBeInTheDocument();
    expect(within(result()).queryByText(/OLD_TEXT_MISMATCH|SPINE_INVARIANT/)).not.toBeInTheDocument();
  });

  it("có vi phạm value_changed ⇒ báo chỗ này vừa được sửa ở nơi khác", () => {
    renderWithIntl(
      <VerifyResult
        location={location({
          verify: {
            code_ok: false,
            violations: [
              { rule: "OLD_TEXT_MISMATCH", message: "x" },
              { rule: "value_changed", message: "Giá trị hiện tại khác old_text" },
            ],
            ai_flags: [],
            at: AT,
          },
        })}
      />
    );
    expect(within(result()).getByText("Chỗ này vừa được sửa ở nơi khác - AI soạn lại trên nội dung hiện tại.")).toBeInTheDocument();
    expect(within(result()).queryByText(/AI chưa sửa tự động được/)).not.toBeInTheDocument();
    expect(within(result()).queryByText(/Giá trị hiện tại khác old_text/)).not.toBeInTheDocument();
  });

  it("AI soát nhất quán chỉ ra cờ vàng - code vẫn đạt, không chặn", () => {
    renderWithIntl(
      <VerifyResult
        location={location({ verify: { code_ok: true, violations: [], ai_flags: [{ rule: "AI-CONSISTENCY", message: "Tiêu đề cột bảng chưa đổi theo" }], at: AT } })}
      />
    );
    expect(within(result()).getByText("Kiểm tra tự động: đạt")).toBeInTheDocument();
    const yellow = within(result()).getByText(/Tiêu đề cột bảng chưa đổi theo/);
    expect(yellow.closest("p")!.className).toContain("text-[#8A6D1F]");
    expect(yellow).toHaveAttribute("title", "AI-CONSISTENCY");
  });

  it(`số lần AI làm lại hiện theo mức tối đa ${MAX_REDO_PER_LOCATION}`, () => {
    const { rerender } = renderWithIntl(<VerifyResult location={location({ redo_count: 1, verify: { code_ok: true, violations: [], ai_flags: [], at: AT } })} />);
    expect(within(result()).getByText(`AI đã làm lại 1/${MAX_REDO_PER_LOCATION} lần`)).toBeInTheDocument();
    rerender(<VerifyResult location={location({ redo_count: 2, verify: { code_ok: false, violations: [{ rule: "R", message: "vẫn trượt" }], ai_flags: [], at: AT } })} />);
    expect(within(result()).getByText(`AI đã làm lại 2/${MAX_REDO_PER_LOCATION} lần`)).toBeInTheDocument();
    expect(within(result()).getByText("Kiểm tra tự động: chưa đạt")).toBeInTheDocument();
  });

  it("trên mock: AI làm lại vẫn trượt ⇒ CR sang manual_fix, vị trí mang kết quả đỏ + câu nhắc gõ hướng sửa trong chat", async () => {
    await importToGapReview();
    // mock: tiêu đề chứa FAIL ⇒ new_text đề xuất chứa FAIL ⇒ kiểm trượt, AI làm lại tới mức tối đa
    const { change_request } = await newCr("Đăng xuất mọi thiết bị FAIL");
    const cr = change_request.cr_id;
    await crSteps(cr, ["clarify", "impact", "propose"]);
    // mỗi lần kiểm trượt AI làm lại (về proposing) tới MAX_REDO_PER_LOCATION, lần kế ⇒ manual_fix
    for (let i = 0; i <= MAX_REDO_PER_LOCATION; i++) {
      await runCrAction(P, cr, "verify");
      if ((await getCr(P, cr)).data!.change_request.status !== "proposing") break;
      await runCrAction(P, cr, "propose");
    }

    const detail = (await getCr(P, cr)).data!;
    expect(detail.change_request.status).toBe("manual_fix");
    const failed = detail.locations.find((l) => l.verify && !l.verify.code_ok)!;
    expect(failed.verify!.violations.length).toBeGreaterThan(0);
    renderWithIntl(<VerifyResult location={failed} />);
    const box = screen.getByLabelText(`Kết quả kiểm ${failed.location_id}`);
    expect(within(box).getByText("Kiểm tra tự động: chưa đạt")).toBeInTheDocument();
    expect(within(box).getByText(/AI chưa sửa tự động được chỗ này|Chỗ này vừa được sửa ở nơi khác/)).toBeInTheDocument();
    expect(within(box).queryByText(failed.verify!.violations[0].message)).not.toBeInTheDocument();
  });

  it("FLF-375: PATCH vị trí chỉ mang kết luận + lý do (không gửi new_value) - bỏ một chỗ được chấp nhận", async () => {
    await importToGapReview();
    const { change_request } = await newCr();
    const cr = change_request.cr_id;
    const proposed = await crSteps(cr, ["clarify", "impact", "propose"]);
    const target = proposed.locations.find((l) => l.conclusion === "edit") ?? proposed.locations[0];
    const res = await patchLocation(P, cr, target.location_id, { conclusion: "not_related", reason: "Người yêu cầu bỏ đề xuất này" });
    expect(res.error).toBeNull();
    const after = res.data!.locations.find((l) => l.location_id === target.location_id)!;
    expect(after.conclusion).toBe("not_related");
    expect(after.reason).toBe("Người yêu cầu bỏ đề xuất này");
  });
});
