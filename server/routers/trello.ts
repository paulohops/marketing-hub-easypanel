import { eq } from "drizzle-orm";
import { appSettings, userTrelloBoards } from "../../drizzle/schema";
import { ENV } from "../_core/env";
import { assertPermission } from "../authorization";
import { getDb } from "../db";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

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
  const key = ENV.trelloApiKey;
  const token = ENV.trelloToken;
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

async function getCurrentBoardReference(userId: number) {
  const database = await requireDatabase();
  const [personalRows, sharedRows] = await Promise.all([
    database.select().from(userTrelloBoards).where(eq(userTrelloBoards.userId, userId)).limit(1),
    database.select().from(appSettings).where(eq(appSettings.key, "trello_board_url")).limit(1),
  ]);
  const boardUrl = personalRows[0]?.boardUrl ?? sharedRows[0]?.value ?? "";
  const reference = getTrelloBoardReference(boardUrl);
  if (!reference) throw new TRPCError({ code: "BAD_REQUEST", message: "Configure um quadro do Trello válido antes de editar." });
  return reference;
}

async function trelloWrite(path: string, method: "POST" | "PUT", body: Record<string, string | boolean | null | undefined>) {
  const key = ENV.trelloApiKey;
  const token = ENV.trelloToken;
  if (!key || !token) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "A integração autenticada do Trello não está configurada." });
  const endpoint = new URL(`https://api.trello.com/1/${path.replace(/^\//, "")}`);
  endpoint.searchParams.set("key", key);
  endpoint.searchParams.set("token", token);
  for (const [field, value] of Object.entries(body)) if (value !== undefined && value !== null) endpoint.searchParams.set(field, String(value));
  try {
    const response = await fetch(endpoint, { method, headers: { Accept: "application/json" }, signal: AbortSignal.timeout(10_000) });
    if (response.status === 401 || response.status === 403) throw new TRPCError({ code: "FORBIDDEN", message: "O token do Trello não possui permissão para alterar este quadro." });
    if (response.status === 404) throw new TRPCError({ code: "NOT_FOUND", message: "O cartão ou a lista não foi encontrado no Trello." });
    if (!response.ok) throw new TRPCError({ code: "BAD_GATEWAY", message: "O Trello recusou a alteração solicitada." });
    return await response.json() as { id: string };
  } catch (error) {
    if (error instanceof TRPCError) throw error;
    throw new TRPCError({ code: "BAD_GATEWAY", message: "Não foi possível comunicar a alteração ao Trello." });
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
  createList: protectedProcedure.input(z.object({ name: z.string().trim().min(1).max(160) })).mutation(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "settings.update");
    const boardReference = await getCurrentBoardReference(ctx.user.id);
    return trelloWrite(`boards/${encodeURIComponent(boardReference)}/lists`, "POST", { name: input.name, pos: "bottom" });
  }),
  renameList: protectedProcedure.input(z.object({ listId: z.string().trim().min(1), name: z.string().trim().min(1).max(160) })).mutation(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "settings.update");
    await getCurrentBoardReference(ctx.user.id);
    return trelloWrite(`lists/${encodeURIComponent(input.listId)}`, "PUT", { name: input.name });
  }),
  createCard: protectedProcedure.input(z.object({ listId: z.string().trim().min(1), name: z.string().trim().min(1).max(500), description: z.string().trim().max(16_384).optional(), due: z.coerce.date().nullable().optional() })).mutation(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "settings.update");
    await getCurrentBoardReference(ctx.user.id);
    return trelloWrite("cards", "POST", { idList: input.listId, name: input.name, desc: input.description || "", due: input.due ? input.due.toISOString() : null, pos: "bottom" });
  }),
  updateCard: protectedProcedure.input(z.object({ cardId: z.string().trim().min(1), name: z.string().trim().min(1).max(500).optional(), description: z.string().trim().max(16_384).optional(), due: z.coerce.date().nullable().optional(), dueComplete: z.boolean().optional() })).mutation(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "settings.update");
    await getCurrentBoardReference(ctx.user.id);
    return trelloWrite(`cards/${encodeURIComponent(input.cardId)}`, "PUT", { name: input.name, desc: input.description, due: input.due === undefined ? undefined : input.due ? input.due.toISOString() : null, dueComplete: input.dueComplete });
  }),
  moveCard: protectedProcedure.input(z.object({ cardId: z.string().trim().min(1), listId: z.string().trim().min(1), position: z.union([z.number(), z.literal("bottom")]).default("bottom") })).mutation(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "settings.update");
    await getCurrentBoardReference(ctx.user.id);
    return trelloWrite(`cards/${encodeURIComponent(input.cardId)}`, "PUT", { idList: input.listId, pos: String(input.position) });
  }),
});
