import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import CompactListToggle from "./CompactListToggle";

describe("CompactListToggle", () => {
  afterEach(() => {
    cleanup();
    localStorage.removeItem("marketing_hub_list_density");
  });

  it("alterna para o modo compacto e persiste a preferência", () => {
    render(<CompactListToggle />);

    const toggle = screen.getByRole("button", { name: "Modo compacto" });
    expect(toggle).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(toggle);

    expect(localStorage.getItem("marketing_hub_list_density")).toBe("compact");
    expect(screen.getByRole("button", { name: "Compacto" })).toHaveAttribute("aria-pressed", "true");
  });
});
