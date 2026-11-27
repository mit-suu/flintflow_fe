import { screen, within } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { describe, expect, it } from "vitest";
import type { CrLocation } from "@/types/change-request";
import ProposalCard from "./ProposalCard";

/** Giá trị phần tử dạng JSON khoá sắp xếp như BE `valueText` (FLF-186). */
const json = (value: Record<string, unknown>) =>
  JSON.stringify(
    Object.fromEntries(Object.keys(value).sort().map((k) => [k, value[k]])),
    null,
    2
  );

const UC = { id: "UC-2.4", name: "Log out of system", description: "The user logs out of the current browser session." };
const OLD = json(UC);
const NEW = json({ ...UC, description: "The user is signed out of every device." });

/** Chữ của mọi từ bị bỏ / thêm trong thẻ (kiểu so sánh version chỉ tô từ đổi). */
const marked = (el: HTMLElement, tag: "del" | "ins") => [...el.querySelectorAll(tag)].map((x) => x.textContent).join("");

const location = (over: Partial<CrLocation> = {}): CrLocation => ({
  location_id: "L001",
  path: "use_cases[id=UC-2.4]",
  section_id: "fixed:2.2.2",
  section_title: "Use Case Descriptions",
  current_text: OLD,
  found_by: ["mention"],
  entity_paths: [],
  owner_step: null,
  conclusion: null,
  reason: null,
  proposal: null,
  manual: false,
  redo_count: 0,
  verify: null,
  group_id: null,
  ...over,
});

const proposal = (over: Partial<NonNullable<CrLocation["proposal"]>> = {}): NonNullable<CrLocation["proposal"]> => ({
  old_text: OLD,
  new_text: null,
  comment_text: null,
  spine_ops: [],
  assumptions: [],
  ...over,
});

const card = () => screen.getByRole("article", { name: "Vị trí L001" });

// FLF-279 phần B (§4.17): chip "Theo nghĩa" từng trống chữ vì `LocationFoundBy` ở FE thiếu `vector`.
describe("ProposalCard - vị trí tìm theo nghĩa", () => {
  const chip = () => screen.getByText(/^Theo nghĩa/);

  it("chip mang nhãn và độ khớp", () => {
    renderWithIntl(
      <ProposalCard location={location({ found_by: ["vector"], vector_score: 0.87 })} />
    );
    expect(chip()).toHaveTextContent("Theo nghĩa · 87%");
  });

  it("thiếu vector_score hoặc null ⇒ chỉ có nhãn, không NaN% và không dấu · lửng", () => {
    const { unmount } = renderWithIntl(
      <ProposalCard location={location({ found_by: ["vector"], vector_score: null })} />
    );
    expect(chip().textContent).toBe("Theo nghĩa");
    unmount();

    renderWithIntl(<ProposalCard location={location({ found_by: ["vector"] })} />);
    expect(chip().textContent).toBe("Theo nghĩa");
  });

  it("chỉ gần nghĩa ⇒ chip tô khác; có thêm liên kết field ⇒ chip như các nguồn khác", () => {
    const { unmount } = renderWithIntl(
      <ProposalCard location={location({ found_by: ["vector"], vector_score: 0.87 })} />
    );
    expect(chip().className).toContain("bg-info-soft");
    unmount();

    renderWithIntl(
      <ProposalCard location={location({ found_by: ["spine_link", "vector"], vector_score: 0.91 })} />
    );
    expect(chip().className).not.toContain("bg-info-soft");
    expect(chip()).toHaveTextContent("Theo nghĩa · 91%");
  });
});

