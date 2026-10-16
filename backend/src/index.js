import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import prisma from "./prisma.js";
import superAdminRoutes from "./routes/superAdminRoutes.js";
import superAdminSubscriptionRoutes from "./routes/superAdminSubscriptionRoutes.js";
import companyAdminRoutes from "./routes/companyAdminRoutes.js";
import tokenRoutes from "./routes/tokenRoutes.js";
import csrfRoutes from "./routes/csrfRoutes.js";
import companyAdminCustomerRoutes from "./routes/companyAdminCustomerRoutes.js";
import customerAuthRoutes from "./routes/customerAuthRoutes.js";
import customerDashboardRoutes from "./routes/customerDashboardRoutes.js";
import companyAdminVendorRoutes from "./routes/companyAdminVendorRoutes.js";
import vendorAuthRoutes from "./routes/vendorAuthRoutes.js";
import vendorDashboardRoutes from "./routes/vendorDashboardRoutes.js";
import companyAdminItemRoutes from "./routes/companyAdminItemRoutes.js";
import companyAdminServiceRoutes from "./routes/companyAdminServiceRoutes.js";
import companyAdminUnitRoutes from "./routes/companyAdminUnitRoutes.js";
import companyAdminCategoryRoutes from "./routes/companyAdminCategoryRoutes.js";
import companyAdminInvoiceRoutes from "./routes/companyAdminInvoiceRoutes.js";
import companyAdminBillRoutes from "./routes/companyAdminBillRoutes.js";
import companyAdminPaymentRoutes from "./routes/companyAdminPaymentRoutes.js";
import companyAdminSettingsRoutes from "./routes/companyAdminSettingsRoutes.js";
import companyAdminDashboardRoutes from "./routes/companyAdminDashboardRoutes.js";
import companyAdminReportRoutes from "./routes/companyAdminReportRoutes.js";
import companyAdminSubscriptionRoutes from "./routes/companyAdminSubscriptionRoutes.js";
import planRoutes from "./routes/planRoutes.js";
import subscriptionPaymentRoutes from "./routes/subscriptionPaymentRoutes.js";
import { isDummyPayment } from "./config/subscription.js";


const requiredEnvVars = ["DATABASE_URL", "JWT_ACCESS_SECRET", "APP_URL", "CORS_ORIGIN"];
for (const key of requiredEnvVars) {
  if (!process.env[key]) {
    console.error(`FATAL: missing required environment variable ${key}. See .env.example.`);
    process.exit(1);
  }
}

const app = express();
const PORT = process.env.PORT || 5000;
app.set("trust proxy", 1);
app.use(helmet());

// CORS_ORIGIN is a required, comma-separated whitelist of exact origins

const allowedOrigins = process.env.CORS_ORIGIN.split(",").map((o) => o.trim());

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`Origin ${origin} is not allowed by CORS.`));
    },
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.get("/health", (req, res) => {
  res.status(200).json({ success: true, message: "MarkGo backend is running." });
});

app.use("/api", csrfRoutes);
app.use("/api/plans", planRoutes);
app.use("/api/subscription-payments", subscriptionPaymentRoutes);
app.use("/api/auth", tokenRoutes);
app.use("/api/superadmin", superAdminRoutes);
// Mounted after superAdminRoutes: that router only matches its own paths and
// falls through, and its CSRF/validation middleware stays untouched.
app.use("/api/superadmin", superAdminSubscriptionRoutes);
app.use("/api/admin", companyAdminRoutes);
app.use("/api/admin/customers", companyAdminCustomerRoutes);
app.use("/api/customer", customerAuthRoutes);
// Customer dashboard routes (read-only) share the /api/customer prefix. Mounted
// after the auth router so /login, /refresh, /logout, /me, /verify-invite and
// /accept-invite keep resolving on customerAuthRoutes first; this router's
// paths (/profile, /invoices, /products, /services, /purchased-products) do not
// overlap those. Every route here requires a CUSTOMER token.
app.use("/api/customer", customerDashboardRoutes);
app.use("/api/admin/vendors", companyAdminVendorRoutes);
app.use("/api/vendor", vendorAuthRoutes);
// Vendor dashboard routes (read-only) share the /api/vendor prefix. Mounted
// after the auth router so /login, /refresh, /logout, /me and /verify-invite
// keep resolving on vendorAuthRoutes first; this router's paths (/profile,
// /sold-products, /bills, /bills/:id, /products, /services) do not overlap
// those. Every route here requires a VENDOR token.
app.use("/api/vendor", vendorDashboardRoutes);
app.use("/api/admin/items", companyAdminItemRoutes); 
// Service-only routes that have no place on the shared item router (today: the
// company-wide services summary). The service CRUD endpoints stay on
// /api/admin/items, dispatched there by the declared `type`.
app.use("/api/admin/services", companyAdminServiceRoutes);
app.use("/api/admin/units", companyAdminUnitRoutes);
app.use("/api/admin/categories", companyAdminCategoryRoutes);
app.use("/api/admin/invoices", companyAdminInvoiceRoutes);
app.use("/api/admin/bills", companyAdminBillRoutes);
app.use("/api/admin/payments", companyAdminPaymentRoutes);
app.use("/api/admin/settings", companyAdminSettingsRoutes);
app.use("/api/admin/dashboard", companyAdminDashboardRoutes);
app.use("/api/admin/reports", companyAdminReportRoutes);
app.use("/api/admin/subscription", companyAdminSubscriptionRoutes);
 

app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found." });
});

app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);

  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ success: false, message: "Malformed JSON in request body." });
  }
  if (err.message && err.message.startsWith("Origin ")) {
    return res.status(403).json({ success: false, message: "Not allowed by CORS." });
  }
  const status = err.status || 500;
  const knownClientError = Number(status) < 500;
  const explicitlyExposed = err.expose === true;
  res.status(status).json({
    success: false,
    message: (knownClientError || explicitlyExposed) && err.message
      ? err.message
      : "Something went wrong. Please try again.",
  });
});

async function start() {
  try {
    if (process.env.NODE_ENV === "production" && isDummyPayment) {
      console.error("!!! WARNING: DUMMY PAYMENTS ARE ENABLED IN PRODUCTION. Public payment confirmation is not a real payment processor. !!!");
    }

    await prisma.$connect();
    console.log("[db] Connected to MySQL via Prisma.");

    app.listen(PORT, () => {
      console.log(`MarkGo backend listening on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
}

async function shutdown(signal) {
  console.log(`Received ${signal}. Shutting down gracefully...`);
  await prisma.$disconnect();
  process.exit(0);
}
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
start();
export default app;
