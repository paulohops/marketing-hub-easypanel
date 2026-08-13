import { eq } from "drizzle-orm";
import { appSettings, userTrelloBoards } from "../../drizzle/schema";
import { assertPermission } from "../authorization";
import { getDb } from "../db";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";

type TrelloListPayload = { id: string; name: string; pos: number; closed?: boolean };
type TrelloCardPayload = { id: string; idList: string; name: string; desc?: string; url: string; due?: string | null; dueComplete?: boolean; closed?: boolean; pos: number; dateLastActivity?: string; labels?: Array<{ id: string; name: string; color?: string | null }> };
type TrelloBoardPayload = { id: string; name: string; url: string; desc?: string; closed?: boolean; dateLastActivity?: string; lists?: TrelloListPayload[]; cards?: TrelloCardPayload[] };

async function requireDatabase() {
  const database = await getDb();
  if (!database) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Banco de dados indisponível." });
  return database;
}

export function getTrelloBoardReference(value: string) {
  try {
    const parsed = new URL(value);
    if (!["trello.com", "www.trello.com"].includes(parsed.hostname)) return null;
    const parts = parsed.pathname.split("/").filter(Boolean);
    const boardIndex = parts.indexOf("b");
    const reference = boardIndex >= 0 ? parts[boardIndex + 1] : null;
    return reference ? decodeURIComponent(reference) : null;
  } catch {
    return null;
  }
}

export function mapTrelloBoard(payload: TrelloBoardPayload) {
  const visibleLists = (payload.lists ?? []).filter(list => !list.closed).sort((left, right) => left.pos - right.pos).slice(0, 24);
  const visibleListIds = new Set(visibleLists.map(list => list.id));
  const cardsByList = new Map<string, TrelloCardPayload[]>();
  for (const card of (payload.cards ?? []).filter(card => !card.closed && visibleListIds.has(card.idList)).sort((left, right) => left.pos - right.pos).slice(0, 200)) {
    cardsByList.set(card.idList, [...(cardsByList.get(card.idList) ?? []), card]);
  }

  const cards = visibleLists.map(list => ({
    id: list.id,
    name: list.name,
    cards: (cardsByList.get(list.id) ?? []).map(card => ({
      id: card.id,
      name: card.name,
      description: card.desc || null,
      url: card.url,
      due: card.due ?? null,
      dueComplete: Boolean(card.dueComplete),
      lastActivityAt: card.dateLastActivity ?? null,
      labels: (card.labels ?? []).map(label => ({ id: label.id, name: label.name || "Sem nome", color: label.color ?? null })),
    })),
  }));

  return {
    id: payload.id,
    name: payload.name,
    url: payload.url,
    description: payload.desc || null,
    lastActivityAt: payload.dateLastActivity ?? null,
    lists: cards,
    cardCount: cards.reduce((total, list) => total + list.cards.length, 0),
  };
}

async function loadBoardFromTrello(boardReference: string) {
  const key = process.env.TRELLO_API_KEY;
  const token = process.env.TRELLO_TOKEN;
  if (!key || !token) return { status: "not_configured" as const };

  const endpoint = new URL(`https://api.trello.com/1/boards/${encodeURIComponent(boardReference)}`);
  endpoint.searchParams.set("key", key);
  endpoint.searchParams.set("token", token);
  endpoint.searchParams.set("fields", "id,name,url,desc,closed,dateLastActivity");
  endpoint.searchParams.set("lists", "open");
  endpoint.searchParams.set("list_fields", "id,name,pos,closed");
  endpoint.searchParams.set("cards", "open");
  endpoint.searchParams.set("card_fields", "id,idList,name,desc,url,due,dueComplete,closed,pos,dateLastActivity,labels");
  endpoint.searchParams.set("card_limit", "200");

  try {
    const response = await fetch(endpoint, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(10_000) });
    if (response.status === 401 || response.status === 403) return { status: "unauthorized" as const };
    if (response.status === 404) return { status: "not_found" as const };
    if (!response.ok) return { status: "unavailable" as const };
    return { status: "ready" as const, board: mapTrelloBoard(await response.json() as TrelloBoardPayload) };
  } catch {
    return { status: "unavailable" as const };
  }
}

export const trelloRouter = router({
  currentBoard: protectedProcedure.query(async ({ ctx }) => {
    await assertPermission(ctx.user, "settings.read");
    const database = await requireDatabase();
    const [personalRows, sharedRows] = await Promise.all([
      database.select().from(userTrelloBoards).where(eq(userTrelloBoards.userId, ctx.user.id)).limit(1),
      database.select().from(appSettings).where(eq(appSettings.key, "trello_board_url")).limit(1),
    ]);
    const personalBoard = personalRows[0];
    const sharedBoard = sharedRows[0];
    const boardUrl = personalBoard?.boardUrl ?? sharedBoard?.value ?? "";
    const source = personalBoard ? "personal" as const : sharedBoard ? "shared" as const : "none" as const;
    if (!boardUrl) return { status: "missing" as const, source, boardUrl: null };

    const reference = getTrelloBoardReference(boardUrl);
    if (!reference) return { status: "invalid_url" as const, source, boardUrl };
    const result = await loadBoardFromTrello(reference);
    if (result.status === "ready") return { status: "ready" as const, source, boardUrl, board: result.board };
    return { status: result.status, source, boardUrl };
  }),
});
