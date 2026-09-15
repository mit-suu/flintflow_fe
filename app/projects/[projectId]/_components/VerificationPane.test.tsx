"use client";

import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import VerificationPane from "./VerificationPane";
import * as flagsApi from "@/lib/api/flags";
import type { Flag } from "@/types/flags";
import type { Readiness } from "@/types/pipeline";

vi.mock("@/lib/api/flags", () => ({
  listFlags: vi.fn(),
  waiveFlag: vi.fn(),
  recomputeFlags: vi.fn(),
}));

const readiness: Readiness = { accepted_pct: 72, awaiting_reaccept: 4, red_open: 2, stale: 0 };

const redFlag: Flag = {
  id: "FL01",
  level: "red",
  rule_id: "array_empty",
  section_id: "fixed:2.1",
  target_id: null,
  message: "Actors đang rỗng",
  remediation_step: "S-3.1",
  opened_at_version: 3,
  resolved_at: null,
  waived_by_user: false,
  waive_reason: null,
  waived_at_version: null,
};

describe("VerificationPane", () => {
  const listFlags = vi.mocked(flagsApi.listFlags);

  beforeEach(() => {
    listFlags.mockReset();
  });

  it("hiện readiness summary theo format '% accepted · N chờ duyệt lại · N cờ đỏ'", async () => {
    listFlags.mockResolvedValueOnce({ data: [], error: null });

    render(<VerificationPane projectId="p1" spineVersion={5} readiness={readiness} onClose={() => {}} />);

    expect(await screen.findByText("72% accepted")).toBeInTheDocument();
    expect(screen.getByText("4 chờ duyệt lại")).toBeInTheDocument();
    expect(screen.getByText("2 cờ đỏ")).toBeInTheDocument();
  });

  it("hiện cờ từ BE fixture; không cho waive rule array_empty", async () => {
    listFlags.mockResolvedValueOnce({ data: [redFlag], error: null });

    render(<VerificationPane projectId="p1" spineVersion={5} readiness={readiness} onClose={() => {}} />);

    expect(await screen.findByText("Actors đang rỗng")).toBeInTheDocument();
    expect(screen.getByText("array_empty")).toBeInTheDocument();
    expect(screen.getByText("Không thể waive")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Waive" })).not.toBeInTheDocument();
  });

  it("cờ waive được thì có nút Waive", async () => {
    listFlags.mockResolvedValueOnce({
      data: [{ ...redFlag, id: "FL02", rule_id: "unconfirmed_assumption" }],
      error: null,
    });

    render(<VerificationPane projectId="p1" spineVersion={5} readiness={readiness} onClose={() => {}} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Waive" })).toBeInTheDocument();
    });
  });

  it("không còn cờ mở thì hiện thông báo trống", async () => {
    listFlags.mockResolvedValueOnce({ data: [], error: null });

    render(<VerificationPane projectId="p1" spineVersion={5} readiness={readiness} onClose={() => {}} />);

    expect(await screen.findByText("Không có cờ nào đang mở.")).toBeInTheDocument();
  });
});
