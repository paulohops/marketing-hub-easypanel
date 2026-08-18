import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mediaWorkspaceProps = vi.hoisted(() => ({ initialCategory: "" }));

vi.mock("./MediaWorkspace", () => ({
  default: (props: { initialCategory?: string }) => {
    mediaWorkspaceProps.initialCategory = props.initialCategory ?? "";
    return <h1>Mídia Tradicional</h1>;
  },
}));

import TraditionalMediaWorkspace from "./TraditionalMediaWorkspace";

beforeEach(() => {
  cleanup();
  mediaWorkspaceProps.initialCategory = "";
});

afterEach(() => {
  cleanup();
});

describe("workspace independente de Mídia Tradicional", () => {
  it("abre o workspace completo com a categoria tradicional", () => {
    render(<TraditionalMediaWorkspace />);

    expect(screen.getByRole("heading", { name: "Mídia Tradicional" })).toBeInTheDocument();
    expect(mediaWorkspaceProps.initialCategory).toBe("audio_video");
  });
});
