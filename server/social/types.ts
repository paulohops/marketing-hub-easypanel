export type SocialPlatform =
  | "instagram"
  | "facebook"
  | "linkedin"
  | "tiktok"
  | "google_business";

export type SocialPostStatus =
  | "draft"
  | "scheduled"
  | "publishing"
  | "published"
  | "failed"
  | "cancelled";

export type SocialPostType =
  | "feed"
  | "reel"
  | "story"
  | "carousel"
  | "article"
  | "gmb_update"
  | "gmb_offer";

export interface SocialApiConfig {
  metaAppId?: string;
  metaAppSecret?: string;
  metaRedirectUri?: string;

  linkedinClientId?: string;
  linkedinClientSecret?: string;
  linkedinRedirectUri?: string;

  tiktokClientKey?: string;
  tiktokClientSecret?: string;
  tiktokRedirectUri?: string;

  googleBusinessClientId?: string;
  googleBusinessClientSecret?: string;
  googleBusinessApiKey?: string;
  googleBusinessRedirectUri?: string;
}

export interface MetricSnapshot {
  followersCount: number;
  impressions: number;
  reach: number;
  engagement: number;
  clicks: number;
  videoViews: number;
  gmbCalls?: number;
  gmbDirectionRequests?: number;
  gmbWebsiteClicks?: number;
  rawPayload?: Record<string, unknown>;
}

export interface PublishResult {
  success: boolean;
  externalPostId?: string;
  externalPostUrl?: string;
  error?: string;
}

export interface ScriptBlock {
  time?: string;
  visual: string;
  audio?: string;
  text?: string;
}

export interface AiGeneratedContent {
  hook: string;
  caption: string;
  firstComment: string;
  suggestedTitle: string;
  script?: ScriptBlock[];
  hashtags: string[];
}
