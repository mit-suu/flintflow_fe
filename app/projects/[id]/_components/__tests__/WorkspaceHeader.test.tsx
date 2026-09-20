import { screen } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { describe, expect, it, vi } from "vitest";
import WorkspaceHeader from "../WorkspaceHeader";
import type { Project } from "@/types/project";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const PROJECT = { _id: "p1", name: "FlintFlow", domain: "SaaS", status: "active" } as Project;

describe("WorkspaceHeader", () => {
  it("badge baseline lấy từ phiên bản baseline của Spine", () => {
    renderWithIntl(<WorkspaceHeader project={PROJECT} user={null} baselineVersion="v1.0-conditional" onLogout={() => {}} />);
    expect(screen.getByText("Baseline v1.0-conditional")).toBeInTheDocument();
  });

  it("chưa ký baseline thì không hiện badge", () => {
    renderWithIntl(<WorkspaceHeader project={PROJECT} user={null} onLogout={() => {}} />);
    expect(screen.queryByText(/^Baseline/)).not.toBeInTheDocument();
  });
});
