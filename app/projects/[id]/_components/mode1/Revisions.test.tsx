import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Revisions } from "./Revisions";

describe("Revisions — Track Changes do CR ghi", () => {
  it("đoạn xoá là <del>, đoạn chèn là <ins>, kèm tác giả CR", () => {
    render(
      <Revisions
        revisions={[
          { kind: "del", text: "Logout ends the current session.", author: "CR-001" },
          { kind: "ins", text: "Logout ends all sessions.", author: "CR-001" },
        ]}
      />
    );
    const changes = screen.getByLabelText("Track Changes");
    expect(within(changes).getByText("Logout ends the current session.").tagName).toBe("DEL");
    expect(within(changes).getByText("Logout ends all sessions.").tagName).toBe("INS");
    expect(within(changes).getAllByText("CR-001")).toHaveLength(2);
  });
});