describe("ProposalCard - đề xuất cho một phần tử Spine (C-4, UC-81, FLF-186)", () => {
  it("chưa kết luận: hiện mục, tên phần tử; không lộ cách máy tìm ra hay tên bước nội bộ; không có huy hiệu kết luận", () => {
    renderWithIntl(
      <ProposalCard
        location={location({ found_by: ["spine_link", "mention", "keyword"], owner_step: "S-3.2", entity_paths: ["actors[id=A01]"] })}
      />
    );
    const c = card();
    // FLF-375: tiêu đề = mục của tài liệu rồi “— tên chỗ” (CR cũ chưa có `display` ⇒ nhãn path, không lộ [id=…])
    expect(within(c).getByText("2.2.2 Use Case Descriptions")).toBeInTheDocument();
    expect(within(c).getByText("- Use case UC-2.4")).toBeInTheDocument();
    expect(c.textContent).not.toContain("[id=");
    expect(within(c).queryByText("Liên kết field")).not.toBeInTheDocument();
    expect(within(c).queryByText("Nhắc mã")).not.toBeInTheDocument();
    expect(within(c).queryByText("Từ khoá")).not.toBeInTheDocument();
    expect(c.textContent).not.toContain("Actor – mục tiêu");
    expect(within(c).queryByText(/^liên quan:/)).not.toBeInTheDocument();
    expect(within(c).queryByText("Sửa")).not.toBeInTheDocument();
    expect(within(c).queryByRole("button", { name: "Sửa tay" })).not.toBeInTheDocument();
  });

  it("kết luận sửa ⇒ thay đổi theo field, chỉ tô từ đổi như so sánh version; nhãn “Sửa”, lý do", () => {
    renderWithIntl(<ProposalCard location={location({ conclusion: "edit", reason: "UC-2.4 đổi phạm vi", proposal: proposal({ new_text: NEW }) })} />);
    const changes = within(card()).getByLabelText("Thay đổi theo field");
    expect(within(changes).getByText("Mô tả")).toHaveAttribute("title", "description");
    expect(marked(changes, "del")).toContain("logs");
    expect(marked(changes, "del")).toContain("browser");
    expect(marked(changes, "ins")).toContain("signed");
    expect(marked(changes, "del")).not.toContain("The user");
    expect(within(changes).queryByText("Tên")).not.toBeInTheDocument();
    expect(within(card()).getByText("Sửa")).toBeInTheDocument();
    expect(within(card()).getByText("Lý do: UC-2.4 đổi phạm vi")).toBeInTheDocument();
  });

  it("kết luận chỉ comment ⇒ nội dung comment, không có thay đổi", () => {
    renderWithIntl(<ProposalCard location={location({ conclusion: "comment", proposal: proposal({ comment_text: "Cần xác nhận với PM" }) })} />);
    expect(within(card()).getByText("Chỉ comment")).toBeInTheDocument();
    expect(within(card()).getByText("💬 Cần xác nhận với PM")).toBeInTheDocument();
    expect(within(card()).queryByLabelText("Thay đổi theo field")).not.toBeInTheDocument();
  });

  it("AI kết luận không liên quan ⇒ nhãn + lý do; không còn huy hiệu “sửa tay”", () => {
    renderWithIntl(
      <ProposalCard location={location({ conclusion: "not_related", reason: "Chỉ nhắc tên, không đổi nghĩa", manual: false, proposal: proposal() })} />
    );
    expect(within(card()).getByText("Không liên quan")).toBeInTheDocument();
    expect(within(card()).getByText("Lý do: Chỉ nhắc tên, không đổi nghĩa")).toBeInTheDocument();
    expect(within(card()).queryByText("sửa tay")).not.toBeInTheDocument();
  });

  it("người dùng tự bỏ đề xuất trong khung chat ⇒ “Đã bỏ”, không phải “Không liên quan”", () => {
    renderWithIntl(
      <ProposalCard location={location({ conclusion: "not_related", reason: "Người yêu cầu bỏ đề xuất này trong khung chat", manual: true, proposal: proposal() })} />
    );
    expect(within(card()).getByText("Đã bỏ")).toBeInTheDocument();
    expect(within(card()).queryByText("Không liên quan")).not.toBeInTheDocument();
  });

  it("kiểm trượt ⇒ viền đỏ + kết quả kiểm trong thẻ", () => {
    renderWithIntl(
      <ProposalCard
        location={location({
          conclusion: "edit",
          proposal: proposal({ new_text: NEW }),
          verify: { code_ok: false, violations: [{ rule: "path_not_locked", message: "mất khoá" }], ai_flags: [], at: "2026-09-19T00:00:00.000Z" },
        })}
      />
    );
    expect(card().className).toContain("border-error");
    expect(within(card()).getByText("Kiểm tra tự động: chưa đạt")).toBeInTheDocument();
  });
});

describe("ProposalCard - chỉ đọc (FLF-375: thao tác làm trong khung chat)", () => {
  it("không có nút sửa tay / sửa trực tiếp / nhờ AI sửa, không form giá trị mới", () => {
    renderWithIntl(<ProposalCard location={location({ conclusion: "edit", owner_step: "S-6.4", manual: true, proposal: proposal({ new_text: NEW }) })} />);
    const c = card();
    expect(within(c).queryByRole("button")).not.toBeInTheDocument();
    expect(within(c).queryByLabelText("Giá trị mới (JSON)")).not.toBeInTheDocument();
    expect(within(c).queryByText("sửa tay")).not.toBeInTheDocument();
  });

  it("có `display` ⇒ tiêu đề “mục - loại: tên”, thay đổi chỉ tô từ đổi (không diff JSON, không gạch cả câu)", () => {
    renderWithIntl(
      <ProposalCard
        location={location({
          conclusion: "edit",
          proposal: proposal({ new_text: NEW }),
          display: { kind: "paragraph", label: "Đăng xuất", change: "edit", before: "Đăng xuất khỏi trình duyệt hiện tại.", after: "Đăng xuất khỏi mọi thiết bị." },
        })}
      />
    );
    const c = card();
    expect(within(c).getByText("2.2.2 Use Case Descriptions")).toBeInTheDocument();
    expect(within(c).getByText(/^- .+: Đăng xuất$/)).toBeInTheDocument();
    expect(marked(c, "del")).toContain("duyệt");
    expect(marked(c, "ins")).toContain("thiết");
    expect(marked(c, "del")).not.toContain("Đăng xuất");
    expect(within(c).queryByLabelText("Thay đổi theo field")).not.toBeInTheDocument();
  });

  it("CR khác đang có bản sửa chưa xác nhận ở cùng chỗ ⇒ dòng báo (không chặn)", () => {
    renderWithIntl(<ProposalCard location={location({ others_pending: [{ cr_id: "CR-009", requester: "PM Lan" }] })} />);
    expect(within(card()).getByText(/CR-009/)).toBeInTheDocument();
  });
});

