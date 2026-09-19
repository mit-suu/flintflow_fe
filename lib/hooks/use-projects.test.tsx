import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { listProjects } from "@/lib/api/projects";
import { ProjectsProvider, useProjects } from "./use-projects";

vi.mock("@/lib/api/projects", () => ({ listProjects: vi.fn() }));

function Probe() {
  const { loading, error, projects, reload } = useProjects();
  return (
    <>
      <p>{loading ? "loading" : error ?? `${projects.length} dự án`}</p>
      <button type="button" onClick={() => void reload()}>
        reload
      </button>
    </>
  );
}

const renderProbe = () =>
  render(
    <ProjectsProvider>
      <Probe />
    </ProjectsProvider>
  );

describe("ProjectsProvider", () => {
  it("tải một lần, reload tải lại", async () => {
    vi.mocked(listProjects)
      .mockResolvedValueOnce({ data: [], error: null } as never)
      .mockResolvedValueOnce({ data: [{ _id: "p1" }], error: null } as never);
    renderProbe();

    expect(screen.getByText("loading")).toBeInTheDocument();
    expect(await screen.findByText("0 dự án")).toBeInTheDocument();
    expect(listProjects).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "reload" }));
    expect(await screen.findByText("1 dự án")).toBeInTheDocument();
    expect(listProjects).toHaveBeenCalledTimes(2);
  });

  it("lỗi tải ⇒ error có thông điệp", async () => {
    vi.mocked(listProjects).mockRejectedValueOnce(new Error("BE sập"));
    renderProbe();
    await waitFor(() => expect(screen.getByText("BE sập")).toBeInTheDocument());
  });
});
