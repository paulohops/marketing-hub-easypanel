import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { financeRouter } from "./routers/finance";
import { inventoryRouter } from "./routers/inventory";
import { settingsRouter } from "./routers/settings";
import { documentsRouter } from "./routers/documents";
import { actionsRouter } from "./routers/actions";
import { eventsRouter } from "./routers/events";
import { mediaRouter } from "./routers/media";
import { mapRouter } from "./routers/map";
import { notificationsRouter } from "./routers/notifications";
import { analyticsRouter } from "./routers/analytics";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),
  settings: settingsRouter,
  inventory: inventoryRouter,
  finance: financeRouter,
  documents: documentsRouter,
  media: mediaRouter,
  actions: actionsRouter,
  events: eventsRouter,
  map: mapRouter,
  notifications: notificationsRouter,
  analytics: analyticsRouter,
});

export type AppRouter = typeof appRouter;
