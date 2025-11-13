import { sql } from "drizzle-orm";
import { pgTable, text, varchar, decimal, integer, timestamp, boolean, pgEnum, serial, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const userRoleEnum = pgEnum("user_role", ["customer", "restaurant_owner", "admin"]);
export const orderStatusEnum = pgEnum("order_status", ["pending", "confirmed", "preparing", "ready", "out_for_delivery", "delivered", "cancelled"]);

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password"),
  provider: text("provider").default("local"),
  providerId: text("provider_id"),
  role: userRoleEnum("role").notNull().default("customer"),
  profileComplete: boolean("profile_complete").default(true),
  emailVerified: boolean("email_verified").default(false),
  fullName: text("full_name"),
  phoneNumber: text("phone_number"),
  deliveryLocationId: text("delivery_location_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const restaurants = pgTable("restaurants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  cuisine: text("cuisine").notNull(),
  imageUrl: text("image_url"),
  rating: decimal("rating", { precision: 2, scale: 1 }).default("0.0"),
  deliveryTime: text("delivery_time"),
  deliveryFee: decimal("delivery_fee", { precision: 10, scale: 2 }).notNull(),
  deliveryLocationId: varchar("delivery_location_id").references(() => deliveryLocations.id),
  isActive: boolean("is_active").default(true),
  ownerId: varchar("owner_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const lunchboxes = pgTable("lunchboxes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  imageUrl: text("image_url"),
  isAvailable: boolean("is_available").default(true),
  dietaryTags: text("dietary_tags").array(),
  availableDays: text("available_days").array().default(sql`'{monday,tuesday,wednesday,thursday,friday}'`),
  weeklyMenu: jsonb("weekly_menu").$type<{
    monday?: string;
    tuesday?: string;
    wednesday?: string;
    thursday?: string;
    friday?: string;
    saturday?: string;
    sunday?: string;
  }>(),
  restaurantId: varchar("restaurant_id").references(() => restaurants.id),
  deliveryBuildingIds: varchar("delivery_building_ids").array(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const orders = pgTable("orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderNumber: serial("order_number").unique(),
  customerId: varchar("customer_id").references(() => users.id),
  restaurantId: varchar("restaurant_id").references(() => restaurants.id),
  status: orderStatusEnum("status").notNull().default("pending"),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
  deliveryFee: decimal("delivery_fee", { precision: 10, scale: 2 }).notNull(),
  serviceFee: decimal("service_fee", { precision: 10, scale: 2 }).notNull(),
  tax: decimal("tax", { precision: 10, scale: 2 }).notNull(),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  deliveryLocation: text("delivery_location").notNull(),
  deliveryBuildingId: varchar("delivery_building_id").references(() => deliveryBuildings.id),
  deliveryDay: text("delivery_day").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const orderItems = pgTable("order_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId: varchar("order_id").references(() => orders.id),
  lunchboxId: varchar("lunchbox_id").references(() => lunchboxes.id),
  quantity: integer("quantity").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
});

export const deliveryLocations = pgTable("delivery_locations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  address: text("address").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const deliveryBuildings = pgTable("delivery_buildings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  address: text("address").notNull(),
  deliveryLocationId: varchar("delivery_location_id").references(() => deliveryLocations.id).notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const emailVerifications = pgTable("email_verifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull(),
  code: text("code").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  verified: boolean("verified").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const passwordResets = pgTable("password_resets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  token: text("token").notNull().unique(),
  code: text("code").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many, one }) => ({
  restaurant: one(restaurants, {
    fields: [users.id],
    references: [restaurants.ownerId],
  }),
  orders: many(orders),
  deliveryLocation: one(deliveryLocations, {
    fields: [users.deliveryLocationId],
    references: [deliveryLocations.id],
  }),
}));

export const restaurantsRelations = relations(restaurants, ({ many, one }) => ({
  owner: one(users, {
    fields: [restaurants.ownerId],
    references: [users.id],
  }),
  deliveryLocation: one(deliveryLocations, {
    fields: [restaurants.deliveryLocationId],
    references: [deliveryLocations.id],
  }),
  lunchboxes: many(lunchboxes),
  orders: many(orders),
}));

export const lunchboxesRelations = relations(lunchboxes, ({ one, many }) => ({
  restaurant: one(restaurants, {
    fields: [lunchboxes.restaurantId],
    references: [restaurants.id],
  }),
  orderItems: many(orderItems),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  customer: one(users, {
    fields: [orders.customerId],
    references: [users.id],
  }),
  restaurant: one(restaurants, {
    fields: [orders.restaurantId],
    references: [restaurants.id],
  }),
  deliveryBuilding: one(deliveryBuildings, {
    fields: [orders.deliveryBuildingId],
    references: [deliveryBuildings.id],
  }),
  items: many(orderItems),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  lunchbox: one(lunchboxes, {
    fields: [orderItems.lunchboxId],
    references: [lunchboxes.id],
  }),
}));

export const deliveryLocationsRelations = relations(deliveryLocations, ({ many }) => ({
  users: many(users),
  deliveryBuildings: many(deliveryBuildings),
}));

export const deliveryBuildingsRelations = relations(deliveryBuildings, ({ one, many }) => ({
  deliveryLocation: one(deliveryLocations, {
    fields: [deliveryBuildings.deliveryLocationId],
    references: [deliveryLocations.id],
  }),
  lunchboxes: many(lunchboxes),
  orders: many(orders),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertRestaurantSchema = createInsertSchema(restaurants).omit({
  id: true,
  createdAt: true,
});

export const insertLunchboxSchema = createInsertSchema(lunchboxes).omit({
  id: true,
  createdAt: true,
});

export const insertOrderSchema = createInsertSchema(orders).omit({
  id: true,
  createdAt: true,
});

export const insertOrderItemSchema = createInsertSchema(orderItems).omit({
  id: true,
});

export const insertDeliveryLocationSchema = createInsertSchema(deliveryLocations).omit({
  id: true,
  createdAt: true,
});

export const insertDeliveryBuildingSchema = createInsertSchema(deliveryBuildings).omit({
  id: true,
  createdAt: true,
});

export const insertEmailVerificationSchema = createInsertSchema(emailVerifications).omit({
  id: true,
  createdAt: true,
});

export const insertPasswordResetSchema = createInsertSchema(passwordResets).omit({
  id: true,
  createdAt: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Restaurant = typeof restaurants.$inferSelect;
export type InsertRestaurant = z.infer<typeof insertRestaurantSchema>;
export type Lunchbox = typeof lunchboxes.$inferSelect;
export type InsertLunchbox = z.infer<typeof insertLunchboxSchema>;
export type Order = typeof orders.$inferSelect;
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type OrderItem = typeof orderItems.$inferSelect;
export type InsertOrderItem = z.infer<typeof insertOrderItemSchema>;
export type DeliveryLocation = typeof deliveryLocations.$inferSelect;
export type InsertDeliveryLocation = z.infer<typeof insertDeliveryLocationSchema>;
export type DeliveryBuilding = typeof deliveryBuildings.$inferSelect;
export type InsertDeliveryBuilding = z.infer<typeof insertDeliveryBuildingSchema>;
export type EmailVerification = typeof emailVerifications.$inferSelect;
export type InsertEmailVerification = z.infer<typeof insertEmailVerificationSchema>;
export type PasswordReset = typeof passwordResets.$inferSelect;
export type InsertPasswordReset = z.infer<typeof insertPasswordResetSchema>;
