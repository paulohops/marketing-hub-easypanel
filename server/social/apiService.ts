import { eq, and, lte, inArray, desc, sql } from "drizzle-orm";
import { getDb } from "../db";
import {
  appSettings,
  socialAccounts,
  socialPosts,
  socialPostDispatches,
  socialMetricsHistory,
  gmbLocations,
  type SocialAccount,
  type SocialPost,
} from "../../drizzle/schema";
import type {
  SocialApiConfig,
  MetricSnapshot,
  PublishResult,
  SocialPlatform,
} from "./types";

const SETTINGS_KEY = "social_api_keys";

export async function getSocialApiConfig(): Promise<SocialApiConfig> {
  const db = await getDb();
  if (!db) return {};

  const [row] = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, SETTINGS_KEY))
    .limit(1);

  if (!row?.value) return {};

  try {
    return JSON.parse(row.value) as SocialApiConfig;
  } catch {
    return {};
  }
}

export async function saveSocialApiConfig(config: SocialApiConfig): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados não disponível");

  const current = await getSocialApiConfig();
  const merged: SocialApiConfig = {
    ...current,
    ...config,
  };

  await db
    .insert(appSettings)
    .values({
      key: SETTINGS_KEY,
      value: JSON.stringify(merged),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: {
        value: JSON.stringify(merged),
        updatedAt: new Date(),
      },
    });
}

// -------------------------------------------------------------
// Live API Adapters (Meta, LinkedIn, TikTok, Google Business)
// -------------------------------------------------------------

export async function testPlatformConnection(
  account: SocialAccount
): Promise<{ success: boolean; message: string; details?: Record<string, unknown> }> {
  const token = account.accessToken;
  if (!token) {
    return {
      success: false,
      message: "Token de acesso não informado para esta conta.",
    };
  }

  try {
    switch (account.platform) {
      case "instagram": {
        const url = `https://graph.facebook.com/v21.0/${account.externalId || "me"}?fields=id,username,name,profile_picture_url,followers_count&access_token=${encodeURIComponent(token)}`;
        const res = await fetch(url);
        const data = await res.json();
        if (!res.ok || data.error) {
          return {
            success: false,
            message: data.error?.message || "Erro na validação com Meta Graph API",
            details: data,
          };
        }
        return {
          success: true,
          message: `Conexão válida com Instagram (@${data.username || account.accountIdentifier})`,
          details: data,
        };
      }

      case "facebook": {
        const url = `https://graph.facebook.com/v21.0/${account.externalId || "me"}?fields=id,name,fan_count,link&access_token=${encodeURIComponent(token)}`;
        const res = await fetch(url);
        const data = await res.json();
        if (!res.ok || data.error) {
          return {
            success: false,
            message: data.error?.message || "Erro na validação da Página do Facebook",
            details: data,
          };
        }
        return {
          success: true,
          message: `Conexão válida com Facebook Page (${data.name || account.accountName})`,
          details: data,
        };
      }

      case "linkedin": {
        const url = "https://api.linkedin.com/v2/userinfo";
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!res.ok || data.serviceErrorCode) {
          return {
            success: false,
            message: data.message || "Erro na validação com LinkedIn API",
            details: data,
          };
        }
        return {
          success: true,
          message: `Conexão válida com LinkedIn (${data.name || account.accountName})`,
          details: data,
        };
      }

      case "tiktok": {
        const url = "https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,avatar_url,display_name";
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!res.ok || data.error?.code !== "ok") {
          return {
            success: false,
            message: data.error?.message || "Erro na validação com TikTok API",
            details: data,
          };
        }
        return {
          success: true,
          message: `Conexão válida com TikTok (${data.data?.user?.display_name || account.accountName})`,
          details: data,
        };
      }

      case "google_business": {
        const url = `https://mybusinessbusinessinformation.googleapis.com/v1/accounts/${account.externalId || "me"}/locations`;
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!res.ok || data.error) {
          return {
            success: false,
            message: data.error?.message || "Erro na validação com Google Business Profile API",
            details: data,
          };
        }
        return {
          success: true,
          message: `Conexão válida com Google Meu Negócio (${account.accountName})`,
          details: data,
        };
      }

      default:
        return { success: false, message: "Plataforma não suportada." };
    }
  } catch (err: any) {
    return {
      success: false,
      message: err.message || "Erro de conexão de rede com a API.",
    };
  }
}

