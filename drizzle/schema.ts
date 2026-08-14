import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  date,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

export const userRoles = ["user", "team_member", "admin", "regional_manager", "operator", "viewer"] as const;
export const userRoleEnum = pgEnum("user_role", userRoles);
export const movementTypeEnum = pgEnum("stock_movement_type", ["entry", "exit", "adjustment"]);
export const campaignStatusEnum = pgEnum("campaign_status", ["scheduled", "active", "completed", "cancelled"]);
export const operationStatusEnum = pgEnum("operation_status", ["planned", "in_progress", "completed", "cancelled"]);
export const stockCategoryEnum = pgEnum("stock_category", ["brinde_relacionamento", "brinde_vip", "material_suporte"]);
export const tradeOperationTypeEnum = pgEnum("trade_operation_type", ["trade_action", "media", "event"]);
export const tradeOperationStatusEnum = pgEnum("trade_operation_status", ["planned", "approved", "in_progress", "completed", "cancelled"]);
export const budgetTypeEnum = pgEnum("budget_type", ["trade_events", "branding_b2c"]);
export const operationCostStatusEnum = pgEnum("operation_cost_status", ["draft", "pending_approval", "approved", "rejected"]);
export const supplierOfferingKindEnum = pgEnum("supplier_offering_kind", ["service", "media", "action", "event", "other"]);
export const supplierContractStatusEnum = pgEnum("supplier_contract_status", ["draft", "active", "expired", "terminated"]);
export const mediaPointStatusEnum = pgEnum("media_point_status", ["active", "inactive", "maintenance"]);
export const invoiceStatusEnum = pgEnum("invoice_status", ["open", "partially_paid", "paid", "overdue", "cancelled"]);
export const operationTypeEnum = pgEnum("financial_operation_type", ["media_campaign", "action", "event", "trade_operation", "other"]);
export const documentEntityEnum = pgEnum("document_entity_type", ["media_campaign", "action", "event", "trade_operation", "invoice", "stock", "regional_media", "supplier_contract"]);
export const notificationCategoryEnum = pgEnum("notification_category", ["campaign_expiry", "payment_due", "action_pending", "stock_minimum"]);
export const partnershipTypeEnum = pgEnum("partnership_type", ["paid", "barter", "mixed"]);
export const mediaChannelKindEnum = pgEnum("media_channel_kind", ["standard", "external"]);
export const permissionModuleEnum = pgEnum("permission_module", ["dashboard", "settings", "inventory", "finance", "media", "actions", "events", "operations", "documents", "map", "notifications"]);
export const permissionActionEnum = pgEnum("permission_action", ["read", "create", "update", "delete"]);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 32 }),
  avatarStorageKey: varchar("avatarStorageKey", { length: 512 }),
  avatarUrl: text("avatarUrl"),
  loginMethod: varchar("loginMethod", { length: 64 }),
  jobTitle: varchar("jobTitle", { length: 120 }),
  managerUserId: integer("managerUserId").references((): AnyPgColumn => users.id, { onDelete: "set null" }),
  passwordHash: varchar("passwordHash", { length: 255 }),
  passwordUpdatedAt: timestamp("passwordUpdatedAt", { withTimezone: true }),
  isActive: boolean("isActive").default(true).notNull(),
  role: userRoleEnum("role").default("viewer").notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn", { withTimezone: true }).defaultNow().notNull(),
});

export const rolePermissions = pgTable("role_permissions", {
  id: serial("id").primaryKey(),
  role: userRoleEnum("role").notNull(),
  module: permissionModuleEnum("module").notNull(),
  action: permissionActionEnum("action").notNull(),
  allowed: boolean("allowed").default(false).notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
}, table => [uniqueIndex("role_permissions_role_module_action_uq").on(table.role, table.module, table.action)]);

export const userPermissions = pgTable("user_permissions", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  module: permissionModuleEnum("module").notNull(),
  action: permissionActionEnum("action").notNull(),
  allowed: boolean("allowed").notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
}, table => [uniqueIndex("user_permissions_user_module_action_uq").on(table.userId, table.module, table.action)]);

export const userModuleSettings = pgTable("user_module_settings", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  module: permissionModuleEnum("module").notNull(),
  enabled: boolean("enabled").default(true).notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
}, table => [uniqueIndex("user_module_settings_user_module_uq").on(table.userId, table.module)]);

export const providers = pgTable("providers", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 160 }).notNull().unique(),
  legalName: varchar("legalName", { length: 220 }),
  billingCnpj: varchar("billingCnpj", { length: 32 }).unique(),
  contactName: varchar("contactName", { length: 160 }),
  phone: varchar("phone", { length: 32 }),
  email: varchar("email", { length: 320 }),
  address: text("address"),
  logoStorageKey: varchar("logoStorageKey", { length: 512 }),
  logoUrl: text("logoUrl"),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
});

