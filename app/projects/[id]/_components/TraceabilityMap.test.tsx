"use client";

import { fireEvent, screen, within } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TraceabilityMap from "./TraceabilityMap";
import * as spineApi from "@/lib/api/spine";
import type { TraceabilityResponse } from "@/types/flags";

vi.mock("@/lib/api/spine", () => ({
  getTraceability: vi.fn(),
}));

/** Nhóm hiện trên UI theo tiêu đề của nó. */
const group = (title: string) => screen.getByRole("heading", { name: title }).parentElement!.parentElement!;

const tra = (id: string) => {
  fireEvent.change(screen.getByLabelText("Mã thực thể"), { target: { value: id } });
  fireEvent.click(screen.getByRole("button", { name: "Tra" }));
};

describe("TraceabilityMap — bản đồ truy vết có chiều", () => {
  const getTraceability = vi.mocked(spineApi.getTraceability);

  beforeEach(() => {
    getTraceability.mockReset();
  });

  it("tra actor: gốc tách riêng, use case nằm ở 'Dẫn tới', 'Từ đâu ra' nói actor là gốc", async () => {
    // Hướng cạnh đúng như BE trả về: use case là bên giữ khoá `actor_ids`, nên mũi tên chỉ VÀO actor
    const response: TraceabilityResponse = {
      nodes: [
        { kind: "actor", id: "A01", label: "Founder" },
        { kind: "use_case", id: "UC01", label: "Create Project" },
      ],
      edges: [{ from: "UC01", to: "A01", field: "actor_ids" }],
    };
    getTraceability.mockResolvedValueOnce({ data: response, error: null });

    renderWithIntl(<TraceabilityMap projectId="p1" />);
    tra("A01");

    expect(await screen.findByText("Founder")).toBeInTheDocument();
    expect(getTraceability).toHaveBeenCalledWith("p1", { entity: "actor", id: "A01" });

    expect(within(group("Dẫn tới")).getByText("Create Project")).toBeInTheDocument();
    expect(within(group("Dẫn tới")).getByText("nối bằng Tác nhân")).toBeInTheDocument();
    expect(within(group("Từ đâu ra")).getByText(/đây là gốc/)).toBeInTheDocument();
    expect(within(group("Liên quan ngang")).getByText(/Không có quan hệ ngang/)).toBeInTheDocument();
    // Tên trường đời thường, không hiện mã `actor_ids` (FLF-247)
    expect(screen.queryByText(/actor_ids/)).not.toBeInTheDocument();
  });

  it("tra use case: nguồn, dẫn tới và quan hệ ngang nằm đúng ba khối; include không bị gọi là dẫn tới", async () => {
    const response: TraceabilityResponse = {
      nodes: [
        { kind: "use_case", id: "UC-03", label: "Book appointment" },
        { kind: "actor", id: "A01", label: "Receptionist" },
        { kind: "function", id: "FN012", label: "Validate time slot" },
        { kind: "use_case", id: "UC-05", label: "Check availability" },
      ],
      edges: [
        { from: "UC-03", to: "A01", field: "actor_ids" },
        { from: "UC-03", to: "FN012", field: "function_ids" },
        { from: "UC-03", to: "UC-05", field: "includes" },
      ],
    };
    getTraceability.mockResolvedValueOnce({ data: response, error: null });

    renderWithIntl(<TraceabilityMap projectId="p1" />);
    fireEvent.click(screen.getByRole("combobox", { name: "Loại" }));
    fireEvent.mouseDown(screen.getByRole("option", { name: "Use case" }));
    tra("UC-03");

    expect(await screen.findByText("Book appointment")).toBeInTheDocument();
    expect(getTraceability).toHaveBeenCalledWith("p1", { entity: "use_case", id: "UC-03" });

    expect(within(group("Từ đâu ra")).getByText("Receptionist")).toBeInTheDocument();
    expect(within(group("Dẫn tới")).getByText("Validate time slot")).toBeInTheDocument();
    expect(within(group("Liên quan ngang")).getByText("Check availability")).toBeInTheDocument();
    expect(within(group("Liên quan ngang")).getByText("nối bằng Include")).toBeInTheDocument();
  });

  it("có 'dẫn tới' ⇒ hiện khối kéo theo kèm câu nói rõ giới hạn quan hệ khoá", async () => {
    getTraceability.mockResolvedValueOnce({
      data: {
        nodes: [
          { kind: "actor", id: "A01", label: "Founder" },
          { kind: "screen", id: "S-02", label: "Project list" },
        ],
        edges: [{ from: "A01", to: "S-02", field: "permissions" }],
      },
      error: null,
    });

    renderWithIntl(<TraceabilityMap projectId="p1" />);
    tra("A01");

    await screen.findByRole("heading", { name: "Sửa cái này thì kéo theo" });
    const impact = group("Sửa cái này thì kéo theo");
    expect(within(impact).getByText(/Màn hình S-02/)).toBeInTheDocument();
    expect(within(impact).getByText(/Theo quan hệ khoá/)).toBeInTheDocument();
  });

  it("gốc không có trong đồ thị ⇒ nói không tìm thấy, không hiện khối nào", async () => {
    getTraceability.mockResolvedValueOnce({ data: { nodes: [], edges: [] }, error: null });

    renderWithIntl(<TraceabilityMap projectId="p1" />);
    tra("A99");

    expect(await screen.findByText("Không tìm thấy thực thể này trong tài liệu.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Dẫn tới" })).not.toBeInTheDocument();
  });

  it("lỗi API hiện thông điệp, không render kết quả", async () => {
    getTraceability.mockRejectedValueOnce(new Error("Không tra được"));

    renderWithIntl(<TraceabilityMap projectId="p1" />);
    tra("A99");

    expect(await screen.findByRole("alert")).toHaveTextContent("Không tra được");
    expect(screen.queryByRole("heading", { name: "Dẫn tới" })).not.toBeInTheDocument();
  });

  it("nút Tra bị khoá khi ô mã trống", () => {
    renderWithIntl(<TraceabilityMap projectId="p1" />);
    expect(screen.getByRole("button", { name: "Tra" })).toBeDisabled();
    expect(getTraceability).not.toHaveBeenCalled();
  });
});

