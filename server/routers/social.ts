import { and, asc, desc, eq, inArray, sql, gte } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  socialAccounts,
  socialPosts,
  socialPostDispatches,
  socialMetricsHistory,
  gmbLocations,
  stores,
  users,
} from "../../drizzle/schema";
import { assertPermission } from "../authorization";
import { writeAuditLog } from "../audit";
import { getDb } from "../db";
import { protectedProcedure, router } from "../_core/trpc";
import {
  getSocialApiConfig,
  saveSocialApiConfig,
  testPlatformConnection,
  publishToAccount,
  syncAccountMetrics,
  syncAllActiveAccounts,
  runScheduledPostsPublisher,
  fetchLiveAccountMetrics,
} from "../social/apiService";
import type { SocialPlatform, SocialPostType } from "../social/types";

async function requireDatabase() {
  const database = await getDb();
  if (!database) {
    throw new TRPCError({
      code: "SERVICE_UNAVAILABLE",
      message: "Banco de dados indisponível.",
    });
  }
  return database;
}

export const socialRouter = router({
  // -----------------------------------------------------------
  // 1. API Keys & Global Credentials (in Settings)
  // -----------------------------------------------------------
  getApiSettings: protectedProcedure.query(async ({ ctx }) => {
    await assertPermission(ctx.user, "settings.read");
    const config = await getSocialApiConfig();

    return {
      metaAppId: config.metaAppId || "",
      metaAppSecret: config.metaAppSecret ? "********" : "",
      metaRedirectUri: config.metaRedirectUri || "",

      linkedinClientId: config.linkedinClientId || "",
      linkedinClientSecret: config.linkedinClientSecret ? "********" : "",
      linkedinRedirectUri: config.linkedinRedirectUri || "",

      tiktokClientKey: config.tiktokClientKey || "",
      tiktokClientSecret: config.tiktokClientSecret ? "********" : "",
      tiktokRedirectUri: config.tiktokRedirectUri || "",

      googleBusinessClientId: config.googleBusinessClientId || "",
      googleBusinessClientSecret: config.googleBusinessClientSecret ? "********" : "",
      googleBusinessApiKey: config.googleBusinessApiKey ? "********" : "",
      googleBusinessRedirectUri: config.googleBusinessRedirectUri || "",
    };
  }),

  updateApiSettings: protectedProcedure
    .input(
      z.object({
        metaAppId: z.string().trim().optional(),
        metaAppSecret: z.string().optional(),
        metaRedirectUri: z.string().trim().optional(),

        linkedinClientId: z.string().trim().optional(),
        linkedinClientSecret: z.string().optional(),
        linkedinRedirectUri: z.string().trim().optional(),

        tiktokClientKey: z.string().trim().optional(),
        tiktokClientSecret: z.string().optional(),
        tiktokRedirectUri: z.string().trim().optional(),

        googleBusinessClientId: z.string().trim().optional(),
        googleBusinessClientSecret: z.string().optional(),
        googleBusinessApiKey: z.string().optional(),
        googleBusinessRedirectUri: z.string().trim().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertPermission(ctx.user, "settings.write");
      const current = await getSocialApiConfig();

      const nextConfig = {
        ...current,
        metaAppId: input.metaAppId ?? current.metaAppId,
        metaAppSecret:
          input.metaAppSecret && input.metaAppSecret !== "********"
            ? input.metaAppSecret
            : current.metaAppSecret,
        metaRedirectUri: input.metaRedirectUri ?? current.metaRedirectUri,

        linkedinClientId: input.linkedinClientId ?? current.linkedinClientId,
        linkedinClientSecret:
          input.linkedinClientSecret && input.linkedinClientSecret !== "********"
            ? input.linkedinClientSecret
            : current.linkedinClientSecret,
        linkedinRedirectUri: input.linkedinRedirectUri ?? current.linkedinRedirectUri,

        tiktokClientKey: input.tiktokClientKey ?? current.tiktokClientKey,
        tiktokClientSecret:
          input.tiktokClientSecret && input.tiktokClientSecret !== "********"
            ? input.tiktokClientSecret
            : current.tiktokClientSecret,
        tiktokRedirectUri: input.tiktokRedirectUri ?? current.tiktokRedirectUri,

        googleBusinessClientId: input.googleBusinessClientId ?? current.googleBusinessClientId,
        googleBusinessClientSecret:
          input.googleBusinessClientSecret && input.googleBusinessClientSecret !== "********"
            ? input.googleBusinessClientSecret
            : current.googleBusinessClientSecret,
        googleBusinessApiKey:
          input.googleBusinessApiKey && input.googleBusinessApiKey !== "********"
            ? input.googleBusinessApiKey
            : current.googleBusinessApiKey,
        googleBusinessRedirectUri: input.googleBusinessRedirectUri ?? current.googleBusinessRedirectUri,
      };

      await saveSocialApiConfig(nextConfig);
      await writeAuditLog({
        actorUserId: ctx.user.id,
        action: "update",
        entityType: "social_api_settings",
        entityId: 0,
        afterData: { message: "Configurações de API de Social Media atualizadas" },
      });

      return { success: true };
    }),

  // -----------------------------------------------------------
  // 2. Social Accounts Management (Multiple Accounts Support)
  // -----------------------------------------------------------
  listAccounts: protectedProcedure.query(async ({ ctx }) => {
    await assertPermission(ctx.user, "media.read");
    const db = await requireDatabase();

    const accounts = await db
      .select()
      .from(socialAccounts)
      .orderBy(asc(socialAccounts.platform), asc(socialAccounts.accountName));

    // Get latest metrics for each account
    const accountsWithMetrics = await Promise.all(
      accounts.map(async acc => {
        const [latestMetric] = await db
          .select()
          .from(socialMetricsHistory)
          .where(eq(socialMetricsHistory.accountId, acc.id))
          .orderBy(desc(socialMetricsHistory.recordedDate))
          .limit(1);

        return {
          ...acc,
          accessToken: acc.accessToken ? "********" : "",
          refreshToken: acc.refreshToken ? "********" : "",
          followersCount: latestMetric?.followersCount ?? 0,
          reach: latestMetric?.reach ?? 0,
          impressions: latestMetric?.impressions ?? 0,
        };
      })
    );

    return accountsWithMetrics;
  }),

  createAccount: protectedProcedure
    .input(
      z.object({
        platform: z.enum(["instagram", "facebook", "linkedin", "tiktok", "google_business"]),
        accountName: z.string().trim().min(2).max(120),
        accountIdentifier: z.string().trim().min(1).max(255),
        avatarUrl: z.string().trim().optional(),
        profileUrl: z.string().trim().optional(),
        externalId: z.string().trim().optional(),
        accessToken: z.string().trim().optional(),
        refreshToken: z.string().trim().optional(),
        isActive: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertPermission(ctx.user, "media.write");
      const db = await requireDatabase();

      const [newAccount] = await db
        .insert(socialAccounts)
        .values({
          platform: input.platform as SocialPlatform,
          accountName: input.accountName,
          accountIdentifier: input.accountIdentifier,
          avatarUrl: input.avatarUrl || null,
          profileUrl: input.profileUrl || null,
          externalId: input.externalId || null,
          accessToken: input.accessToken || null,
          refreshToken: input.refreshToken || null,
          isActive: input.isActive,
          lastSyncStatus: "pending",
        })
        .returning();

      // Trigger initial metric sync if token provided
      if (input.accessToken) {
        syncAccountMetrics(newAccount.id).catch(() => {});
      }

      await writeAuditLog({
        actorUserId: ctx.user.id,
        action: "create",
        entityType: "social_accounts",
        entityId: newAccount.id,
        afterData: {
          platform: input.platform,
          accountName: input.accountName,
          accountIdentifier: input.accountIdentifier,
        },
      });

      return newAccount;
    }),

  updateAccount: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        accountName: z.string().trim().min(2).max(120).optional(),
        accountIdentifier: z.string().trim().min(1).max(255).optional(),
        avatarUrl: z.string().trim().optional(),
        profileUrl: z.string().trim().optional(),
        externalId: z.string().trim().optional(),
        accessToken: z.string().trim().optional(),
        refreshToken: z.string().trim().optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertPermission(ctx.user, "media.write");
      const db = await requireDatabase();

      const [existing] = await db
        .select()
        .from(socialAccounts)
        .where(eq(socialAccounts.id, input.id))
        .limit(1);

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Conta não encontrada.",
        });
      }

      const updates: Partial<typeof socialAccounts.$inferInsert> = {
        updatedAt: new Date(),
      };
      if (input.accountName !== undefined) updates.accountName = input.accountName;
      if (input.accountIdentifier !== undefined) updates.accountIdentifier = input.accountIdentifier;
      if (input.avatarUrl !== undefined) updates.avatarUrl = input.avatarUrl;
      if (input.profileUrl !== undefined) updates.profileUrl = input.profileUrl;
      if (input.externalId !== undefined) updates.externalId = input.externalId;
      if (input.isActive !== undefined) updates.isActive = input.isActive;
      if (input.accessToken && input.accessToken !== "********") updates.accessToken = input.accessToken;
      if (input.refreshToken && input.refreshToken !== "********") updates.refreshToken = input.refreshToken;

      const [updated] = await db
        .update(socialAccounts)
        .set(updates)
        .where(eq(socialAccounts.id, input.id))
        .returning();

      return updated;
    }),

  deleteAccount: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await assertPermission(ctx.user, "media.write");
      const db = await requireDatabase();

      await db.delete(socialAccounts).where(eq(socialAccounts.id, input.id));

      await writeAuditLog({
        actorUserId: ctx.user.id,
        action: "delete",
        entityType: "social_accounts",
        entityId: input.id,
        beforeData: { id: input.id },
      });

      return { success: true };
    }),

  testConnection: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await assertPermission(ctx.user, "media.read");
      const db = await requireDatabase();

      const [acc] = await db
        .select()
        .from(socialAccounts)
        .where(eq(socialAccounts.id, input.id))
        .limit(1);

      if (!acc) throw new TRPCError({ code: "NOT_FOUND", message: "Conta não encontrada." });

      const result = await testPlatformConnection(acc);
      if (result.success) {
        // Also update lastSyncStatus
        await db
          .update(socialAccounts)
          .set({ lastSyncAt: new Date(), lastSyncStatus: "success", lastSyncError: null })
          .where(eq(socialAccounts.id, acc.id));
      } else {
        await db
          .update(socialAccounts)
          .set({ lastSyncStatus: "error", lastSyncError: result.message })
          .where(eq(socialAccounts.id, acc.id));
      }

      return result;
    }),

  syncAccount: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await assertPermission(ctx.user, "media.write");
      const ok = await syncAccountMetrics(input.id);
      return { success: ok };
    }),

  syncAllAccounts: protectedProcedure.mutation(async ({ ctx }) => {
    await assertPermission(ctx.user, "media.write");
    const result = await syncAllActiveAccounts();
    return result;
  }),

  // -----------------------------------------------------------
  // 3. Posts & Scheduling Engine (mLabs clone style)
  // -----------------------------------------------------------
  listPosts: protectedProcedure
    .input(
      z
        .object({
          status: z.enum(["draft", "scheduled", "publishing", "published", "failed", "cancelled"]).optional(),
          accountId: z.number().int().positive().optional(),
          month: z.number().int().min(1).max(12).optional(),
          year: z.number().int().min(2020).max(2035).optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      await assertPermission(ctx.user, "media.read");
      const db = await requireDatabase();

      let query = db.select().from(socialPosts);
      const conditions = [];

      if (input?.status) {
        conditions.push(eq(socialPosts.status, input.status));
      }

      const posts = await db
        .select({
          post: socialPosts,
          authorName: users.name,
        })
        .from(socialPosts)
        .leftJoin(users, eq(socialPosts.createdById, users.id))
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(desc(socialPosts.scheduledFor), desc(socialPosts.createdAt));

      // Fetch dispatches and accounts for these posts
      const result = await Promise.all(
        posts.map(async ({ post, authorName }) => {
          const dispatches = await db
            .select({
              dispatch: socialPostDispatches,
              account: socialAccounts,
            })
            .from(socialPostDispatches)
            .leftJoin(socialAccounts, eq(socialPostDispatches.accountId, socialAccounts.id))
            .where(eq(socialPostDispatches.postId, post.id));

          let mediaUrlsList: string[] = [];
          try {
            mediaUrlsList = post.mediaUrls ? JSON.parse(post.mediaUrls) : [];
          } catch {
            mediaUrlsList = [];
          }

          let targetIds: number[] = [];
          try {
            targetIds = post.targetAccountIds ? JSON.parse(post.targetAccountIds) : [];
          } catch {
            targetIds = [];
          }

          return {
            ...post,
            authorName,
            mediaUrlsList,
            targetAccountIdsList: targetIds,
            dispatches: dispatches.map(d => ({
              ...d.dispatch,
              accountName: d.account?.accountName,
              accountPlatform: d.account?.platform,
              accountIdentifier: d.account?.accountIdentifier,
              accountAvatar: d.account?.avatarUrl,
            })),
          };
        })
      );

      return result;
    }),

  createPost: protectedProcedure
    .input(
      z.object({
        title: z.string().trim().max(255).optional(),
        content: z.string().min(1, "O texto da publicação é obrigatório"),
        postType: z.enum(["feed", "reel", "story", "carousel", "article", "gmb_update", "gmb_offer"]).default("feed"),
        mediaUrls: z.array(z.string().url()).optional(),
        targetAccountIds: z.array(z.number().int().positive()).min(1, "Selecione ao menos uma conta de destino"),
        scheduledFor: z.coerce.date().nullable().optional(),
        publishNow: z.boolean().default(false),
        gmbActionUrl: z.string().url().or(z.literal("")).optional(),
        gmbActionType: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertPermission(ctx.user, "media.write");
      const db = await requireDatabase();

      const initialStatus = input.publishNow
        ? "publishing"
        : input.scheduledFor
          ? "scheduled"
          : "draft";

      const [newPost] = await db
        .insert(socialPosts)
        .values({
          title: input.title || null,
          content: input.content,
          postType: input.postType as SocialPostType,
          mediaUrls: input.mediaUrls ? JSON.stringify(input.mediaUrls) : null,
          targetAccountIds: JSON.stringify(input.targetAccountIds),
          status: initialStatus,
          scheduledFor: input.scheduledFor || (input.publishNow ? new Date() : null),
          gmbActionUrl: input.gmbActionUrl || null,
          gmbActionType: input.gmbActionType || null,
          notes: input.notes || null,
          createdById: ctx.user.id,
        })
        .returning();

      // Create dispatches for each account
      for (const accId of input.targetAccountIds) {
        await db.insert(socialPostDispatches).values({
          postId: newPost.id,
          accountId: accId,
          status: initialStatus,
        });
      }

      // If publishNow, dispatch immediately!
      if (input.publishNow) {
        const accounts = await db
          .select()
          .from(socialAccounts)
          .where(inArray(socialAccounts.id, input.targetAccountIds));

        let anySuccess = false;
        for (const acc of accounts) {
          const res = await publishToAccount(acc, newPost);
          if (res.success) anySuccess = true;

          await db
            .update(socialPostDispatches)
            .set({
              status: res.success ? "published" : "failed",
              externalPostId: res.externalPostId || null,
              externalPostUrl: res.externalPostUrl || null,
              publishedAt: res.success ? new Date() : null,
              errorMessage: res.error || null,
            })
            .where(
              and(
                eq(socialPostDispatches.postId, newPost.id),
                eq(socialPostDispatches.accountId, acc.id)
              )
            );
        }

        await db
          .update(socialPosts)
          .set({
            status: anySuccess ? "published" : "failed",
            publishedAt: anySuccess ? new Date() : null,
          })
          .where(eq(socialPosts.id, newPost.id));
      }

      return newPost;
    }),

  updatePost: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        title: z.string().trim().max(255).optional(),
        content: z.string().min(1).optional(),
        postType: z.enum(["feed", "reel", "story", "carousel", "article", "gmb_update", "gmb_offer"]).optional(),
        mediaUrls: z.array(z.string().url()).optional(),
        targetAccountIds: z.array(z.number().int().positive()).optional(),
        scheduledFor: z.coerce.date().nullable().optional(),
        status: z.enum(["draft", "scheduled", "cancelled"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertPermission(ctx.user, "media.write");
      const db = await requireDatabase();

      const updates: Partial<typeof socialPosts.$inferInsert> = {
        updatedAt: new Date(),
      };
      if (input.title !== undefined) updates.title = input.title;
      if (input.content !== undefined) updates.content = input.content;
      if (input.postType !== undefined) updates.postType = input.postType as SocialPostType;
      if (input.mediaUrls !== undefined) updates.mediaUrls = JSON.stringify(input.mediaUrls);
      if (input.targetAccountIds !== undefined) updates.targetAccountIds = JSON.stringify(input.targetAccountIds);
      if (input.scheduledFor !== undefined) updates.scheduledFor = input.scheduledFor;
      if (input.status !== undefined) updates.status = input.status;

      const [updated] = await db
        .update(socialPosts)
        .set(updates)
        .where(eq(socialPosts.id, input.id))
        .returning();

      return updated;
    }),

  deletePost: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await assertPermission(ctx.user, "media.write");
      const db = await requireDatabase();

      await db.delete(socialPosts).where(eq(socialPosts.id, input.id));
      return { success: true };
    }),

  publishPostNow: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await assertPermission(ctx.user, "media.write");
      const db = await requireDatabase();

      const [post] = await db
        .select()
        .from(socialPosts)
        .where(eq(socialPosts.id, input.id))
        .limit(1);

      if (!post) throw new TRPCError({ code: "NOT_FOUND", message: "Post não encontrado." });

      let targetIds: number[] = [];
      try {
        targetIds = JSON.parse(post.targetAccountIds);
      } catch {
        targetIds = [];
      }

      if (targetIds.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Post não possui contas associadas." });
      }

      const accounts = await db
        .select()
        .from(socialAccounts)
        .where(inArray(socialAccounts.id, targetIds));

      let anySuccess = false;
      for (const acc of accounts) {
        const res = await publishToAccount(acc, post);
        if (res.success) anySuccess = true;

        await db
          .insert(socialPostDispatches)
          .values({
            postId: post.id,
            accountId: acc.id,
            status: res.success ? "published" : "failed",
            externalPostId: res.externalPostId || null,
            externalPostUrl: res.externalPostUrl || null,
            publishedAt: res.success ? new Date() : null,
            errorMessage: res.error || null,
          })
          .onConflictDoUpdate({
            target: [socialPostDispatches.id],
            set: {
              status: res.success ? "published" : "failed",
              externalPostId: res.externalPostId || null,
              externalPostUrl: res.externalPostUrl || null,
              publishedAt: res.success ? new Date() : null,
              errorMessage: res.error || null,
            },
          });
      }

      await db
        .update(socialPosts)
        .set({
          status: anySuccess ? "published" : "failed",
          publishedAt: anySuccess ? new Date() : null,
        })
        .where(eq(socialPosts.id, post.id));

      return { success: anySuccess };
    }),

  // -----------------------------------------------------------
  // 4. Automated Reports & Analytics via Live API
  // -----------------------------------------------------------
  getMetricsReport: protectedProcedure
    .input(
      z
        .object({
          accountId: z.number().int().positive().optional(),
          days: z.number().int().min(1).max(365).default(30),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      await assertPermission(ctx.user, "media.read");
      const db = await requireDatabase();
      const days = input?.days || 30;

      // Check if accounts need automatic live refresh
      const activeAccounts = await db
        .select()
        .from(socialAccounts)
        .where(eq(socialAccounts.isActive, true));

      const now = new Date();
      const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);

      // Auto-refresh stale accounts transparently in background
      for (const acc of activeAccounts) {
        if (!acc.lastSyncAt || new Date(acc.lastSyncAt) < thirtyMinutesAgo) {
          syncAccountMetrics(acc.id).catch(() => {});
        }
      }

      // Fetch metrics history for the requested period
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      const startDateStr = startDate.toISOString().split("T")[0];

      const conditions = [gte(socialMetricsHistory.recordedDate, startDateStr)];
      if (input?.accountId) {
        conditions.push(eq(socialMetricsHistory.accountId, input.accountId));
      }

      const historyRows = await db
        .select({
          metric: socialMetricsHistory,
          platform: socialAccounts.platform,
          accountName: socialAccounts.accountName,
          accountIdentifier: socialAccounts.accountIdentifier,
          avatarUrl: socialAccounts.avatarUrl,
        })
        .from(socialMetricsHistory)
        .leftJoin(socialAccounts, eq(socialMetricsHistory.accountId, socialAccounts.id))
        .where(and(...conditions))
        .orderBy(asc(socialMetricsHistory.recordedDate));

      // Calculate totals and aggregates
      let totalFollowers = 0;
      let totalImpressions = 0;
      let totalReach = 0;
      let totalEngagement = 0;
      let totalClicks = 0;
      let totalGmbCalls = 0;
      let totalGmbDirections = 0;
      let totalGmbWebsite = 0;

      // Group by date for charts
      const dateMap = new Map<string, any>();
      // Group by account for account breakdown
      const accountMap = new Map<number, any>();
      // Group by platform for platform breakdown
      const platformMap = new Map<string, any>();

      for (const row of historyRows) {
        const m = row.metric;
        const d = String(m.recordedDate);

        if (!dateMap.has(d)) {
          dateMap.set(d, {
            date: d,
            impressions: 0,
            reach: 0,
            engagement: 0,
            followers: 0,
            clicks: 0,
            gmbCalls: 0,
            gmbDirections: 0,
          });
        }
        const dateEntry = dateMap.get(d);
        dateEntry.impressions += m.impressions;
        dateEntry.reach += m.reach;
        dateEntry.engagement += m.engagement;
        dateEntry.followers += m.followersCount;
        dateEntry.clicks += m.clicks;
        dateEntry.gmbCalls += m.gmbCalls;
        dateEntry.gmbDirections += m.gmbDirectionRequests;

        // Platform aggregation
        const p = row.platform || "outros";
        if (!platformMap.has(p)) {
          platformMap.set(p, {
            platform: p,
            impressions: 0,
            reach: 0,
            engagement: 0,
            followers: 0,
          });
        }
        const platEntry = platformMap.get(p);
        platEntry.impressions += m.impressions;
        platEntry.reach += m.reach;
        platEntry.engagement += m.engagement;
        platEntry.followers = Math.max(platEntry.followers, m.followersCount);

        // Account aggregation (latest values)
        const accId = m.accountId;
        if (!accountMap.has(accId)) {
          accountMap.set(accId, {
            id: accId,
            name: row.accountName,
            platform: row.platform,
            identifier: row.accountIdentifier,
            avatarUrl: row.avatarUrl,
            followers: m.followersCount,
            impressions: 0,
            reach: 0,
            engagement: 0,
          });
        }
        const accEntry = accountMap.get(accId);
        accEntry.impressions += m.impressions;
        accEntry.reach += m.reach;
        accEntry.engagement += m.engagement;
        accEntry.followers = Math.max(accEntry.followers, m.followersCount);
      }

      // Latest total followers across all accounts
      accountMap.forEach(acc => {
        totalFollowers += acc.followers;
        totalImpressions += acc.impressions;
        totalReach += acc.reach;
        totalEngagement += acc.engagement;
      });

      for (const row of historyRows) {
        totalClicks += row.metric.clicks;
        totalGmbCalls += row.metric.gmbCalls;
        totalGmbDirections += row.metric.gmbDirectionRequests;
        totalGmbWebsite += row.metric.gmbWebsiteClicks;
      }

      const avgEngagementRate =
        totalImpressions > 0
          ? ((totalEngagement / totalImpressions) * 100).toFixed(2)
          : "0.00";

      // If no history exists yet, generate baseline demo data so charts render nicely
      const timelineData = Array.from(dateMap.values());

      return {
        summary: {
          totalAccounts: activeAccounts.length,
          totalFollowers,
          totalImpressions,
          totalReach,
          totalEngagement,
          avgEngagementRate,
          totalClicks,
          gmb: {
            calls: totalGmbCalls,
            directions: totalGmbDirections,
            websiteClicks: totalGmbWebsite,
          },
          lastSyncAt: activeAccounts[0]?.lastSyncAt || new Date(),
        },
        timeline: timelineData,
        platforms: Array.from(platformMap.values()),
        accounts: Array.from(accountMap.values()),
      };
    }),

  // -----------------------------------------------------------
  // 5. Google Meu Negócio (GMB) Locations & Stores
  // -----------------------------------------------------------
  listGmbLocations: protectedProcedure.query(async ({ ctx }) => {
    await assertPermission(ctx.user, "media.read");
    const db = await requireDatabase();

    const locations = await db
      .select({
        loc: gmbLocations,
        account: socialAccounts,
        linkedStore: stores,
      })
      .from(gmbLocations)
      .leftJoin(socialAccounts, eq(gmbLocations.accountId, socialAccounts.id))
      .leftJoin(stores, eq(gmbLocations.storeId, stores.id))
      .orderBy(asc(gmbLocations.locationName));

    return locations.map(l => ({
      ...l.loc,
      accountName: l.account?.accountName,
      storeName: l.linkedStore?.name,
    }));
  }),

  createGmbLocation: protectedProcedure
    .input(
      z.object({
        accountId: z.number().int().positive(),
        storeId: z.number().int().positive().nullable().optional(),
        locationName: z.string().trim().min(2).max(255),
        googleLocationId: z.string().trim().min(1).max(255),
        address: z.string().trim().optional(),
        phone: z.string().trim().optional(),
        websiteUri: z.string().trim().url().or(z.literal("")).optional(),
        regularHours: z.string().optional(),
        status: z.enum(["OPEN", "CLOSED_TEMPORARILY", "CLOSED_PERMANENTLY"]).default("OPEN"),
        rating: z.number().min(0).max(5).default(5),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertPermission(ctx.user, "media.write");
      const db = await requireDatabase();

      const [loc] = await db
        .insert(gmbLocations)
        .values({
          accountId: input.accountId,
          storeId: input.storeId || null,
          locationName: input.locationName,
          googleLocationId: input.googleLocationId,
          address: input.address || null,
          phone: input.phone || null,
          websiteUri: input.websiteUri || null,
          regularHours: input.regularHours || "Seg-Sex: 08:00 - 18:00 | Sáb: 08:00 - 12:00",
          status: input.status,
          rating: String(input.rating),
          reviewCount: 0,
        })
        .returning();

      return loc;
    }),

  updateGmbLocation: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        locationName: z.string().trim().min(2).max(255).optional(),
        phone: z.string().trim().optional(),
        websiteUri: z.string().trim().optional(),
        regularHours: z.string().optional(),
        specialHours: z.string().optional(),
        status: z.enum(["OPEN", "CLOSED_TEMPORARILY", "CLOSED_PERMANENTLY"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertPermission(ctx.user, "media.write");
      const db = await requireDatabase();

      const [updated] = await db
        .update(gmbLocations)
        .set({
          locationName: input.locationName,
          phone: input.phone,
          websiteUri: input.websiteUri,
          regularHours: input.regularHours,
          specialHours: input.specialHours,
          status: input.status,
          updatedAt: new Date(),
        })
        .where(eq(gmbLocations.id, input.id))
        .returning();

      return updated;
    }),

  deleteGmbLocation: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await assertPermission(ctx.user, "media.write");
      const db = await requireDatabase();

      await db.delete(gmbLocations).where(eq(gmbLocations.id, input.id));
      return { success: true };
    }),
});
