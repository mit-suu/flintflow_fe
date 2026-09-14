"use client";

import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import VerificationPane from "./VerificationPane";
import * as api from "../../../../lib/api";

vi.mock("../../../../lib/api", () => ({
  apiCall: vi.fn(),
}));

describe("VerificationPane", () => {
  const mockApiCall = vi.mocked(api.apiCall);

  beforeEach(() => {
    mockApiCall.mockClear();
  });

  it("hiện empty state khi /verification trả null data", async () => {
    mockApiCall.mockResolvedValueOnce({ data: null, error: null });

    render(<VerificationPane projectId="p1" onClose={() => {}} />);

    await waitFor(
      () => {
        expect(screen.getByText("Chưa có dữ liệu kiểm tra")).toBeInTheDocument();
      },
      { timeout: 2000 }
    );
  });

  it("hiện empty state khi data rỗng (tất cả field undefined/empty)", async () => {
    mockApiCall.mockClear();
    mockApiCall.mockResolvedValueOnce({
      data: {
        readinessScore: undefined,
        completenessPercent: undefined,
        goalAlignmentPercent: undefined,
        blockingIssues: [],
        facts: [],
        assumptions: [],
      },
      error: null,
    });

    render(<VerificationPane projectId="p1" onClose={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText("Chưa có dữ liệu kiểm tra")).toBeInTheDocument();
    });
  });

  it("hiện completeness score khi có data", async () => {
    mockApiCall.mockResolvedValueOnce({
      data: {
        completenessPercent: 65,
        readinessScore: undefined,
        goalAlignmentPercent: undefined,
        blockingIssues: [],
        facts: [],
        assumptions: [],
      },
      error: null,
    });

    render(<VerificationPane projectId="p1" onClose={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText("65%")).toBeInTheDocument();
      expect(screen.getByText("SRS COMPLETENESS")).toBeInTheDocument();
    });
  });

  it("không hiện demo string 'Sinh viên & Tài xế' hay '84%'", async () => {
    mockApiCall.mockResolvedValueOnce({
      data: {
        completenessPercent: 50,
        readinessScore: undefined,
        goalAlignmentPercent: undefined,
        blockingIssues: [],
        facts: [],
        assumptions: [],
      },
      error: null,
    });

    render(<VerificationPane projectId="p1" onClose={() => {}} />);

    await waitFor(() => {
      expect(screen.queryByText("Sinh viên & Tài xế")).not.toBeInTheDocument();
      expect(screen.queryByText("84%")).not.toBeInTheDocument();
    });
  });

  it("chỉ có readinessScore thì hiện thẻ readiness, không hiện empty state", async () => {
    mockApiCall.mockResolvedValueOnce({
      data: { readinessScore: 78, readinessLevel: "plan" },
      error: null,
    });

    render(<VerificationPane projectId="p1" onClose={() => {}} />);

    expect(await screen.findByText("READINESS")).toBeInTheDocument();
    expect(screen.getByText("78")).toBeInTheDocument();
    expect(screen.queryByText("Chưa có dữ liệu kiểm tra")).not.toBeInTheDocument();
  });

  it("hiện error message khi apiCall fail", async () => {
    const errorMsg = "Network error";
    mockApiCall.mockRejectedValueOnce(new Error(errorMsg));

    render(<VerificationPane projectId="p1" onClose={() => {}} />);

    await waitFor(() => {
      expect(
        screen.getByText(/Không tải được dữ liệu kiểm tra.*Network error/)
      ).toBeInTheDocument();
    });
  });
});
