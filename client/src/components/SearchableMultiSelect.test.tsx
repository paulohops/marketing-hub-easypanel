import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import SearchableMultiSelect from "./SearchableMultiSelect";

afterEach(cleanup);

describe("SearchableMultiSelect", () => {
  it("mantém a rolagem dentro da lista pesquisável sem propagá-la ao contêiner", () => {
    const onBackgroundWheel = vi.fn();
    render(<div onWheel={onBackgroundWheel}><SearchableMultiSelect id="cities" label="Cidades" options={Array.from({ length: 20 }, (_, index) => ({ id: index + 1, label: `Cidade ${index + 1}` }))} values={[]} onChange={() => undefined} /></div>);

    fireEvent.click(screen.getByRole("button", { name: "Cidades" }));
    fireEvent.wheel(screen.getByText("Cidade 10"), { deltaY: 180 });

    expect(onBackgroundWheel).not.toHaveBeenCalled();
  });

  it("mantém o padrão de seleção múltipla com busca por cidade", () => {
    const onChange = vi.fn();
    render(<SearchableMultiSelect id="cities-search" label="Cidades" options={[{ id: 1, label: "Belo Horizonte" }, { id: 2, label: "Sete Lagoas" }]} values={[]} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Cidades" }));
    fireEvent.change(screen.getByPlaceholderText("Pesquisar…"), { target: { value: "sete" } });
    fireEvent.click(screen.getByLabelText("Selecionar Sete Lagoas"));

    expect(onChange).toHaveBeenCalledWith([2]);
  });
});
