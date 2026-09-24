import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { renderWithIntl } from "@/test/intl";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockServer } from "@/mocks/server";
import { resetMockState } from "@/mocks/state";
import { MODE1_PROJECT_ID, resetMode1MockState } from "@/mocks/mode1/state";
import * as mode1State from "@/mocks/mode1/state";
import { importToGapReview } from "@/mocks/mode1/flows";
import { useCrChat } from "../../hooks/mode1/useCrChat";
import Mode1CrThread from "./Mode1CrThread";

/** Mode 1 v3 phase 8 — change request chạy trong khung chat: mở CR, làm rõ, phần liên quan, đề xuất, gửi Lead. */
const P = MODE1_PROJECT_ID;
const S = () => mode1State.mode1State;

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useParams: () => ({ id: MODE1_PROJECT_ID }),
}));

beforeAll(() => mockServer.listen({ onUnhandledRequest: "error" }));
beforeEach(async () => {
  resetMockState();
  resetMode1MockState();
  window.localStorage.clear();
  await importToGapReview();
});
afterEach(() => mockServer.resetHandlers());
afterAll(() => mockServer.close());

/** Khung chat tối giản: luồng CR + ô nhập gửi qua `chat.send` như workspace. */
function Harness() {
  const chat = useCrChat(P);
  const [text, setText] = useState("");
  return (
    <>
      <Mode1CrThread projectId={P} chat={chat} me="Lan" />
      <input aria-label="Ô chat" placeholder={chat.inputHint} value={text} onChange={(e) => setText(e.target.value)} />
      <button
        type="button"
        onClick={() => {
          void chat.send(text);
          setText("");
        }}
      >
        Gửi chat
      </button>
    </>
  );
}

const say = async (text: string) => {
  fireEvent.change(screen.getByLabelText("Ô chat"), { target: { value: text } });
  fireEvent.click(screen.getByRole("button", { name: "Gửi chat" }));
};
const click = async (name: string | RegExp) => fireEvent.click(await screen.findByRole("button", { name }));
const cr = () => S().crs.get("CR-001")!.change_request;

