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
import companyAdminVendorRoutes from "./routes/companyAdminVendorRoutes.js";
import vendorAuthRoutes from "./routes/vendorAuthRoutes.js";
import companyAdminStaffRoutes from "./routes/companyAdminStaffRoutes.js";
import staffAuthRoutes from "./routes/staffAuthRoutes.js";
import companyAdminAccountantRoutes from "./routes/companyAdminAccountantRoutes.js";
import accountantAuthRoutes from "./routes/accountantAuthRoutes.js";
import companyAdminItemRoutes from "./routes/companyAdminItemRoutes.js";
import companyAdminInvoiceRoutes from "./routes/companyAdminInvoiceRoutes.js";
import companyAdminBillRoutes from "./routes/companyAdminBillRoutes.js";
import companyAdminPaymentRoutes from "./routes/companyAdminPaymentRoutes.js";
import companyAdminSettingsRoutes from "./routes/companyAdminSettingsRoutes.js";
import companyAdminDashboardRoutes from "./routes/companyAdminDashboardRoutes.js";
import companyAdminReportRoutes from "./routes/companyAdminReportRoutes.js";
import companyAdminSubscriptionRoutes from "./routes/companyAdminSubscriptionRoutes.js";
import planRoutes from "./routes/planRoutes.js";
import subscriptionPaymentRoutes from "./routes/subscriptionPaymentRoutes.js";


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
app.use("/api/admin/vendors", companyAdminVendorRoutes);
app.use("/api/vendor", vendorAuthRoutes);
app.use("/api/admin/staff", companyAdminStaffRoutes);
app.use("/api/staff", staffAuthRoutes);
app.use("/api/admin/accountants", companyAdminAccountantRoutes);
app.use("/api/accountant", accountantAuthRoutes);
app.use("/api/admin/items", companyAdminItemRoutes); 
app.use("/api/admin/invoices", companyAdminInvoiceRoutes);
app.use("/api/admin/bills", companyAdminBillRoutes);
app.use("/api/admin/payments", companyAdminPaymentRoutes);
app.use("/api/admin/settings", companyAdminSettingsRoutes);
app.use("/api/admin/dashboard", companyAdminDashboardRoutes);
app.use("/api/admin/reports", companyAdminReportRoutes);
app.use("/api/admin/subscription", companyAdminSubscriptionRoutes);
 

app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` });
});

app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);

  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ success: false, message: "Malformed JSON in request body." });
  }
  if (err.message && err.message.startsWith("Origin ")) {
    return res.status(403).json({ success: false, message: "Not allowed by CORS." });
  }
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal server error.",
  });
});

async function start() {
  try {
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
