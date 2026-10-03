import { z } from "zod";

// HSN code for goods is 2 to 8 digits, SAC code for services is 4 to 6 digits
const hsnRegex = /^\d{2,8}$/;
const sacRegex = /^\d{4,6}$/;

export const createItemSchema = z.object({
  type: z.enum(["PRODUCT", "SERVICE"]).default("PRODUCT"),
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters.")
    .max(200, "Name must be 200 characters or fewer."),
  sku: z
    .string()
    .trim()
    .max(60, "SKU / Code must be 60 characters or fewer.")
    .optional()
    .or(z.literal("")),
  barcode: z
    .string()
    .trim()
    .max(60, "Barcode must be 60 characters or fewer.")
    .optional()
    .or(z.literal("")),

  // Categorization
  category: z
    .string()
    .trim()
    .max(100, "Category must be 100 characters or fewer.")
    .optional()
    .or(z.literal("")),
  subCategory: z
    .string()
    .trim()
    .max(100, "Subcategory must be 100 characters or fewer.")
    .optional()
    .or(z.literal("")),
  brand: z
    .string()
    .trim()
    .max(100, "Brand must be 100 characters or fewer.")
    .optional()
    .or(z.literal("")),
  tags: z
    .string()
    .trim()
    .max(250, "Tags must be 250 characters or fewer.")
    .optional()
    .or(z.literal("")),

  // Tax & HSN/SAC
  hsnCode: z
    .string()
    .trim()
    .regex(hsnRegex, "HSN code must be 2 to 8 numeric digits.")
    .optional()
    .or(z.literal("")),
  sacCode: z
    .string()
    .trim()
    .regex(sacRegex, "SAC code must be 4 to 6 numeric digits.")
    .optional()
    .or(z.literal("")),
  taxRate: z
    .number()
    .min(0, "Tax rate cannot be negative.")
    .max(100, "Tax rate cannot exceed 100%.")
    .default(0),
  isPriceInclusiveTax: z.boolean().default(false),

  // Pricing
  salesPrice: z.number().min(0, "Sales price cannot be negative.").default(0),
  purchasePrice: z.number().min(0, "Purchase price cannot be negative.").optional(),
  discountType: z.enum(["PERCENTAGE", "FLAT"]).optional(),
  discountValue: z.number().min(0, "Discount cannot be negative.").optional(),

  // Unit of Measurement
  unit: z
    .string()
    .trim()
    .min(1, "Unit of measurement is required.")
    .max(30, "Unit must be 30 characters or fewer.")
    .default("pcs"),

  // Inventory Tracking
  trackInventory: z.boolean().default(true),
  stockQuantity: z.number().optional().default(0),
  openingStock: z.number().min(0, "Opening stock cannot be negative.").optional().default(0),
  reorderLevel: z.number().min(0, "Reorder level cannot be negative.").optional().default(0),
  allowBackorder: z.boolean().default(false),

  // Metadata
  description: z
    .string()
    .trim()
    .max(2000, "Description must be 2000 characters or fewer.")
    .optional()
    .or(z.literal("")),
  imageUrl: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .or(z.literal("")),
  linkedVendorId: z
    .string()
    .trim()
    .optional()
    .or(z.literal("")),
});

export const updateItemSchema = createItemSchema.partial();

export const updateItemStatusSchema = z.object({
  status: z.enum(["ACTIVE", "INACTIVE"], {
    errorMap: () => ({ message: "Status must be ACTIVE or INACTIVE." }),
  }),
});

export const bulkActionItemSchema = z.object({
  itemIds: z.array(z.string().min(1)).min(1, "At least one item must be selected."),
  action: z.enum(["ACTIVATE", "DEACTIVATE", "DELETE", "ASSIGN_CATEGORY"]),
  category: z.string().trim().max(100).optional(),
});