describe("Mode1CrThread — CR trong khung chat", () => {
  it("lệnh sửa ⇒ chọn người yêu cầu ⇒ AI hỏi (chip gợi ý) ⇒ phần liên quan ⇒ đồng ý đề xuất ⇒ tự kiểm ⇒ gửi Lead", async () => {
    renderWithIntl(<Harness />);
    expect(await screen.findByLabelText("Hướng dẫn sửa tài liệu")).toBeInTheDocument();

    await say("Đăng xuất mọi thiết bị — yêu cầu còn mơ hồ");
    expect(screen.getByText("Đăng xuất mọi thiết bị — yêu cầu còn mơ hồ")).toBeInTheDocument();
    await click("Lan · yêu cầu miệng");

    // 3.1 xong ⇒ CR mở, 3.2 tự chạy ⇒ AI hỏi kèm gợi ý
    const q = await screen.findByRole("region", { name: "Trả lời câu hỏi làm rõ" });
    expect(cr()).toMatchObject({ source: { kind: "verbal" }, requester: "Lan", description: "Đăng xuất mọi thiết bị — yêu cầu còn mơ hồ", status: "awaiting_answers" });
    expect(screen.getByPlaceholderText("Trả lời câu hỏi của AI…")).toBeInTheDocument();
    fireEvent.click(within(q).getByRole("radio", { name: "Có, áp cho mọi thiết bị" }));
    fireEvent.click(within(q).getByRole("radio", { name: "Không cần thông báo" }));
    fireEvent.click(within(q).getByRole("button", { name: "Gửi câu trả lời" }));

    // 3.4 tự chạy ⇒ dừng ở danh sách phần liên quan
    const related = await screen.findByLabelText("Phần liên quan");
    expect(within(related).getAllByRole("listitem").length).toBeGreaterThan(0);
    await click("Tiếp tục — AI đề xuất sửa");

    // 3.6 ⇒ đồng ý đề xuất sửa ⇒ 3.7 tự chạy ⇒ sẵn sàng
    const proposals = await screen.findByLabelText("Đề xuất sửa");
    fireEvent.click(within(proposals).getAllByRole("button", { name: "Đồng ý" })[0]);
    await click("Gửi cho Lead");

    expect(await screen.findByLabelText("Đã gửi cho Lead")).toHaveTextContent("Đã gửi CR-001 cho Lead duyệt");
    expect(cr().status).toBe("in_review");
    expect(screen.getByPlaceholderText(/Gõ yêu cầu sửa tài liệu/)).toBeInTheDocument();
  });

  it("gõ thêm khi CR đang mở ⇒ gộp vào cùng CR, chạy lại làm rõ + tìm vị trí", async () => {
    renderWithIntl(<Harness />);
    await say("Đổi ngưỡng phản hồi thành 1 giây");
    await click("Lan · yêu cầu miệng");
    await screen.findByLabelText("Phần liên quan");
    expect(screen.getByPlaceholderText("Gõ thêm lệnh sửa để gộp vào CR-001…")).toBeInTheDocument();

    await say("Áp dụng cho cả màn tra cứu");
    await waitFor(() => expect(cr().amendments.map((a) => a.text)).toEqual(["Áp dụng cho cả màn tra cứu"]));
    expect(await screen.findByText("Áp dụng cho cả màn tra cứu")).toBeInTheDocument();
    expect(cr().status).toBe("impact_review");
    expect(S().crs.size).toBe(1);
  });

  it("Sửa lại ⇒ gõ hướng ⇒ AI soạn lại đúng vị trí đó, phải đồng ý lại; Bỏ ⇒ không liên quan", async () => {
    renderWithIntl(<Harness />);
    await say("Đổi ngưỡng phản hồi thành 1 giây");
    await click("Lan · yêu cầu miệng");
    await click("Tiếp tục — AI đề xuất sửa");
    const proposals = await screen.findByLabelText("Đề xuất sửa");
    fireEvent.click(within(proposals).getAllByRole("button", { name: "Sửa lại" })[0]);
    expect(await screen.findByPlaceholderText("Gõ hướng sửa lại cho đề xuất đang chọn…")).toBeInTheDocument();
    await say("Giữ nguyên tên, chỉ đổi ngưỡng");
    await waitFor(() => expect(S().crs.get("CR-001")!.locations.some((l) => l.manual && l.reason?.includes("Giữ nguyên tên"))).toBe(true));
    // đề xuất đã đổi ⇒ vẫn còn nút Đồng ý (chưa ai đồng ý bản mới)
    expect(within(await screen.findByLabelText("Đề xuất sửa")).getAllByRole("button", { name: "Đồng ý" }).length).toBeGreaterThan(0);

    fireEvent.click(within(screen.getByLabelText("Đề xuất sửa")).getAllByRole("button", { name: "Bỏ" })[0]);
    await waitFor(() => expect(S().crs.get("CR-001")!.locations.every((l) => l.conclusion === "not_related")).toBe(true));
  });

  it("kiểm tra cần xử lý: chỉ rõ phần chưa đạt (lý do) + phần AI bỏ sót; sửa lại / bỏ ngay trong thẻ ⇒ đồng ý ⇒ tự kiểm lại", async () => {
    const first = renderWithIntl(<Harness />);
    await say("Đổi ngưỡng phản hồi thành 1 giây");
    await click("Lan · yêu cầu miệng");
    await click("Tiếp tục — AI đề xuất sửa");
    await screen.findByLabelText("Đề xuất sửa");
    first.unmount();

    // BE: AI làm lại 2 lần vẫn trượt ở L001, và bỏ sót L002 ⇒ manual_fix
    const d = S().crs.get("CR-001")!;
    const failing = d.locations[0];
    if (d.locations.length < 2) {
      const path = "business_rules[id=BR-99]";
      d.locations.push({ ...failing, location_id: "L099", path, manual: false, verify: null, group_id: null });
      S().locks.set(path, "CR-001");
    }
    const skipped = d.locations[1];
    failing.conclusion = "edit";
    failing.verify = { code_ok: false, violations: [{ rule: "edit_no_change", message: "Đề xuất không thay đổi gì ở phần tử này" }], ai_flags: [], at: new Date().toISOString() };
    skipped.conclusion = null;
    skipped.proposal = null;
    d.change_request.status = "manual_fix";

    renderWithIntl(<Harness />);
    const todo = await screen.findByLabelText("Cần sửa");
    expect(todo).toHaveTextContent("2 phần vẫn chưa đạt");
    expect(within(todo).getAllByRole("button").map((b) => b.textContent)).toContain("Kiểm lại ngay");

    const bad = screen.getByRole("article", { name: `Đề xuất ${failing.location_id}` });
    expect(within(bad).getByText("Chưa đạt")).toBeInTheDocument();
    expect(within(bad).getByLabelText("Lý do chưa đạt")).toHaveTextContent("Đề xuất không thay đổi gì ở phần tử này");
    const missing = screen.getByRole("article", { name: `Đề xuất ${skipped.location_id}` });
    expect(within(missing).getByText("Chưa có đề xuất")).toBeInTheDocument();

    // phần trượt: gõ hướng sửa ngay trong thẻ ⇒ AI soạn lại
    fireEvent.change(within(bad).getByRole("textbox"), { target: { value: "Đổi ngưỡng thành 1 giây" } });
    fireEvent.click(within(bad).getByRole("button", { name: "AI soạn lại" }));
    await waitFor(() => expect(S().crs.get("CR-001")!.locations[0].verify).toBeNull());
    // phần bỏ sót: bỏ qua
    fireEvent.click(within(screen.getByRole("article", { name: `Đề xuất ${skipped.location_id}` })).getByRole("button", { name: "Bỏ qua phần này (không cần đổi)" }));
    await waitFor(() => expect(S().crs.get("CR-001")!.locations[1].conclusion).toBe("not_related"));

    // đồng ý bản soạn lại ⇒ tự kiểm lại ⇒ sẵn sàng gửi
    fireEvent.click(within(screen.getByRole("article", { name: `Đề xuất ${failing.location_id}` })).getByRole("button", { name: "Đồng ý" }));
    expect(await screen.findByRole("button", { name: "Gửi cho Lead" })).toBeInTheDocument();
    expect(cr().status).toBe("ready_to_submit");
  });

  it("phần chưa đạt ở mục riêng: \"Tự sửa\" từng đoạn (không JSON) ⇒ lưu = đã đồng ý ⇒ tự kiểm lại", async () => {
    const first = renderWithIntl(<Harness />);
    await say("Ghi rõ lịch họp nhóm");
    await click("Lan · yêu cầu miệng");
    await click("Tiếp tục — AI đề xuất sửa");
    await screen.findByLabelText("Đề xuất sửa");
    first.unmount();

    const d = S().crs.get("CR-001")!;
    d.locations.splice(1);
    const loc = d.locations[0];
    const path = "custom_sections[id=CS02]";
    const value = JSON.stringify({ id: "CS02", heading: "Team Notes", level: 2, source: "import", blocks: [{ kind: "paragraph", text: "Họp hằng tuần", rows: null, image_ref: null }] });
    Object.assign(loc, {
      path,
      section_id: "custom:CS02",
      section_title: "Team Notes",
      owner_step: null,
      current_text: value,
      conclusion: "edit",
      proposal: { old_text: value, new_text: value, comment_text: null, spine_ops: [], assumptions: [] },
      verify: { code_ok: false, violations: [{ rule: "edit_no_change", message: "Đề xuất không thay đổi gì ở phần tử này" }], ai_flags: [], at: new Date().toISOString() },
    });
    S().locks.set(path, "CR-001");
    d.change_request.status = "manual_fix";

    renderWithIntl(<Harness />);
    const card = await screen.findByRole("article", { name: `Đề xuất ${loc.location_id}` });
    expect(within(card).getByRole("tab", { name: "✨ Nhờ AI soạn lại" })).toHaveAttribute("aria-selected", "true");
    fireEvent.click(within(card).getByRole("tab", { name: "✎ Tự sửa" }));
    fireEvent.change(within(card).getByLabelText("Đoạn 1"), { target: { value: "Họp mỗi thứ Hai lúc 9 giờ" } });
    fireEvent.click(within(card).getByRole("button", { name: "Lưu bản tự sửa" }));

    expect(await screen.findByRole("button", { name: "Gửi cho Lead" })).toBeInTheDocument();
    const saved = S().crs.get("CR-001")!.locations[0];
    expect(saved.manual).toBe(true);
    expect(saved.proposal?.new_text).toContain("Họp mỗi thứ Hai lúc 9 giờ");
    expect(cr().status).toBe("ready_to_submit");
  });
});