export const appSettings = pgTable("app_settings", {
  key: varchar("key", { length: 120 }).primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
});

export const userTrelloBoards = pgTable("user_trello_boards", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  boardUrl: text("boardUrl").notNull(),
  assignedByUserId: integer("assignedByUserId").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
});

export const regionals = pgTable("regionals", {
  id: serial("id").primaryKey(),
  providerId: integer("providerId").references(() => providers.id, { onDelete: "restrict" }),
  name: varchar("name", { length: 160 }).notNull(),
  code: varchar("code", { length: 32 }).notNull().unique(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
}, table => [uniqueIndex("regionals_provider_name_uq").on(table.providerId, table.name)]);

export const cities = pgTable("cities", {
  id: serial("id").primaryKey(),
  regionalId: integer("regionalId").notNull().references(() => regionals.id, { onDelete: "restrict" }),
  name: varchar("name", { length: 160 }).notNull(),
  state: varchar("state", { length: 2 }).notNull(),
  ibgeCode: varchar("ibgeCode", { length: 16 }),
  address: text("address"),
  zipCode: varchar("zipCode", { length: 16 }),
  latitude: numeric("latitude", { precision: 10, scale: 7 }),
  longitude: numeric("longitude", { precision: 10, scale: 7 }),
  locationNotes: text("locationNotes"),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
}, table => [uniqueIndex("cities_regional_name_state_uq").on(table.regionalId, table.name, table.state)]);

export const userRegionals = pgTable("user_regionals", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  regionalId: integer("regionalId").notNull().references(() => regionals.id, { onDelete: "cascade" }),
}, table => [uniqueIndex("user_regionals_uq").on(table.userId, table.regionalId)]);

export const userCities = pgTable("user_cities", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  cityId: integer("cityId").notNull().references(() => cities.id, { onDelete: "cascade" }),
}, table => [uniqueIndex("user_cities_uq").on(table.userId, table.cityId)]);

export const commercialSupervisors = pgTable("commercial_supervisors", {
  id: serial("id").primaryKey(),
  userId: integer("userId").references(() => users.id, { onDelete: "set null" }),
  name: varchar("name", { length: 160 }).notNull(),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 32 }),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
});

export const stores = pgTable("stores", {
  id: serial("id").primaryKey(),
  cityId: integer("cityId").notNull().references(() => cities.id, { onDelete: "restrict" }),
  name: varchar("name", { length: 160 }).notNull(),
  code: varchar("code", { length: 32 }).notNull().unique(),
  address: text("address"),
  referencePoint: varchar("referencePoint", { length: 240 }),
  zipCode: varchar("zipCode", { length: 16 }),
  phone: varchar("phone", { length: 32 }),
  email: varchar("email", { length: 320 }),
  openingHours: text("openingHours"),
  latitude: numeric("latitude", { precision: 10, scale: 7 }),
  longitude: numeric("longitude", { precision: 10, scale: 7 }),
  photoStorageKey: varchar("photoStorageKey", { length: 512 }),
  photoUrl: text("photoUrl"),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
});

export const commercialSupervisorStores = pgTable("commercial_supervisor_stores", {
  id: serial("id").primaryKey(),
  commercialSupervisorId: integer("commercialSupervisorId").notNull().references(() => commercialSupervisors.id, { onDelete: "cascade" }),
  storeId: integer("storeId").notNull().references(() => stores.id, { onDelete: "restrict" }),
}, table => [uniqueIndex("commercial_supervisor_stores_uq").on(table.commercialSupervisorId, table.storeId)]);

export const actionPoints = pgTable("action_points", {
  id: serial("id").primaryKey(),
  cityId: integer("cityId").notNull().references(() => cities.id, { onDelete: "restrict" }),
  name: varchar("name", { length: 180 }).notNull(),
  address: text("address"),
  latitude: numeric("latitude", { precision: 10, scale: 7 }),
  longitude: numeric("longitude", { precision: 10, scale: 7 }),
  notes: text("notes"),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
}, table => [uniqueIndex("action_points_city_name_uq").on(table.cityId, table.name)]);

export const partners = pgTable("partners", {
  id: serial("id").primaryKey(),
  cityId: integer("cityId").references(() => cities.id, { onDelete: "restrict" }),
  name: varchar("name", { length: 160 }).notNull(),
  legalName: varchar("legalName", { length: 220 }),
  document: varchar("document", { length: 32 }).unique(),
  contactName: varchar("contactName", { length: 160 }),
  phone: varchar("phone", { length: 32 }),
  email: varchar("email", { length: 320 }),
  partnershipType: partnershipTypeEnum("partnershipType"),
  paymentMethod: varchar("paymentMethod", { length: 80 }),
  paymentRecurrence: varchar("paymentRecurrence", { length: 80 }),
  hasContract: boolean("hasContract").default(false).notNull(),
  contractStorageKey: varchar("contractStorageKey", { length: 512 }),
  contractUrl: text("contractUrl"),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
});

