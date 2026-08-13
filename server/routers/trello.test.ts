import { describe, expect, it } from "vitest";
import { getTrelloBoardReference, mapTrelloBoard } from "./trello";

describe("integração de quadros Trello", () => {
  it("extrai apenas o identificador de uma URL válida de quadro", () => {
    expect(getTrelloBoardReference("https://trello.com/b/AbC123/projeto-comercial?foo=bar")).toBe("AbC123");
    expect(getTrelloBoardReference("https://exemplo.com/b/AbC123")).toBeNull();
    expect(getTrelloBoardReference("https://trello.com/c/AbC123/cartao")).toBeNull();
  });

  it("organiza cartões abertos nas respectivas listas sem expor dados de autenticação", () => {
    const board = mapTrelloBoard({
      id: "board_1", name: "Trade", url: "https://trello.com/b/board_1/trade", lists: [{ id: "todo", name: "A fazer", pos: 1 }, { id: "done", name: "Concluído", pos: 2 }],
      cards: [{ id: "card_1", idList: "todo", name: "Planejar ação", url: "https://trello.com/c/card_1", pos: 1, labels: [{ id: "label_1", name: "MG", color: "green" }] }, { id: "card_2", idList: "done", name: "Campanha encerrada", url: "https://trello.com/c/card_2", pos: 1, closed: true }],
    });
    expect(board.cardCount).toBe(1);
    expect(board.lists[0]).toMatchObject({ name: "A fazer", cards: [{ name: "Planejar ação", labels: [{ name: "MG" }] }] });
    expect(JSON.stringify(board)).not.toContain("TRELLO_TOKEN");
  });
});