const SPINE = {
  actors: [
    { id: "A01", name: "Receptionist" },
    { id: "A02", name: "Doctor" },
  ],
  use_cases: [{ id: "UC-03", name: "Book appointment" }],
  functions: [],
  screens: [],
  entities: [],
  nfrs: [],
  features: [],
  business_rules: [],
} as never;

describe("TraceabilityMap — chọn thực thể từ Spine đang mở", () => {
  const getTraceability = vi.mocked(spineApi.getTraceability);

  beforeEach(() => {
    getTraceability.mockReset();
    getTraceability.mockResolvedValue({ data: { nodes: [], edges: [] }, error: null });
  });

  it("có spine ⇒ chọn bằng danh sách tên, không còn ô gõ mã", () => {
    renderWithIntl(<TraceabilityMap projectId="p1" spine={SPINE} />);
    expect(screen.queryByLabelText("Mã thực thể")).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Mục" })).toHaveTextContent("A01 — Receptionist");
  });

  it("chọn phần tử khác ⇒ tra đúng mã đó", async () => {
    renderWithIntl(<TraceabilityMap projectId="p1" spine={SPINE} />);
    fireEvent.click(screen.getByRole("combobox", { name: "Mục" }));
    fireEvent.mouseDown(screen.getByRole("option", { name: "A02 — Doctor" }));
    fireEvent.click(screen.getByRole("button", { name: "Tra" }));

    await screen.findByText("Không tìm thấy thực thể này trong tài liệu.");
    expect(getTraceability).toHaveBeenCalledWith("p1", { entity: "actor", id: "A02" });
  });

  it("đổi loại ⇒ nhảy về phần tử đầu của loại mới, không giữ mã của loại cũ", async () => {
    renderWithIntl(<TraceabilityMap projectId="p1" spine={SPINE} />);
    fireEvent.click(screen.getByRole("combobox", { name: "Loại" }));
    fireEvent.mouseDown(screen.getByRole("option", { name: "Use case" }));
    expect(screen.getByRole("combobox", { name: "Mục" })).toHaveTextContent("UC-03 — Book appointment");

    fireEvent.click(screen.getByRole("button", { name: "Tra" }));
    await screen.findByText("Không tìm thấy thực thể này trong tài liệu.");
    expect(getTraceability).toHaveBeenCalledWith("p1", { entity: "use_case", id: "UC-03" });
  });

  it("loại chưa có phần tử nào ⇒ nói rõ và khoá nút Tra", () => {
    renderWithIntl(<TraceabilityMap projectId="p1" spine={SPINE} />);
    fireEvent.click(screen.getByRole("combobox", { name: "Loại" }));
    fireEvent.mouseDown(screen.getByRole("option", { name: "Màn hình" }));

    expect(screen.getByText("Tài liệu chưa có màn hình nào.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tra" })).toBeDisabled();
    expect(getTraceability).not.toHaveBeenCalled();
  });
});