export const mediaTypes = pgTable("media_types", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 120 }).notNull().unique(),
  active: boolean("active").default(true).notNull(),
});

export const serviceTypes = pgTable("service_types", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 160 }).notNull().unique(),
  active: boolean("active").default(true).notNull(),
});

export const actionTypes = pgTable("action_types", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 160 }).notNull().unique(),
  active: boolean("active").default(true).notNull(),
});

export const eventTypes = pgTable("event_types", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 160 }).notNull().unique(),
  active: boolean("active").default(true).notNull(),
});

export const financialCategories = pgTable("financial_categories", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 160 }).notNull().unique(),
  description: text("description"),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
});

export const campaignTemplates = pgTable("campaign_templates", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 180 }).notNull().unique(),
  description: text("description"),
  objective: text("objective"),
  defaultStatus: campaignStatusEnum("defaultStatus").default("scheduled").notNull(),
  defaultDurationDays: integer("defaultDurationDays"),
  logoStorageKey: varchar("logoStorageKey", { length: 512 }),
  logoUrl: text("logoUrl"),
  active: boolean("active").default(true).notNull(),
  createdByUserId: integer("createdByUserId").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
});

export const campaignTemplatePromotions = pgTable("campaign_template_promotions", {
  id: serial("id").primaryKey(),
  campaignTemplateId: integer("campaignTemplateId").notNull().references(() => campaignTemplates.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 180 }).notNull(),
  description: text("description"),
  active: boolean("active").default(true).notNull(),
  sortOrder: integer("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
});

export const campaignTemplatePromotionPlans = pgTable("campaign_template_promotion_plans", {
  id: serial("id").primaryKey(),
  campaignTemplatePromotionId: integer("campaignTemplatePromotionId").notNull().references(() => campaignTemplatePromotions.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 160 }).notNull(),
  description: text("description"),
  price: numeric("price", { precision: 14, scale: 2 }).default("0.00").notNull(),
  unit: varchar("unit", { length: 48 }).default("unidade").notNull(),
  active: boolean("active").default(true).notNull(),
  sortOrder: integer("sortOrder").default(0).notNull(),
});

export const suppliers = pgTable("suppliers", {
  id: serial("id").primaryKey(),
  providerId: integer("providerId").references(() => providers.id, { onDelete: "restrict" }),
  cityId: integer("cityId").references(() => cities.id, { onDelete: "restrict" }),
  displayName: varchar("displayName", { length: 180 }).notNull(),
  legalName: varchar("legalName", { length: 220 }),
  document: varchar("document", { length: 32 }).unique(),
  contactName: varchar("contactName", { length: 160 }),
  phone: varchar("phone", { length: 32 }),
  email: varchar("email", { length: 320 }),
  partnershipType: partnershipTypeEnum("partnershipType"),
  paymentMethod: varchar("paymentMethod", { length: 80 }),
  paymentRecurrence: varchar("paymentRecurrence", { length: 80 }),
  pixKey: varchar("pixKey", { length: 220 }),
  paymentDay: integer("paymentDay"),
  hasContract: boolean("hasContract").default(false).notNull(),
  contractStorageKey: varchar("contractStorageKey", { length: 512 }),
  contractUrl: text("contractUrl"),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
});

export const supplierCities = pgTable("supplier_cities", {
  id: serial("id").primaryKey(),
  supplierId: integer("supplierId").notNull().references(() => suppliers.id, { onDelete: "cascade" }),
  cityId: integer("cityId").notNull().references(() => cities.id, { onDelete: "restrict" }),
}, table => [uniqueIndex("supplier_cities_uq").on(table.supplierId, table.cityId)]);

export const supplierMediaTypes = pgTable("supplier_media_types", {
  id: serial("id").primaryKey(),
  supplierId: integer("supplierId").notNull().references(() => suppliers.id, { onDelete: "cascade" }),
  mediaTypeId: integer("mediaTypeId").notNull().references(() => mediaTypes.id, { onDelete: "restrict" }),
}, table => [uniqueIndex("supplier_media_types_uq").on(table.supplierId, table.mediaTypeId)]);

export const supplierServiceTypes = pgTable("supplier_service_types", {
  id: serial("id").primaryKey(),
  supplierId: integer("supplierId").notNull().references(() => suppliers.id, { onDelete: "cascade" }),
  serviceTypeId: integer("serviceTypeId").notNull().references(() => serviceTypes.id, { onDelete: "restrict" }),
}, table => [uniqueIndex("supplier_service_types_uq").on(table.supplierId, table.serviceTypeId)]);