describe("ProposalCard - vị trí sơ đồ gốc (§4.13)", () => {
  const image = { kind: "image", text: "Figure 2 - Use case", rows: null, image_ref: "word/media/image2.png", diagram: { kind: "usecase", source_hash: "h" } };
  const para = { kind: "paragraph", text: "Vẽ bằng draw.io.", rows: null, image_ref: null };
  const before = json({ id: "CS03", heading: "", level: 3, source: "import", blocks: [para, image] });
  const after = json({ id: "CS03", heading: "", level: 3, source: "import", blocks: [para] });
  const diagramLoc = (over: Partial<CrLocation> = {}) =>
    location({ path: "custom_sections[id=CS03]", section_id: "custom:CS03", section_title: "", current_text: before, found_by: ["diagram"], entity_paths: ["fixed:2.2.1"], ...over });

  it("edit ⇒ nói bằng lời: thay hình gốc nào bằng sơ đồ vẽ lại, không hiện diff JSON khối ảnh", () => {
    renderWithIntl(
      <ProposalCard
        location={diagramLoc({ conclusion: "edit", reason: "r", proposal: proposal({ old_text: before, new_text: after, spine_ops: [{ op: "remove", path: "custom_sections[id=CS03].blocks[image_ref=word/media/image2.png]" }] }) })}
      />
    );
    const card = screen.getByRole("article", { name: "Vị trí L001" });
    expect(within(card).getByText("Hình gốc - Sơ đồ use case")).toBeInTheDocument();
    // Tiêu đề đã nói "Hình gốc" — không thêm chip cách tìm lặp lại
    expect(within(card).queryByText("Hình gốc")).not.toBeInTheDocument();
    const change = within(card).getByLabelText("Thay hình gốc");
    expect(change).toHaveTextContent("Sơ đồ use case");
    expect(change).toHaveTextContent("Figure 2 - Use case");
    expect(within(card).queryByLabelText("Thay đổi theo field")).toBeNull();
  });

  it("not_related ⇒ không có khối thay hình", () => {
    renderWithIntl(<ProposalCard location={diagramLoc({ conclusion: "not_related", reason: "giữ", proposal: proposal({ old_text: before }) })} />);
    expect(screen.queryByLabelText("Thay hình gốc")).toBeNull();
  });
});

describe("ProposalCard - không vẽ ô trống khi đề xuất không có chữ", () => {
  const withDisplay = (display: NonNullable<CrLocation["display"]>) =>
    location({ conclusion: "edit", proposal: proposal({ new_text: NEW }), display });

  it("xoá phần tử không có tên / chữ ⇒ vẫn nói rõ xoá nội dung ở phần này", () => {
    renderWithIntl(<ProposalCard location={withDisplay({ kind: "messages", label: "", change: "remove", before: "", after: null })} />);
    expect(within(card()).getByText("nội dung ở phần này")).toHaveClass("line-through");
  });

  it("trước và sau như nhau (đều trống) ⇒ báo không đổi gì, không có ô Trước / Sau", () => {
    renderWithIntl(<ProposalCard location={withDisplay({ kind: "project", label: "Phạm vi phát hành", change: "edit", before: "", after: "" })} />);
    expect(within(card()).getByText("Đề xuất này không làm đổi nội dung nào ở phần này.")).toBeInTheDocument();
    expect(within(card()).queryByText("Trước")).not.toBeInTheDocument();
  });

  it("trước trống ⇒ hiện như thêm mới (ô xanh), không có ô trước rỗng", () => {
    renderWithIntl(<ProposalCard location={withDisplay({ kind: "project", label: "Phạm vi phát hành", change: "edit", before: "", after: "Trong phạm vi: Đăng tin" })} />);
    expect(within(card()).getByText("Trong phạm vi: Đăng tin")).toHaveClass("text-success");
    expect(card().querySelector(".line-through")).toBeNull();
  });

  it("viết lại gần hết ⇒ ô cũ gạch đỏ rồi ô mới, không tô lốm đốm từng từ", () => {
    renderWithIntl(<ProposalCard location={withDisplay({ kind: "nfrs", label: "Hiệu năng", change: "edit", before: "Response under 2 s", after: "Search must scale to 1,000 users" })} />);
    expect(within(card()).getByText("Response under 2 s")).toHaveClass("line-through");
    expect(within(card()).getByText("Search must scale to 1,000 users")).toHaveClass("text-success");
    expect(card().querySelector("del, ins")).toBeNull();
  });
});
