"use client";

import { fireEvent, screen } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TraceabilityMap from "./TraceabilityMap";
import * as spineApi from "@/lib/api/spine";
import type { TraceabilityResponse } from "@/types/flags";

vi.mock("@/lib/api/spine", () => ({
  getTraceability: vi.fn(),
}));

describe("TraceabilityMap", () => {
  const getTraceability = vi.mocked(spineApi.getTraceability);

  beforeEach(() => {
    getTraceability.mockReset();
  });

  it("tra actor A01 hiện bảng node (actor + use case) và edges", async () => {
    const response: TraceabilityResponse = {
      nodes: [
        { kind: "actor", id: "A01", label: "Founder" },
        { kind: "use_case", id: "UC01", label: "Create Project" },
      ],
      edges: [{ from: "A01", to: "UC01", field: "actor_ids" }],
    };
    getTraceability.mockResolvedValueOnce({ data: response, error: null });

    renderWithIntl(<TraceabilityMap projectId="p1" />);

    fireEvent.change(screen.getByPlaceholderText(/vd A01/), { target: { value: "A01" } });
    fireEvent.click(screen.getByRole("button", { name: "Tra" }));

    expect(await screen.findByText("Founder")).toBeInTheDocument();
    expect(screen.getByText("Create Project")).toBeInTheDocument();
    expect(getTraceability).toHaveBeenCalledWith("p1", { entity: "actor", id: "A01" });
    expect(screen.getByText(/actor_ids/)).toBeInTheDocument();
  });

  it("đổi loại entity trước khi tra gửi đúng `entity` trong query", async () => {
    getTraceability.mockResolvedValueOnce({ data: { nodes: [], edges: [] }, error: null });

    renderWithIntl(<TraceabilityMap projectId="p1" />);

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "use_case" } });
    fireEvent.change(screen.getByPlaceholderText(/vd A01/), { target: { value: "UC01" } });
    fireEvent.click(screen.getByRole("button", { name: "Tra" }));

    expect(await screen.findByText("Không có liên kết nào.")).toBeInTheDocument();
    expect(getTraceability).toHaveBeenCalledWith("p1", { entity: "use_case", id: "UC01" });
  });

  it("lỗi API hiện thông điệp, không render bảng", async () => {
    getTraceability.mockRejectedValueOnce(new Error("Không tra được"));

    renderWithIntl(<TraceabilityMap projectId="p1" />);

    fireEvent.change(screen.getByPlaceholderText(/vd A01/), { target: { value: "A99" } });
    fireEvent.click(screen.getByRole("button", { name: "Tra" }));

    expect(await screen.findByText("Không tra được")).toBeInTheDocument();
  });

  it("nút Tra bị khoá khi ô id trống", () => {
    renderWithIntl(<TraceabilityMap projectId="p1" />);
    expect(screen.getByRole("button", { name: "Tra" })).toBeDisabled();
    expect(getTraceability).not.toHaveBeenCalled();
  });
});