export const supplierOfferings = pgTable("supplier_offerings", {
  id: serial("id").primaryKey(),
  supplierId: integer("supplierId").notNull().references(() => suppliers.id, { onDelete: "cascade" }),
  kind: supplierOfferingKindEnum("kind").notNull(),
  name: varchar("name", { length: 180 }).notNull(),
  unit: varchar("unit", { length: 64 }).default("unidade").notNull(),
  unitPrice: numeric("unitPrice", { precision: 14, scale: 2 }).notNull(),
  notes: text("notes"),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
}, table => [uniqueIndex("supplier_offerings_supplier_kind_name_uq").on(table.supplierId, table.kind, table.name)]);

export const supplierContracts = pgTable("supplier_contracts", {
  id: serial("id").primaryKey(),
  supplierId: integer("supplierId").notNull().references(() => suppliers.id, { onDelete: "restrict" }),
  purchaseOrderCode: varchar("purchaseOrderCode", { length: 96 }),
  contractType: varchar("contractType", { length: 120 }).notNull(),
  contractCode: varchar("contractCode", { length: 120 }),
  billingNames: jsonb("billingNames").$type<string[]>().default([]).notNull(),
  startsOn: date("startsOn").notNull(),
  endsOn: date("endsOn"),
  termMonths: integer("termMonths"),
  recurrence: varchar("recurrence", { length: 80 }).notNull(),
  paymentDay: integer("paymentDay"),
  expectedAmount: numeric("expectedAmount", { precision: 14, scale: 2 }).default("0.00").notNull(),
  paymentMethod: varchar("paymentMethod", { length: 80 }),
  status: supplierContractStatusEnum("status").default("draft").notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
}, table => [uniqueIndex("supplier_contracts_supplier_code_uq").on(table.supplierId, table.contractCode)]);

export const tradeCampaigns = pgTable("trade_campaigns", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 180 }).notNull(),
  objective: text("objective"),
  providerId: integer("providerId").references(() => providers.id, { onDelete: "set null" }),
  regionalId: integer("regionalId").references(() => regionals.id, { onDelete: "set null" }),
  campaignTemplateId: integer("campaignTemplateId").references(() => campaignTemplates.id, { onDelete: "set null" }),
  logoStorageKey: varchar("logoStorageKey", { length: 512 }),
  logoUrl: text("logoUrl"),
  startsAt: timestamp("startsAt", { withTimezone: true }),
  endsAt: timestamp("endsAt", { withTimezone: true }),
  status: campaignStatusEnum("status").default("scheduled").notNull(),
  debriefRating: integer("debriefRating"),
  debriefNotes: text("debriefNotes"),
  debriefResult: text("debriefResult"),
  debriefAt: timestamp("debriefAt", { withTimezone: true }),
  createdByUserId: integer("createdByUserId").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
});

export const campaignCities = pgTable("campaign_cities", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaignId").notNull().references(() => tradeCampaigns.id, { onDelete: "cascade" }),
  cityId: integer("cityId").notNull().references(() => cities.id, { onDelete: "restrict" }),
}, table => [uniqueIndex("campaign_cities_campaign_city_uq").on(table.campaignId, table.cityId)]);

export const campaignPromotions = pgTable("campaign_promotions", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaignId").notNull().references(() => tradeCampaigns.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 180 }).notNull(),
  description: text("description"),
  active: boolean("active").default(true).notNull(),
  sortOrder: integer("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
});

export const campaignPromotionPlans = pgTable("campaign_promotion_plans", {
  id: serial("id").primaryKey(),
  campaignPromotionId: integer("campaignPromotionId").notNull().references(() => campaignPromotions.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 160 }).notNull(),
  description: text("description"),
  price: numeric("price", { precision: 14, scale: 2 }).default("0.00").notNull(),
  unit: varchar("unit", { length: 48 }).default("unidade").notNull(),
  active: boolean("active").default(true).notNull(),
  sortOrder: integer("sortOrder").default(0).notNull(),
});

export const stockItems = pgTable("stock_items", {
  id: serial("id").primaryKey(),
  regionalId: integer("regionalId").notNull().references(() => regionals.id, { onDelete: "restrict" }),
  cityId: integer("cityId").references(() => cities.id, { onDelete: "restrict" }),
  sku: varchar("sku", { length: 64 }).notNull(),
  name: varchar("name", { length: 180 }).notNull(),
  description: text("description"),
  photoStorageKey: varchar("photoStorageKey", { length: 512 }),
  photoUrl: text("photoUrl"),
  unit: varchar("unit", { length: 24 }).default("un").notNull(),
  category: stockCategoryEnum("category").default("material_suporte").notNull(),
  minimumQuantity: numeric("minimumQuantity", { precision: 12, scale: 2 }).default("0.00").notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
}, table => [uniqueIndex("stock_items_territory_sku_uq").on(table.regionalId, table.cityId, table.sku)]);