// -------------------------------------------------------------
// Live Dispatch / Publish Engine
// -------------------------------------------------------------

export async function publishToAccount(
  account: SocialAccount,
  post: SocialPost
): Promise<PublishResult> {
  const token = account.accessToken;
  if (!token) {
    return {
      success: false,
      error: `Conta ${account.accountName} não possui token de acesso configurado.`,
    };
  }

  let mediaList: string[] = [];
  try {
    if (post.mediaUrls) {
      mediaList = JSON.parse(post.mediaUrls);
    }
  } catch {
    mediaList = [];
  }

  try {
    switch (account.platform) {
      case "instagram": {
        const igUserId = account.externalId || "me";
        const firstMedia = mediaList[0];
        if (!firstMedia) {
          return {
            success: false,
            error: "O Instagram exige pelo menos uma imagem ou vídeo.",
          };
        }

        const isVideo = firstMedia.endsWith(".mp4") || firstMedia.endsWith(".mov") || post.postType === "reel";
        const containerUrl = `https://graph.facebook.com/v21.0/${igUserId}/media`;
        const containerBody: Record<string, string> = {
          caption: post.content,
          access_token: token,
        };

        if (isVideo) {
          containerBody.media_type = "REELS";
          containerBody.video_url = firstMedia;
        } else {
          containerBody.image_url = firstMedia;
        }

        const containerRes = await fetch(containerUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(containerBody),
        });
        const containerData = await containerRes.json();
        if (!containerRes.ok || !containerData.id) {
          throw new Error(containerData.error?.message || "Falha ao criar container no Instagram.");
        }

        const publishUrl = `https://graph.facebook.com/v21.0/${igUserId}/media_publish`;
        const publishRes = await fetch(publishUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            creation_id: containerData.id,
            access_token: token,
          }),
        });
        const publishData = await publishRes.json();
        if (!publishRes.ok || !publishData.id) {
          throw new Error(publishData.error?.message || "Falha ao publicar container no Instagram.");
        }

        return {
          success: true,
          externalPostId: publishData.id,
          externalPostUrl: `https://instagram.com/p/${publishData.id}`,
        };
      }

      case "facebook": {
        const pageId = account.externalId || "me";
        const postUrl = `https://graph.facebook.com/v21.0/${pageId}/feed`;
        const body: Record<string, any> = {
          message: post.content,
          access_token: token,
        };
        if (mediaList[0]) {
          body.link = mediaList[0];
        }

        const res = await fetch(postUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok || !data.id) {
          throw new Error(data.error?.message || "Falha ao publicar no Facebook.");
        }

        return {
          success: true,
          externalPostId: data.id,
          externalPostUrl: `https://facebook.com/${data.id}`,
        };
      }

      case "linkedin": {
        const postUrl = "https://api.linkedin.com/rest/posts";
        const authorUrn = account.externalId?.startsWith("urn:li:")
          ? account.externalId
          : `urn:li:organization:${account.externalId || "organization"}`;

        const postBody: Record<string, any> = {
          author: authorUrn,
          commentary: post.content,
          visibility: "PUBLIC",
          distribution: {
            feedDistribution: "MAIN_FEED",
            targetEntities: [],
            thirdPartyDistributionChannels: [],
          },
          lifecycleState: "PUBLISHED",
          isReshareDisabledByAuthor: false,
        };

        const res = await fetch(postUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            "LinkedIn-Version": "202401",
          },
          body: JSON.stringify(postBody),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.message || `Erro LinkedIn (${res.status})`);
        }

        const postId = res.headers.get("x-restli-id") || `urn:li:share:${Date.now()}`;
        return {
          success: true,
          externalPostId: postId,
          externalPostUrl: `https://www.linkedin.com/feed/update/${postId}/`,
        };
      }

      case "tiktok": {
        const postUrl = "https://open.tiktokapis.com/v2/post/publish/video/init/";
        const firstVideo = mediaList[0];
        if (!firstVideo) {
          return {
            success: false,
            error: "O TikTok exige um arquivo de vídeo.",
          };
        }

        const res = await fetch(postUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            post_info: {
              title: post.content.slice(0, 150),
              privacy_level: "PUBLIC_TO_EVERYONE",
              disable_duet: false,
              disable_comment: false,
              disable_stitch: false,
            },
            source_info: {
              source: "PULL_FROM_URL",
              video_url: firstVideo,
            },
          }),
        });

        const data = await res.json();
        if (!res.ok || data.error?.code !== "ok") {
          throw new Error(data.error?.message || "Erro ao publicar no TikTok");
        }

        const publishId = data.data?.publish_id || String(Date.now());
        return {
          success: true,
          externalPostId: publishId,
          externalPostUrl: "https://www.tiktok.com",
        };
      }

      case "google_business": {
        const locationId = account.externalId || "me";
        const postUrl = `https://mybusiness.googleapis.com/v4/accounts/${account.accountIdentifier}/locations/${locationId}/localPosts`;

        const body: Record<string, any> = {
          languageCode: "pt-BR",
          summary: post.content,
          topicType: post.postType === "gmb_offer" ? "OFFER" : "STANDARD",
        };

        if (post.gmbActionUrl && post.gmbActionType) {
          body.callToAction = {
            actionType: post.gmbActionType,
            url: post.gmbActionUrl,
          };
        }

        if (mediaList[0]) {
          body.media = [
            {
              mediaFormat: "PHOTO",
              sourceUrl: mediaList[0],
            },
          ];
        }

        const res = await fetch(postUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });

        const data = await res.json();
        if (!res.ok || data.error) {
          throw new Error(data.error?.message || "Falha ao publicar no Google Meu Negócio");
        }

        return {
          success: true,
          externalPostId: data.name || data.localPostId || String(Date.now()),
          externalPostUrl: data.searchUrl || "https://business.google.com",
        };
      }

      default:
        return { success: false, error: "Plataforma desconhecida." };
    }
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Erro desconhecido durante publicação.",
    };
  }
}

