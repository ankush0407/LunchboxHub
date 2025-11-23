import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { insertRestaurantSchema, insertLunchboxSchema, insertOrderSchema, insertOrderItemSchema, Order, insertDeliveryLocationSchema, DeliveryLocation, insertDeliveryBuildingSchema, DeliveryBuilding } from "@shared/schema";
import { ObjectStorageService } from "./objectStorage";
import Stripe from "stripe";
import { emailService, generateVerificationCode, generateResetToken } from "./emailService";
import { z } from "zod";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";

declare module 'express-session' {
  interface SessionData {
    pendingRegistration?: {
      username: string;
      email: string;
      password: string;
      role: string;
    };
  }
}

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing required Stripe secret: STRIPE_SECRET_KEY');
}
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const scryptAsync = promisify(scrypt);

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication routes
  setupAuth(app);

  // Email verification routes
  app.post("/api/auth/send-verification-code", async (req, res) => {
    try {
      const { email } = z.object({ email: z.string().email() }).parse(req.body);

      const code = generateVerificationCode();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

      await storage.createEmailVerification({
        email,
        code,
        expiresAt,
        verified: false,
      });

      await emailService.sendVerificationCode(email, code);

      res.json({ message: "Verification code sent to your email" });
    } catch (error: any) {
      console.error("Error sending verification code:", error);
      res.status(400).json({ message: error.message || "Failed to send verification code" });
    }
  });

  app.post("/api/auth/verify-email", async (req, res) => {
    try {
      const { email, code } = z.object({
        email: z.string().email(),
        code: z.string().length(6),
      }).parse(req.body);

      const verification = await storage.getLatestEmailVerification(email);

      if (!verification) {
        return res.status(400).json({ message: "No verification code found for this email" });
      }

      if (verification.verified) {
        return res.status(400).json({ message: "This code has already been used" });
      }

      if (new Date() > new Date(verification.expiresAt)) {
        return res.status(400).json({ message: "Verification code has expired" });
      }

      if (verification.code !== code) {
        return res.status(400).json({ message: "Invalid verification code" });
      }

      await storage.markEmailVerified(verification.id);

      const pendingRegistration = req.session.pendingRegistration;
      if (pendingRegistration && pendingRegistration.email === email) {
        const user = await storage.createUser({
          username: pendingRegistration.username,
          email: pendingRegistration.email,
          password: pendingRegistration.password,
          role: pendingRegistration.role as "customer" | "restaurant_owner" | "admin",
          emailVerified: true,
        });

        delete req.session.pendingRegistration;

        return res.json({ message: "Email verified and account created successfully", verified: true });
      }

      const user = await storage.getUserByEmail(email);
      if (user) {
        await storage.updateUserEmailVerified(user.id, true);
      }

      res.json({ message: "Email verified successfully", verified: true });
    } catch (error: any) {
      console.error("Error verifying email:", error);
      res.status(400).json({ message: error.message || "Failed to verify email" });
    }
  });

  // Password reset routes
  app.post("/api/auth/request-password-reset", async (req, res) => {
    try {
      const { email } = z.object({ email: z.string().email() }).parse(req.body);

      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.json({ message: "If a user with that email exists, a password reset code has been sent" });
      }

      if (user.provider !== 'local') {
        return res.status(400).json({ message: "Password reset is only available for local accounts" });
      }

      const code = generateVerificationCode();
      const token = generateResetToken();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

      await storage.createPasswordReset({
        userId: user.id,
        token,
        code,
        expiresAt,
        used: false,
      });

      await emailService.sendPasswordResetCode(email, code, user.username);

      res.json({ message: "If a user with that email exists, a password reset code has been sent" });
    } catch (error: any) {
      console.error("Error requesting password reset:", error);
      res.status(400).json({ message: error.message || "Failed to process password reset request" });
    }
  });

  app.post("/api/auth/verify-reset-code", async (req, res) => {
    try {
      const { email, code } = z.object({
        email: z.string().email(),
        code: z.string().length(6),
      }).parse(req.body);

      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(400).json({ message: "Invalid code" });
      }

      const reset = await storage.getLatestPasswordReset(user.id);

      if (!reset) {
        return res.status(400).json({ message: "No reset request found" });
      }

      if (reset.used) {
        return res.status(400).json({ message: "This code has already been used" });
      }

      if (new Date() > new Date(reset.expiresAt)) {
        return res.status(400).json({ message: "Reset code has expired" });
      }

      if (reset.code !== code) {
        return res.status(400).json({ message: "Invalid code" });
      }

      res.json({ message: "Code verified", token: reset.token });
    } catch (error: any) {
      console.error("Error verifying reset code:", error);
      res.status(400).json({ message: error.message || "Failed to verify code" });
    }
  });

  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { token, newPassword } = z.object({
        token: z.string(),
        newPassword: z.string().min(6),
      }).parse(req.body);

      const reset = await storage.getPasswordResetByToken(token);

      if (!reset) {
        return res.status(400).json({ message: "Invalid or expired reset token" });
      }

      if (reset.used) {
        return res.status(400).json({ message: "This reset token has already been used" });
      }

      if (new Date() > new Date(reset.expiresAt)) {
        return res.status(400).json({ message: "Reset token has expired" });
      }

      const salt = randomBytes(16).toString("hex");
      const buf = (await scryptAsync(newPassword, salt, 64)) as Buffer;
      const hashedPassword = `${buf.toString("hex")}.${salt}`;

      await storage.updateUserPassword(reset.userId, hashedPassword);
      await storage.markPasswordResetUsed(reset.id);

      res.json({ message: "Password reset successfully" });
    } catch (error: any) {
      console.error("Error resetting password:", error);
      res.status(400).json({ message: error.message || "Failed to reset password" });
    }
  });

  // Object storage routes
  app.post("/api/objects/upload", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.sendStatus(401);
    }

    try {
      const objectStorageService = new ObjectStorageService();
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      res.json({ uploadURL });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to get upload URL" });
    }
  });

  // Public upload endpoint for restaurant logos and menu images
  app.post("/api/objects/upload-public", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.sendStatus(401);
    }

    try {
      const objectStorageService = new ObjectStorageService();
      const uploadURL = await objectStorageService.getPublicUploadURL();
      res.json({ uploadURL });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to get public upload URL" });
    }
  });

  // Serve public objects
  app.get("/public-objects/:filePath(*)", async (req, res) => {
    const filePath = req.params.filePath;
    const objectStorageService = new ObjectStorageService();
    try {
      const file = await objectStorageService.searchPublicObject(filePath);
      if (!file) {
        return res.status(404).json({ error: "File not found" });
      }
      objectStorageService.downloadObject(file, res);
    } catch (error) {
      console.error("Error searching for public object:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Restaurant routes
  app.get("/api/restaurants", async (req, res) => {
    try {
      const restaurants = await storage.getRestaurants();
      res.json(restaurants);
    } catch (error: any) {
      res.status(500).json({ message: "Error fetching restaurants: " + error.message });
    }
  });

  app.get("/api/restaurants/:id", async (req, res) => {
    try {
      const restaurant = await storage.getRestaurant(req.params.id);
      if (!restaurant) {
        return res.status(404).json({ message: "Restaurant not found" });
      }
      res.json(restaurant);
    } catch (error: any) {
      res.status(500).json({ message: "Error fetching restaurant: " + error.message });
    }
  });

  // Get restaurant by owner
  app.get("/api/restaurants/owner/:ownerId", async (req, res) => {
    try {
      const restaurant = await storage.getRestaurantByOwnerId(req.params.ownerId);
      if (!restaurant) {
        return res.status(404).json({ message: "Restaurant not found" });
      }
      res.json(restaurant);
    } catch (error: any) {
      res.status(500).json({ message: "Error fetching restaurant: " + error.message });
    }
  });

  app.post("/api/restaurants", async (req, res) => {
    if (!req.isAuthenticated() || !["admin", "restaurant_owner"].includes(req.user.role)) {
      return res.sendStatus(403);
    }

    try {
      const restaurantData = insertRestaurantSchema.parse(req.body);
      // Ensure the restaurant is assigned to the current user if they're a restaurant owner
      if (req.user.role === "restaurant_owner") {
        restaurantData.ownerId = req.user.id;
      }
      const restaurant = await storage.createRestaurant(restaurantData);
      res.status(201).json(restaurant);
    } catch (error: any) {
      res.status(400).json({ message: "Error creating restaurant: " + error.message });
    }
  });

  app.put("/api/restaurants/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.sendStatus(401);
    }

    try {
      const restaurant = await storage.getRestaurant(req.params.id);
      if (!restaurant) {
        return res.status(404).json({ message: "Restaurant not found" });
      }

      // Check if user owns this restaurant or is admin
      if (restaurant.ownerId !== req.user.id && req.user.role !== "admin") {
        return res.sendStatus(403);
      }

      const updates = insertRestaurantSchema.partial().parse(req.body);
      const updatedRestaurant = await storage.updateRestaurant(req.params.id, updates);
      res.json(updatedRestaurant);
    } catch (error: any) {
      res.status(400).json({ message: "Error updating restaurant: " + error.message });
    }
  });

  // Lunchbox routes
  app.get("/api/restaurants/:restaurantId/lunchboxes", async (req, res) => {
    try {
      const lunchboxes = await storage.getLunchboxesByRestaurant(req.params.restaurantId);
      res.json(lunchboxes);
    } catch (error: any) {
      res.status(500).json({ message: "Error fetching lunchboxes: " + error.message });
    }
  });

  app.post("/api/restaurants/:restaurantId/lunchboxes", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.sendStatus(401);
    }

    try {
      // Check if user owns this restaurant or is admin
      const restaurant = await storage.getRestaurant(req.params.restaurantId);
      if (!restaurant || (restaurant.ownerId !== req.user.id && req.user.role !== "admin")) {
        return res.sendStatus(403);
      }

      const lunchboxData = insertLunchboxSchema.parse({
        ...req.body,
        restaurantId: req.params.restaurantId
      });
      const lunchbox = await storage.createLunchbox(lunchboxData);
      res.status(201).json(lunchbox);
    } catch (error: any) {
      res.status(400).json({ message: "Error creating lunchbox: " + error.message });
    }
  });

  app.put("/api/lunchboxes/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.sendStatus(401);
    }

    try {
      const lunchbox = await storage.getLunchbox(req.params.id);
      if (!lunchbox) {
        return res.status(404).json({ message: "Lunchbox not found" });
      }

      const restaurant = await storage.getRestaurant(lunchbox.restaurantId!);
      if (!restaurant || (restaurant.ownerId !== req.user.id && req.user.role !== "admin")) {
        return res.sendStatus(403);
      }

      const updates = insertLunchboxSchema.partial().parse(req.body);
      const updatedLunchbox = await storage.updateLunchbox(req.params.id, updates);
      res.json(updatedLunchbox);
    } catch (error: any) {
      res.status(400).json({ message: "Error updating lunchbox: " + error.message });
    }
  });

  app.delete("/api/lunchboxes/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.sendStatus(401);
    }

    try {
      const lunchbox = await storage.getLunchbox(req.params.id);
      if (!lunchbox) {
        return res.status(404).json({ message: "Lunchbox not found" });
      }

      const restaurant = await storage.getRestaurant(lunchbox.restaurantId!);
      if (!restaurant || (restaurant.ownerId !== req.user.id && req.user.role !== "admin")) {
        return res.sendStatus(403);
      }

      await storage.deleteLunchbox(req.params.id);
      res.sendStatus(204);
    } catch (error: any) {
      res.status(500).json({ message: "Error deleting lunchbox: " + error.message });
    }
  });

  // Delivery locations routes
  app.get("/api/delivery-locations", async (req, res) => {
    try {
      const locations = await storage.getDeliveryLocations();
      res.json(locations);
    } catch (error: any) {
      res.status(500).json({ message: "Error fetching delivery locations: " + error.message });
    }
  });

  // Order routes
  app.post("/api/orders", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.sendStatus(401);
    }

    try {
      const orderData = insertOrderSchema.parse({
        ...req.body,
        customerId: req.user.id
      });
      const order = await storage.createOrder(orderData);

      // Create order items
      if (req.body.items && Array.isArray(req.body.items)) {
        for (const item of req.body.items) {
          const orderItemData = insertOrderItemSchema.parse({
            ...item,
            orderId: order.id
          });
          await storage.createOrderItem(orderItemData);
        }
      }

      res.status(201).json(order);
    } catch (error: any) {
      res.status(400).json({ message: "Error creating order: " + error.message });
    }
  });

  // Stripe payment intent creation
  app.post("/api/create-payment-intent", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.sendStatus(401);
    }

    try {
      const { amount } = req.body;
      
      if (!amount || amount <= 0) {
        return res.status(400).json({ message: "Valid amount is required" });
      }

      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency: "usd",
        automatic_payment_methods: {
          enabled: true,
        },
      });

      res.json({ clientSecret: paymentIntent.client_secret });
    } catch (error: any) {
      console.error("Error creating payment intent:", error);
      res.status(500).json({ message: "Error creating payment intent: " + error.message });
    }
  });

  app.get("/api/orders", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.sendStatus(401);
    }

    try {
      let orders: Order[] = [];
      if (req.user.role === "customer") {
        orders = await storage.getOrdersByCustomer(req.user.id);
      } else if (req.user.role === "restaurant_owner") {
        const restaurant = await storage.getRestaurantByOwnerId(req.user.id);
        if (!restaurant) {
          return res.json([]);
        }
        orders = await storage.getOrdersByRestaurant(restaurant.id);
      } else {
        // Admin can see all orders - implement if needed
        orders = [];
      }

      // Enhance orders with restaurant info, customer info, delivery building and items
      const enhancedOrders = await Promise.all(
        orders.map(async (order) => {
          const restaurant = order.restaurantId ? await storage.getRestaurant(order.restaurantId) : null;
          const customer = order.customerId ? await storage.getUser(order.customerId) : null;
          const deliveryBuilding = order.deliveryBuildingId ? await storage.getDeliveryBuilding(order.deliveryBuildingId) : null;
          const orderItems = await storage.getOrderItems(order.id);
          
          // Get lunchbox details for each order item
          const itemsWithDetails = await Promise.all(
            orderItems.map(async (item) => {
              const lunchbox = item.lunchboxId ? await storage.getLunchbox(item.lunchboxId) : null;
              return {
                ...item,
                lunchbox: lunchbox || null
              };
            })
          );

          return {
            ...order,
            restaurant: restaurant || null,
            customer: customer || null,
            deliveryBuilding: deliveryBuilding || null,
            items: itemsWithDetails
          };
        })
      );

      res.json(enhancedOrders);
    } catch (error: any) {
      res.status(500).json({ message: "Error fetching orders: " + error.message });
    }
  });

  app.get("/api/orders/:id/items", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.sendStatus(401);
    }

    try {
      const order = await storage.getOrder(req.params.id);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      // Check authorization
      if (req.user.role === "customer" && order.customerId !== req.user.id) {
        return res.sendStatus(403);
      }
      if (req.user.role === "restaurant_owner") {
        const restaurant = await storage.getRestaurantByOwnerId(req.user.id);
        if (!restaurant || order.restaurantId !== restaurant.id) {
          return res.sendStatus(403);
        }
      }

      const items = await storage.getOrderItems(req.params.id);
      res.json(items);
    } catch (error: any) {
      res.status(500).json({ message: "Error fetching order items: " + error.message });
    }
  });

  // Bulk update order status
  app.patch("/api/orders/bulk-status", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.sendStatus(401);
    }

    if (req.user.role !== "restaurant_owner") {
      return res.sendStatus(403);
    }

    try {
      const { orderIds, status } = req.body;
      
      if (!orderIds || !Array.isArray(orderIds) || !status) {
        return res.status(400).json({ message: "orderIds array and status are required" });
      }

      const restaurant = await storage.getRestaurantByOwnerId(req.user.id);
      if (!restaurant) {
        return res.sendStatus(403);
      }

      // Verify all orders belong to this restaurant
      const orders = await Promise.all(
        orderIds.map(async (orderId: string) => {
          const order = await storage.getOrder(orderId);
          if (!order || order.restaurantId !== restaurant.id) {
            throw new Error(`Order ${orderId} not found or unauthorized`);
          }
          return order;
        })
      );

      // Update all orders
      await Promise.all(
        orderIds.map((orderId: string) => storage.updateOrderStatus(orderId, status))
      );

      res.json({ message: `Updated ${orderIds.length} orders to ${status}` });
    } catch (error: any) {
      res.status(400).json({ message: "Error updating orders: " + error.message });
    }
  });

  app.patch("/api/orders/:id/status", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.sendStatus(401);
    }

    try {
      const order = await storage.getOrder(req.params.id);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      // Only restaurant owners can update their order status
      if (req.user.role === "restaurant_owner") {
        const restaurant = await storage.getRestaurantByOwnerId(req.user.id);
        if (!restaurant || order.restaurantId !== restaurant.id) {
          return res.sendStatus(403);
        }
      } else if (req.user.role !== "admin") {
        return res.sendStatus(403);
      }

      const updatedOrder = await storage.updateOrderStatus(req.params.id, req.body.status);
      res.json(updatedOrder);
    } catch (error: any) {
      res.status(400).json({ message: "Error updating order status: " + error.message });
    }
  });

  // Delivery Location routes (Admin only)
  app.get("/api/delivery-locations/all", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== "admin") {
      return res.sendStatus(403);
    }

    try {
      const locations = await storage.getAllDeliveryLocations();
      res.json(locations);
    } catch (error: any) {
      res.status(500).json({ message: "Error fetching delivery locations: " + error.message });
    }
  });

  app.post("/api/delivery-locations", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== "admin") {
      return res.sendStatus(403);
    }

    try {
      const validatedData = insertDeliveryLocationSchema.parse(req.body);
      const location = await storage.createDeliveryLocation(validatedData);
      res.status(201).json(location);
    } catch (error: any) {
      res.status(400).json({ message: "Error creating delivery location: " + error.message });
    }
  });

  app.put("/api/delivery-locations/:id", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== "admin") {
      return res.sendStatus(403);
    }

    try {
      const location = await storage.updateDeliveryLocation(req.params.id, req.body);
      if (!location) {
        return res.status(404).json({ message: "Delivery location not found" });
      }
      res.json(location);
    } catch (error: any) {
      res.status(400).json({ message: "Error updating delivery location: " + error.message });
    }
  });

  app.delete("/api/delivery-locations/:id", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== "admin") {
      return res.sendStatus(403);
    }

    try {
      const success = await storage.deleteDeliveryLocation(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Delivery location not found" });
      }
      res.json({ message: "Delivery location deleted successfully" });
    } catch (error: any) {
      res.status(400).json({ message: "Error deleting delivery location: " + error.message });
    }
  });

  // Profile routes
  app.get("/api/profile", (req, res) => {
    if (!req.isAuthenticated()) {
      return res.sendStatus(401);
    }
    res.json(req.user);
  });

  app.put("/api/profile", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.sendStatus(401);
    }

    try {
      const { fullName, phoneNumber, deliveryLocationId } = req.body;
      const updatedUser = await storage.updateUserProfile(req.user!.id, {
        fullName,
        phoneNumber,
        deliveryLocationId,
      });
      res.json(updatedUser);
    } catch (error: any) {
      console.error("Profile update error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/delivery-locations", async (req, res) => {
    try {
      const locations = await storage.getDeliveryLocations();
      res.json(locations);
    } catch (error: any) {
      console.error("Get delivery locations error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Delivery Building routes
  app.get("/api/delivery-buildings", async (req, res) => {
    try {
      const buildings = await storage.getDeliveryBuildings();
      res.json(buildings);
    } catch (error: any) {
      res.status(500).json({ message: "Error fetching delivery buildings: " + error.message });
    }
  });

  app.get("/api/delivery-buildings/all", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== "admin") {
      return res.sendStatus(403);
    }

    try {
      const buildings = await storage.getAllDeliveryBuildings();
      res.json(buildings);
    } catch (error: any) {
      res.status(500).json({ message: "Error fetching delivery buildings: " + error.message });
    }
  });

  app.get("/api/delivery-buildings/location/:locationId", async (req, res) => {
    try {
      const buildings = await storage.getDeliveryBuildingsByLocation(req.params.locationId);
      res.json(buildings);
    } catch (error: any) {
      res.status(500).json({ message: "Error fetching delivery buildings: " + error.message });
    }
  });

  app.post("/api/delivery-buildings", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== "admin") {
      return res.sendStatus(403);
    }

    try {
      const validatedData = insertDeliveryBuildingSchema.parse(req.body);
      const building = await storage.createDeliveryBuilding(validatedData);
      res.status(201).json(building);
    } catch (error: any) {
      res.status(400).json({ message: "Error creating delivery building: " + error.message });
    }
  });

  app.put("/api/delivery-buildings/:id", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== "admin") {
      return res.sendStatus(403);
    }

    try {
      const building = await storage.updateDeliveryBuilding(req.params.id, req.body);
      if (!building) {
        return res.status(404).json({ message: "Delivery building not found" });
      }
      res.json(building);
    } catch (error: any) {
      res.status(400).json({ message: "Error updating delivery building: " + error.message });
    }
  });

  app.delete("/api/delivery-buildings/:id", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== "admin") {
      return res.sendStatus(403);
    }

    try {
      const success = await storage.deleteDeliveryBuilding(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Delivery building not found" });
      }
      res.json({ message: "Delivery building deleted successfully" });
    } catch (error: any) {
      res.status(400).json({ message: "Error deleting delivery building: " + error.message });
    }
  });

  app.get("/api/settings/service-fee", async (req, res) => {
    try {
      const setting = await storage.getSetting("service_fee");
      res.json({ value: setting?.value || "2.00" });
    } catch (error: any) {
      res.status(500).json({ message: "Error fetching service fee: " + error.message });
    }
  });

  app.put("/api/settings/service-fee", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== "admin") {
      return res.sendStatus(403);
    }

    try {
      const { value } = req.body;
      if (!value || isNaN(parseFloat(value))) {
        return res.status(400).json({ message: "Invalid service fee value" });
      }
      const setting = await storage.setSetting("service_fee", value);
      res.json(setting);
    } catch (error: any) {
      res.status(400).json({ message: "Error updating service fee: " + error.message });
    }
  });

  app.put("/api/restaurants/:id/discount", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.sendStatus(401);
    }

    try {
      const restaurant = await storage.getRestaurant(req.params.id);
      if (!restaurant) {
        return res.status(404).json({ message: "Restaurant not found" });
      }

      if (req.user.role !== "admin" && restaurant.ownerId !== req.user.id) {
        return res.sendStatus(403);
      }

      const { discountType, discountValue } = req.body;
      
      if (discountType && !["percentage", "flat", null].includes(discountType)) {
        return res.status(400).json({ message: "Invalid discount type. Must be 'percentage' or 'flat'" });
      }

      if (discountValue !== undefined && discountValue !== null && isNaN(parseFloat(discountValue))) {
        return res.status(400).json({ message: "Invalid discount value" });
      }

      const updated = await storage.updateRestaurant(req.params.id, {
        discountType: discountType || null,
        discountValue: discountValue || null,
      });

      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ message: "Error updating restaurant discount: " + error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