export const stockMovements = pgTable("stock_movements", {
  id: serial("id").primaryKey(),
  stockItemId: integer("stockItemId").notNull().references(() => stockItems.id, { onDelete: "restrict" }),
  movementType: movementTypeEnum("movementType").notNull(),
  quantity: numeric("quantity", { precision: 12, scale: 2 }).notNull(),
  unitCost: numeric("unitCost", { precision: 14, scale: 2 }),
  occurredAt: timestamp("occurredAt", { withTimezone: true }).notNull(),
  reference: varchar("reference", { length: 120 }),
  notes: text("notes"),
  performedByUserId: integer("performedByUserId").references(() => users.id, { onDelete: "restrict" }),
  responsibleCommercialSupervisorId: integer("responsibleCommercialSupervisorId").references(() => commercialSupervisors.id, { onDelete: "set null" }),
  recipientCommercialSupervisorId: integer("recipientCommercialSupervisorId").references(() => commercialSupervisors.id, { onDelete: "set null" }),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
});

export const stockBalances = pgTable("stock_balances", {
  id: serial("id").primaryKey(),
  stockItemId: integer("stockItemId").notNull().unique().references(() => stockItems.id, { onDelete: "cascade" }),
  quantity: numeric("quantity", { precision: 12, scale: 2 }).default("0.00").notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
});

export const stockTransfers = pgTable("stock_transfers", {
  id: serial("id").primaryKey(),
  sourceStockItemId: integer("sourceStockItemId").notNull().references(() => stockItems.id, { onDelete: "restrict" }),
  destinationStockItemId: integer("destinationStockItemId").notNull().references(() => stockItems.id, { onDelete: "restrict" }),
  quantity: numeric("quantity", { precision: 12, scale: 2 }).notNull(),
  transferredAt: timestamp("transferredAt", { withTimezone: true }).notNull(),
  notes: text("notes"),
  performedByUserId: integer("performedByUserId").references(() => users.id, { onDelete: "restrict" }),
  responsibleCommercialSupervisorId: integer("responsibleCommercialSupervisorId").references(() => commercialSupervisors.id, { onDelete: "set null" }),
  recipientCommercialSupervisorId: integer("recipientCommercialSupervisorId").references(() => commercialSupervisors.id, { onDelete: "set null" }),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
});

export const tradeOperations = pgTable("trade_operations", {
  id: serial("id").primaryKey(),
  operationType: tradeOperationTypeEnum("operationType").notNull(),
  actionTypeId: integer("actionTypeId").references(() => actionTypes.id, { onDelete: "restrict" }),
  mediaTypeId: integer("mediaTypeId").references(() => mediaTypes.id, { onDelete: "restrict" }),
  eventTypeId: integer("eventTypeId").references(() => eventTypes.id, { onDelete: "restrict" }),
  name: varchar("name", { length: 180 }).notNull(),
  cityId: integer("cityId").notNull().references(() => cities.id, { onDelete: "restrict" }),
  supplierId: integer("supplierId").references(() => suppliers.id, { onDelete: "restrict" }),
  startsAt: timestamp("startsAt", { withTimezone: true }).notNull(),
  endsAt: timestamp("endsAt", { withTimezone: true }),
  status: tradeOperationStatusEnum("status").default("planned").notNull(),
  requiresPermit: boolean("requiresPermit").default(false).notNull(),
  permitStorageKey: varchar("permitStorageKey", { length: 512 }),
  permitUrl: text("permitUrl"),
  postActionFeedback: text("postActionFeedback"),
  createdByUserId: integer("createdByUserId").references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
}, table => [uniqueIndex("trade_operations_city_name_starts_uq").on(table.cityId, table.name, table.startsAt)]);

export const monthlyBudgets = pgTable("monthly_budgets", {
  id: serial("id").primaryKey(),
  competenceMonth: date("competenceMonth").notNull(),
  budgetType: budgetTypeEnum("budgetType").notNull(),
  totalAmount: numeric("totalAmount", { precision: 14, scale: 2 }).notNull(),
  notes: text("notes"),
  createdByUserId: integer("createdByUserId").references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
}, table => [uniqueIndex("monthly_budgets_month_type_uq").on(table.competenceMonth, table.budgetType)]);