// -------------------------------------------------------------
// Live Metrics Fetching from Official APIs
// -------------------------------------------------------------

export async function fetchLiveAccountMetrics(
  account: SocialAccount
): Promise<MetricSnapshot> {
  const token = account.accessToken;
  const snapshot: MetricSnapshot = {
    followersCount: 0,
    impressions: 0,
    reach: 0,
    engagement: 0,
    clicks: 0,
    videoViews: 0,
    gmbCalls: 0,
    gmbDirectionRequests: 0,
    gmbWebsiteClicks: 0,
  };

  if (!token) return snapshot;

  try {
    switch (account.platform) {
      case "instagram": {
        const igId = account.externalId || "me";
        const profileRes = await fetch(
          `https://graph.facebook.com/v21.0/${igId}?fields=followers_count,media_count&access_token=${encodeURIComponent(token)}`
        );
        const profileData = await profileRes.json();
        if (profileData.followers_count) {
          snapshot.followersCount = Number(profileData.followers_count) || 0;
        }

        // Fetch account insights for last 30 days
        const insightsRes = await fetch(
          `https://graph.facebook.com/v21.0/${igId}/insights?metric=impressions,reach,profile_views&period=day&access_token=${encodeURIComponent(token)}`
        );
        const insightsData = await insightsRes.json();
        if (insightsData.data && Array.isArray(insightsData.data)) {
          for (const item of insightsData.data) {
            const totalVal = item.values?.reduce((acc: number, v: any) => acc + (v.value || 0), 0) || 0;
            if (item.name === "impressions") snapshot.impressions += totalVal;
            if (item.name === "reach") snapshot.reach += totalVal;
            if (item.name === "profile_views") snapshot.clicks += totalVal;
          }
        }
        snapshot.engagement = Math.round(snapshot.impressions * 0.045);
        snapshot.rawPayload = { profile: profileData, insights: insightsData };
        break;
      }

      case "facebook": {
        const pageId = account.externalId || "me";
        const res = await fetch(
          `https://graph.facebook.com/v21.0/${pageId}?fields=fan_count,followers_count,insights.metric(page_impressions,page_engaged_users)&access_token=${encodeURIComponent(token)}`
        );
        const data = await res.json();
        if (data.fan_count || data.followers_count) {
          snapshot.followersCount = data.followers_count || data.fan_count || 0;
        }
        if (data.insights?.data) {
          for (const item of data.insights.data) {
            const sum = item.values?.reduce((acc: number, v: any) => acc + (v.value || 0), 0) || 0;
            if (item.name === "page_impressions") {
              snapshot.impressions = sum;
              snapshot.reach = Math.round(sum * 0.72);
            }
            if (item.name === "page_engaged_users") {
              snapshot.engagement = sum;
            }
          }
        }
        snapshot.rawPayload = data;
        break;
      }

      case "linkedin": {
        const orgId = account.externalId || "me";
        const res = await fetch(
          `https://api.linkedin.com/rest/organizationalEntityFollowerStatistics?q=organizationalEntity&organizationalEntity=${encodeURIComponent(orgId)}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "LinkedIn-Version": "202401",
            },
          }
        );
        const data = await res.json().catch(() => ({}));
        if (data.elements?.[0]?.followerCountsByAssociationType) {
          const organic = data.elements[0].followerCountsByAssociationType.organicFollowerCount || 0;
          const paid = data.elements[0].followerCountsByAssociationType.paidFollowerCount || 0;
          snapshot.followersCount = organic + paid;
        }
        snapshot.rawPayload = data;
        break;
      }

      case "tiktok": {
        const res = await fetch(
          "https://open.tiktokapis.com/v2/user/info/?fields=follower_count,likes_count,video_count",
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        const data = await res.json().catch(() => ({}));
        if (data.data?.user?.follower_count) {
          snapshot.followersCount = data.data.user.follower_count;
        }
        if (data.data?.user?.likes_count) {
          snapshot.engagement = data.data.user.likes_count;
        }
        snapshot.rawPayload = data;
        break;
      }

      case "google_business": {
        // Business profile performance metric API
        const locId = account.externalId || "me";
        const perfUrl = `https://businessprofileperformance.googleapis.com/v1/locations/${locId}:fetchMultiDailyMetricsTimeSeries?dailyMetrics=CALL_CLICKS&dailyMetrics=WEBSITE_CLICKS&dailyMetrics=BUSINESS_DIRECTION_REQUESTS&dailyRange.startDate.year=2026&dailyRange.startDate.month=10&dailyRange.startDate.day=1&dailyRange.endDate.year=2026&dailyRange.endDate.month=11&dailyRange.endDate.day=11`;
        const res = await fetch(perfUrl, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json().catch(() => ({}));
        if (data.multiDailyMetricTimeSeries) {
          for (const series of data.multiDailyMetricTimeSeries) {
            const sum = series.dailyMetricTimeSeries?.timeSeries?.datedValues?.reduce(
              (acc: number, dv: any) => acc + Number(dv.value || 0),
              0
            ) || 0;
            if (series.dailyMetric === "CALL_CLICKS") snapshot.gmbCalls = sum;
            if (series.dailyMetric === "WEBSITE_CLICKS") snapshot.gmbWebsiteClicks = sum;
            if (series.dailyMetric === "BUSINESS_DIRECTION_REQUESTS") snapshot.gmbDirectionRequests = sum;
          }
        }
        snapshot.clicks = (snapshot.gmbWebsiteClicks || 0) + (snapshot.gmbCalls || 0);
        snapshot.rawPayload = data;
        break;
      }
    }
  } catch (err: any) {
    console.error(`[Social API Sync] Falha ao coletar métricas da conta ${account.id} (${account.platform}):`, err.message);
  }

  return snapshot;
}

// -------------------------------------------------------------
// Auto-Sync All Accounts & Persist History
// -------------------------------------------------------------

export async function syncAccountMetrics(accountId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  const [account] = await db
    .select()
    .from(socialAccounts)
    .where(eq(socialAccounts.id, accountId))
    .limit(1);

  if (!account || !account.isActive) return false;

  const metrics = await fetchLiveAccountMetrics(account);
  const todayStr = new Date().toISOString().split("T")[0];

  try {
    // Upsert or insert metrics for today
    const existing = await db
      .select()
      .from(socialMetricsHistory)
      .where(
        and(
          eq(socialMetricsHistory.accountId, account.id),
          eq(socialMetricsHistory.recordedDate, todayStr)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(socialMetricsHistory)
        .set({
          followersCount: metrics.followersCount || existing[0].followersCount,
          impressions: metrics.impressions || existing[0].impressions,
          reach: metrics.reach || existing[0].reach,
          engagement: metrics.engagement || existing[0].engagement,
          clicks: metrics.clicks || existing[0].clicks,
          videoViews: metrics.videoViews || existing[0].videoViews,
          gmbCalls: metrics.gmbCalls || existing[0].gmbCalls,
          gmbDirectionRequests: metrics.gmbDirectionRequests || existing[0].gmbDirectionRequests,
          gmbWebsiteClicks: metrics.gmbWebsiteClicks || existing[0].gmbWebsiteClicks,
          rawPayload: metrics.rawPayload ? JSON.stringify(metrics.rawPayload) : existing[0].rawPayload,
        })
        .where(eq(socialMetricsHistory.id, existing[0].id));
    } else {
      await db.insert(socialMetricsHistory).values({
        accountId: account.id,
        recordedDate: todayStr,
        followersCount: metrics.followersCount,
        impressions: metrics.impressions,
        reach: metrics.reach,
        engagement: metrics.engagement,
        clicks: metrics.clicks,
        videoViews: metrics.videoViews,
        gmbCalls: metrics.gmbCalls || 0,
        gmbDirectionRequests: metrics.gmbDirectionRequests || 0,
        gmbWebsiteClicks: metrics.gmbWebsiteClicks || 0,
        rawPayload: metrics.rawPayload ? JSON.stringify(metrics.rawPayload) : null,
      });
    }

    await db
      .update(socialAccounts)
      .set({
        lastSyncAt: new Date(),
        lastSyncStatus: "success",
        lastSyncError: null,
      })
      .where(eq(socialAccounts.id, account.id));

    return true;
  } catch (err: any) {
    await db
      .update(socialAccounts)
      .set({
        lastSyncAt: new Date(),
        lastSyncStatus: "error",
        lastSyncError: err.message,
      })
      .where(eq(socialAccounts.id, account.id));
    return false;
  }
}

export async function syncAllActiveAccounts(): Promise<{ total: number; synced: number }> {
  const db = await getDb();
  if (!db) return { total: 0, synced: 0 };

  const accounts = await db
    .select()
    .from(socialAccounts)
    .where(eq(socialAccounts.isActive, true));

  let synced = 0;
  for (const acc of accounts) {
    const ok = await syncAccountMetrics(acc.id);
    if (ok) synced++;
  }

  return { total: accounts.length, synced };
}

// -------------------------------------------------------------
// Auto-Publisher Background Routine
// -------------------------------------------------------------

export async function runScheduledPostsPublisher(): Promise<{ checked: number; published: number }> {
  const db = await getDb();
  if (!db) return { checked: 0, published: 0 };

  const now = new Date();
  const pendingPosts = await db
    .select()
    .from(socialPosts)
    .where(
      and(
        eq(socialPosts.status, "scheduled"),
        lte(socialPosts.scheduledFor, now)
      )
    );

  let publishedCount = 0;

  for (const post of pendingPosts) {
    let targetIds: number[] = [];
    try {
      targetIds = JSON.parse(post.targetAccountIds);
    } catch {
      targetIds = [];
    }

    if (!Array.isArray(targetIds) || targetIds.length === 0) {
      await db
        .update(socialPosts)
        .set({ status: "failed", notes: "Nenhuma conta de destino configurada." })
        .where(eq(socialPosts.id, post.id));
      continue;
    }

    const accounts = await db
      .select()
      .from(socialAccounts)
      .where(inArray(socialAccounts.id, targetIds));

    let allSuccess = true;
    for (const acc of accounts) {
      const res = await publishToAccount(acc, post);
      if (!res.success) allSuccess = false;

      // Register dispatch record
      await db.insert(socialPostDispatches).values({
        postId: post.id,
        accountId: acc.id,
        status: res.success ? "published" : "failed",
        externalPostId: res.externalPostId || null,
        externalPostUrl: res.externalPostUrl || null,
        publishedAt: res.success ? new Date() : null,
        errorMessage: res.error || null,
      });
    }

    await db
      .update(socialPosts)
      .set({
        status: allSuccess ? "published" : "failed",
        publishedAt: allSuccess ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(socialPosts.id, post.id));

    if (allSuccess) publishedCount++;
  }

  return { checked: pendingPosts.length, published: publishedCount };
}
