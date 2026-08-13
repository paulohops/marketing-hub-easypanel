import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import OnboardingTutorial from "./OnboardingTutorial";

describe("tutorial guiado", () => {
  beforeEach(() => window.localStorage.removeItem("trade_hub_onboarding_done"));
  afterEach(cleanup);

  it("abre na primeira entrada e permite impedir novas exibições", () => {
    render(<OnboardingTutorial />);

    expect(screen.getByRole("dialog", { name: "Bem-vindo ao Trade HUB" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Não mostrar novamente" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(window.localStorage.getItem("trade_hub_onboarding_done")).toBe("true");
  });

  it("permite pular sem registrar o bloqueio permanente", () => {
    render(<OnboardingTutorial />);
    fireEvent.click(screen.getByRole("button", { name: "Pular tutorial" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(window.localStorage.getItem("trade_hub_onboarding_done")).toBeNull();
  });
});