export const operationCosts = pgTable("operation_costs", {
  id: serial("id").primaryKey(),
  operationType: operationTypeEnum("operationType").default("trade_operation").notNull(),
  operationId: integer("operationId").notNull(),
  budgetType: budgetTypeEnum("budgetType").notNull(),
  investmentBase: numeric("investmentBase", { precision: 14, scale: 2 }).default("0.00").notNull(),
  permitCost: numeric("permitCost", { precision: 14, scale: 2 }).default("0.00").notNull(),
  storeCost: numeric("storeCost", { precision: 14, scale: 2 }).default("0.00").notNull(),
  otherCosts: numeric("otherCosts", { precision: 14, scale: 2 }).default("0.00").notNull(),
  status: operationCostStatusEnum("status").default("draft").notNull(),
  notes: text("notes"),
  approvedByUserId: integer("approvedByUserId").references(() => users.id, { onDelete: "restrict" }),
  approvedAt: timestamp("approvedAt", { withTimezone: true }),
  createdByUserId: integer("createdByUserId").references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
}, table => [uniqueIndex("operation_costs_type_operation_uq").on(table.operationType, table.operationId)]);

export const mediaPoints = pgTable("media_points", {
  id: serial("id").primaryKey(),
  supplierId: integer("supplierId").notNull().references(() => suppliers.id, { onDelete: "restrict" }),
  cityId: integer("cityId").notNull().references(() => cities.id, { onDelete: "restrict" }),
  mediaTypeId: integer("mediaTypeId").notNull().references(() => mediaTypes.id, { onDelete: "restrict" }),
  serviceTypeId: integer("serviceTypeId").references(() => serviceTypes.id, { onDelete: "restrict" }),
  name: varchar("name", { length: 180 }).notNull(),
  channelKind: mediaChannelKindEnum("channelKind").default("standard").notNull(),
  address: text("address"),
  latitude: numeric("latitude", { precision: 10, scale: 7 }),
  longitude: numeric("longitude", { precision: 10, scale: 7 }),
  status: mediaPointStatusEnum("status").default("active").notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
});

export const mediaCampaigns = pgTable("media_campaigns", {
  id: serial("id").primaryKey(),
  tradeCampaignId: integer("tradeCampaignId").references(() => tradeCampaigns.id, { onDelete: "set null" }),
  mediaPointId: integer("mediaPointId").notNull().references(() => mediaPoints.id, { onDelete: "restrict" }),
  name: varchar("name", { length: 180 }).notNull(),
  status: campaignStatusEnum("status").default("active").notNull(),
  partnershipType: partnershipTypeEnum("partnershipType").default("paid").notNull(),
  startsOn: date("startsOn").notNull(),
  endsOn: date("endsOn").notNull(),
  estimatedCost: numeric("estimatedCost", { precision: 14, scale: 2 }).default("0.00").notNull(),
  notes: text("notes"),
  campaignDetails: text("campaignDetails"),
  campaignConfig: jsonb("campaignConfig").$type<{
    dailyRate?: number;
    circulationDays?: number;
    dailyRoute?: string;
    audioBrief?: string;
    materialFormat?: string;
    materialQuantity?: number;
    deadlineDays?: number;
    deliveryInstructions?: string;
  }>().default({}).notNull(),
  rescheduleReason: text("rescheduleReason"),
  rescheduledFromCampaignId: integer("rescheduledFromCampaignId").references((): AnyPgColumn => mediaCampaigns.id, { onDelete: "set null" }),
  rating: integer("rating"),
  resultAchieved: boolean("resultAchieved"),
  feedback: text("feedback"),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
}, table => [
  uniqueIndex("media_campaigns_one_active_per_point_uq")
    .on(table.mediaPointId)
    .where(sql`"status" = 'active'`),
	]);

export const mediaCampaignCityDistributions = pgTable("media_campaign_city_distributions", {
  id: serial("id").primaryKey(),
  mediaCampaignId: integer("mediaCampaignId").notNull().references(() => mediaCampaigns.id, { onDelete: "cascade" }),
  cityId: integer("cityId").notNull().references(() => cities.id, { onDelete: "restrict" }),
  quantity: integer("quantity").notNull(),
  notes: text("notes"),
}, table => [uniqueIndex("media_campaign_city_distributions_uq").on(table.mediaCampaignId, table.cityId)]);

