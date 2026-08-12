import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  integer,
  numeric,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

export const userRoles = ["user", "admin", "regional_manager", "operator", "viewer"] as const;
export const userRoleEnum = pgEnum("user_role", userRoles);
export const movementTypeEnum = pgEnum("stock_movement_type", ["entry", "exit", "adjustment"]);
export const campaignStatusEnum = pgEnum("campaign_status", ["active", "completed", "cancelled"]);
export const operationStatusEnum = pgEnum("operation_status", ["planned", "in_progress", "completed", "cancelled"]);
export const stockCategoryEnum = pgEnum("stock_category", ["brinde_relacionamento", "brinde_vip", "material_suporte"]);
export const tradeOperationTypeEnum = pgEnum("trade_operation_type", ["trade_action", "media", "event"]);
export const tradeOperationStatusEnum = pgEnum("trade_operation_status", ["planned", "approved", "in_progress", "completed", "cancelled"]);
export const budgetTypeEnum = pgEnum("budget_type", ["trade_events", "branding_b2c"]);
export const operationCostStatusEnum = pgEnum("operation_cost_status", ["draft", "pending_approval", "approved", "rejected"]);
export const mediaPointStatusEnum = pgEnum("media_point_status", ["active", "inactive", "maintenance"]);
export const invoiceStatusEnum = pgEnum("invoice_status", ["open", "partially_paid", "paid", "overdue", "cancelled"]);
export const operationTypeEnum = pgEnum("financial_operation_type", ["media_campaign", "action", "event", "trade_operation", "other"]);
export const documentEntityEnum = pgEnum("document_entity_type", ["media_campaign", "action", "event", "trade_operation", "invoice", "stock", "regional_media"]);
export const notificationCategoryEnum = pgEnum("notification_category", ["campaign_expiry", "payment_due", "action_pending", "stock_minimum"]);
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

export const providers = pgTable("providers", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 160 }).notNull().unique(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
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
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
}, table => [uniqueIndex("cities_regional_name_state_uq").on(table.regionalId, table.name, table.state)]);

export const userRegionals = pgTable("user_regionals", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  regionalId: integer("regionalId").notNull().references(() => regionals.id, { onDelete: "cascade" }),
}, table => [uniqueIndex("user_regionals_uq").on(table.userId, table.regionalId)]);

export const stores = pgTable("stores", {
  id: serial("id").primaryKey(),
  cityId: integer("cityId").notNull().references(() => cities.id, { onDelete: "restrict" }),
  name: varchar("name", { length: 160 }).notNull(),
  code: varchar("code", { length: 32 }).notNull().unique(),
  address: text("address"),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
});

export const partners = pgTable("partners", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  legalName: varchar("legalName", { length: 220 }),
  document: varchar("document", { length: 32 }).unique(),
  contactName: varchar("contactName", { length: 160 }),
  phone: varchar("phone", { length: 32 }),
  email: varchar("email", { length: 320 }),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
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

export const suppliers = pgTable("suppliers", {
  id: serial("id").primaryKey(),
  providerId: integer("providerId").references(() => providers.id, { onDelete: "restrict" }),
  displayName: varchar("displayName", { length: 180 }).notNull(),
  legalName: varchar("legalName", { length: 220 }),
  document: varchar("document", { length: 32 }).unique(),
  contactName: varchar("contactName", { length: 160 }),
  phone: varchar("phone", { length: 32 }),
  email: varchar("email", { length: 320 }),
  paymentMethod: varchar("paymentMethod", { length: 80 }),
  pixKey: varchar("pixKey", { length: 220 }),
  paymentDay: integer("paymentDay"),
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

export const stockItems = pgTable("stock_items", {
  id: serial("id").primaryKey(),
  regionalId: integer("regionalId").notNull().references(() => regionals.id, { onDelete: "restrict" }),
  cityId: integer("cityId").references(() => cities.id, { onDelete: "restrict" }),
  sku: varchar("sku", { length: 64 }).notNull(),
  name: varchar("name", { length: 180 }).notNull(),
  description: text("description"),
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
  operationId: integer("operationId").notNull().unique().references(() => tradeOperations.id, { onDelete: "cascade" }),
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
});

export const mediaPoints = pgTable("media_points", {
  id: serial("id").primaryKey(),
  supplierId: integer("supplierId").notNull().references(() => suppliers.id, { onDelete: "restrict" }),
  cityId: integer("cityId").notNull().references(() => cities.id, { onDelete: "restrict" }),
  mediaTypeId: integer("mediaTypeId").notNull().references(() => mediaTypes.id, { onDelete: "restrict" }),
  serviceTypeId: integer("serviceTypeId").references(() => serviceTypes.id, { onDelete: "restrict" }),
  name: varchar("name", { length: 180 }).notNull(),
  address: text("address"),
  latitude: numeric("latitude", { precision: 10, scale: 7 }),
  longitude: numeric("longitude", { precision: 10, scale: 7 }),
  status: mediaPointStatusEnum("status").default("active").notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
});

export const mediaCampaigns = pgTable("media_campaigns", {
  id: serial("id").primaryKey(),
  mediaPointId: integer("mediaPointId").notNull().references(() => mediaPoints.id, { onDelete: "restrict" }),
  name: varchar("name", { length: 180 }).notNull(),
  status: campaignStatusEnum("status").default("active").notNull(),
  startsOn: date("startsOn").notNull(),
  endsOn: date("endsOn").notNull(),
  notes: text("notes"),
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

export const actions = pgTable("actions", {
  id: serial("id").primaryKey(),
  cityId: integer("cityId").notNull().references(() => cities.id, { onDelete: "restrict" }),
  actionTypeId: integer("actionTypeId").notNull().references(() => actionTypes.id, { onDelete: "restrict" }),
  name: varchar("name", { length: 180 }).notNull(),
  address: text("address"),
  latitude: numeric("latitude", { precision: 10, scale: 7 }),
  longitude: numeric("longitude", { precision: 10, scale: 7 }),
  scheduledFor: timestamp("scheduledFor", { withTimezone: true }).notNull(),
  objective: text("objective").notNull(),
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
}, table => [uniqueIndex("action_services_uq").on(table.actionId, table.serviceTypeId)]);

export const actionDebriefs = pgTable("action_debriefs", {
  id: serial("id").primaryKey(),
  actionId: integer("actionId").notNull().unique().references(() => actions.id, { onDelete: "cascade" }),
  rating: integer("rating").notNull(),
  notes: text("notes"),
  positives: text("positives"),
  negatives: text("negatives"),
  resultAchieved: boolean("resultAchieved"),
  completedAt: timestamp("completedAt", { withTimezone: true }).notNull(),
});

export const events = pgTable("events", {
  id: serial("id").primaryKey(),
  cityId: integer("cityId").notNull().references(() => cities.id, { onDelete: "restrict" }),
  eventTypeId: integer("eventTypeId").notNull().references(() => eventTypes.id, { onDelete: "restrict" }),
  name: varchar("name", { length: 180 }).notNull(),
  address: text("address"),
  latitude: numeric("latitude", { precision: 10, scale: 7 }),
  longitude: numeric("longitude", { precision: 10, scale: 7 }),
  startsAt: timestamp("startsAt", { withTimezone: true }).notNull(),
  endsAt: timestamp("endsAt", { withTimezone: true }),
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

export const invoices = pgTable("invoices", {
  id: serial("id").primaryKey(),
  supplierId: integer("supplierId").notNull().references(() => suppliers.id, { onDelete: "restrict" }),
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