export const actions = pgTable("actions", {
  id: serial("id").primaryKey(),
  tradeCampaignId: integer("tradeCampaignId").references(() => tradeCampaigns.id, { onDelete: "set null" }),
  eventId: integer("eventId").references(() => events.id, { onDelete: "set null" }),
  cityId: integer("cityId").notNull().references(() => cities.id, { onDelete: "restrict" }),
  actionTypeId: integer("actionTypeId").notNull().references(() => actionTypes.id, { onDelete: "restrict" }),
  name: varchar("name", { length: 180 }).notNull(),
  address: text("address"),
  actionPointId: integer("actionPointId").references(() => actionPoints.id, { onDelete: "set null" }),
  latitude: numeric("latitude", { precision: 10, scale: 7 }),
  longitude: numeric("longitude", { precision: 10, scale: 7 }),
  scheduledFor: timestamp("scheduledFor", { withTimezone: true }).notNull(),
  endsAt: timestamp("endsAt", { withTimezone: true }),
  objective: text("objective").notNull(),
  commercialSupervisorId: integer("commercialSupervisorId").references(() => commercialSupervisors.id, { onDelete: "set null" }),
  partnershipType: partnershipTypeEnum("partnershipType").default("paid").notNull(),
  estimatedCost: numeric("estimatedCost", { precision: 14, scale: 2 }).default("0.00").notNull(),
  status: operationStatusEnum("status").default("planned").notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
});

export const actionSuppliers = pgTable("action_suppliers", {
  id: serial("id").primaryKey(),
  actionId: integer("actionId").notNull().references(() => actions.id, { onDelete: "cascade" }),
  supplierId: integer("supplierId").notNull().references(() => suppliers.id, { onDelete: "restrict" }),
}, table => [uniqueIndex("action_suppliers_uq").on(table.actionId, table.supplierId)]);

export const actionServices = pgTable("action_services", {
  id: serial("id").primaryKey(),
  actionId: integer("actionId").notNull().references(() => actions.id, { onDelete: "cascade" }),
  serviceTypeId: integer("serviceTypeId").notNull().references(() => serviceTypes.id, { onDelete: "restrict" }),
  estimatedAmount: numeric("estimatedAmount", { precision: 14, scale: 2 }).default("0.00").notNull(),
}, table => [uniqueIndex("action_services_uq").on(table.actionId, table.serviceTypeId)]);

export const actionTeamMembers = pgTable("action_team_members", {
  id: serial("id").primaryKey(),
  actionId: integer("actionId").notNull().references(() => actions.id, { onDelete: "cascade" }),
  userId: integer("userId").notNull().references(() => users.id, { onDelete: "restrict" }),
}, table => [uniqueIndex("action_team_members_uq").on(table.actionId, table.userId)]);

export const actionStockItems = pgTable("action_stock_items", {
  id: serial("id").primaryKey(),
  actionId: integer("actionId").notNull().references(() => actions.id, { onDelete: "cascade" }),
  stockItemId: integer("stockItemId").notNull().references(() => stockItems.id, { onDelete: "restrict" }),
  plannedQuantity: numeric("plannedQuantity", { precision: 12, scale: 2 }).notNull(),
}, table => [uniqueIndex("action_stock_items_uq").on(table.actionId, table.stockItemId)]);

export const actionDebriefs = pgTable("action_debriefs", {
  id: serial("id").primaryKey(),
  actionId: integer("actionId").notNull().unique().references(() => actions.id, { onDelete: "cascade" }),
  rating: integer("rating").notNull(),
  notes: text("notes"),
  positives: text("positives"),
  negatives: text("negatives"),
  resultAchieved: boolean("resultAchieved"),
  resultSummary: text("resultSummary"),
  leadCount: integer("leadCount").default(0).notNull(),
  saleCount: integer("saleCount").default(0).notNull(),
  renewalCount: integer("renewalCount").default(0).notNull(),
  worthRepeating: boolean("worthRepeating"),
  completedAt: timestamp("completedAt", { withTimezone: true }).notNull(),
});

export const events = pgTable("events", {
  id: serial("id").primaryKey(),
  tradeCampaignId: integer("tradeCampaignId").references(() => tradeCampaigns.id, { onDelete: "set null" }),
  cityId: integer("cityId").notNull().references(() => cities.id, { onDelete: "restrict" }),
  eventTypeId: integer("eventTypeId").notNull().references(() => eventTypes.id, { onDelete: "restrict" }),
  name: varchar("name", { length: 180 }).notNull(),
  address: text("address"),
  latitude: numeric("latitude", { precision: 10, scale: 7 }),
  longitude: numeric("longitude", { precision: 10, scale: 7 }),
  startsAt: timestamp("startsAt", { withTimezone: true }).notNull(),
  endsAt: timestamp("endsAt", { withTimezone: true }),
  commercialSupervisorId: integer("commercialSupervisorId").references(() => commercialSupervisors.id, { onDelete: "set null" }),
  partnershipType: partnershipTypeEnum("partnershipType").default("paid").notNull(),
  estimatedCost: numeric("estimatedCost", { precision: 14, scale: 2 }).default("0.00").notNull(),
  partnershipReason: text("partnershipReason"),
  worthRenewing: boolean("worthRenewing"),
  status: operationStatusEnum("status").default("planned").notNull(),
  preEventNotes: text("preEventNotes"),
  postEventNotes: text("postEventNotes"),
  rating: integer("rating"),
  resultAchieved: boolean("resultAchieved"),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
});

export const eventSuppliers = pgTable("event_suppliers", {
  id: serial("id").primaryKey(),
  eventId: integer("eventId").notNull().references(() => events.id, { onDelete: "cascade" }),
  supplierId: integer("supplierId").notNull().references(() => suppliers.id, { onDelete: "restrict" }),
}, table => [uniqueIndex("event_suppliers_uq").on(table.eventId, table.supplierId)]);

export const eventServices = pgTable("event_services", {
  id: serial("id").primaryKey(),
  eventId: integer("eventId").notNull().references(() => events.id, { onDelete: "cascade" }),
  serviceTypeId: integer("serviceTypeId").notNull().references(() => serviceTypes.id, { onDelete: "restrict" }),
}, table => [uniqueIndex("event_services_uq").on(table.eventId, table.serviceTypeId)]);

export const eventTeamMembers = pgTable("event_team_members", {
  id: serial("id").primaryKey(),
  eventId: integer("eventId").notNull().references(() => events.id, { onDelete: "cascade" }),
  userId: integer("userId").notNull().references(() => users.id, { onDelete: "restrict" }),
}, table => [uniqueIndex("event_team_members_uq").on(table.eventId, table.userId)]);

export const eventStockItems = pgTable("event_stock_items", {
  id: serial("id").primaryKey(),
  eventId: integer("eventId").notNull().references(() => events.id, { onDelete: "cascade" }),
  stockItemId: integer("stockItemId").notNull().references(() => stockItems.id, { onDelete: "restrict" }),
  plannedQuantity: numeric("plannedQuantity", { precision: 12, scale: 2 }).notNull(),
}, table => [uniqueIndex("event_stock_items_uq").on(table.eventId, table.stockItemId)]);

export const invoices = pgTable("invoices", {
  id: serial("id").primaryKey(),
  supplierId: integer("supplierId").notNull().references(() => suppliers.id, { onDelete: "restrict" }),
  supplierContractId: integer("supplierContractId").references(() => supplierContracts.id, { onDelete: "restrict" }),
  invoiceNumber: varchar("invoiceNumber", { length: 80 }).notNull(),
  issueDate: date("issueDate").notNull(),
  dueDate: date("dueDate").notNull(),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  status: invoiceStatusEnum("status").default("open").notNull(),
  operationType: operationTypeEnum("operationType"),
  operationId: integer("operationId"),
  notes: text("notes"),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
}, table => [uniqueIndex("invoices_supplier_number_uq").on(table.supplierId, table.invoiceNumber)]);

export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  invoiceId: integer("invoiceId").notNull().references(() => invoices.id, { onDelete: "restrict" }),
  paidAt: timestamp("paidAt", { withTimezone: true }).notNull(),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  method: varchar("method", { length: 80 }).notNull(),
  reference: varchar("reference", { length: 140 }),
  notes: text("notes"),
  performedByUserId: integer("performedByUserId").references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
});

export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  regionalId: integer("regionalId").references(() => regionals.id, { onDelete: "restrict" }),
  entityType: documentEntityEnum("entityType").notNull(),
  entityId: integer("entityId").notNull(),
  storageKey: varchar("storageKey", { length: 512 }).notNull().unique(),
  url: text("url").notNull(),
  originalName: varchar("originalName", { length: 255 }).notNull(),
  mimeType: varchar("mimeType", { length: 120 }).notNull(),
  sizeBytes: integer("sizeBytes").notNull(),
  uploadedByUserId: integer("uploadedByUserId").references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
});

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("userId").references(() => users.id, { onDelete: "cascade" }),
  regionalId: integer("regionalId").references(() => regionals.id, { onDelete: "cascade" }),
  cityId: integer("cityId").references(() => cities.id, { onDelete: "cascade" }),
  category: notificationCategoryEnum("category").notNull(),
  title: varchar("title", { length: 180 }).notNull(),
  message: text("message").notNull(),
  entityType: varchar("entityType", { length: 64 }),
  entityId: integer("entityId"),
  readAt: timestamp("readAt", { withTimezone: true }),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
});

export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  actorUserId: integer("actorUserId").references(() => users.id, { onDelete: "set null" }),
  regionalId: integer("regionalId").references(() => regionals.id, { onDelete: "set null" }),
  entityType: varchar("entityType", { length: 64 }).notNull(),
  entityId: integer("entityId").notNull(),
  action: varchar("action", { length: 64 }).notNull(),
  beforeData: text("beforeData"),
  afterData: text("afterData"),
  occurredAt: timestamp("occurredAt", { withTimezone: true }).notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
