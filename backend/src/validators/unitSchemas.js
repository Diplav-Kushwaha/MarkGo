import { z } from "zod";

// Base shape with field-level constraints only and NO defaults: it is
// `.partial()`-ed for updates, and zod keeps `.default()` through
// `.partial()` — a default here would make every PATCH that omits the
// field silently write the default (e.g. reset a package unit to
// simple). Defaults belong on the create schema only.
const unitInputSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(1, "Unit full name is required.")
    .max(200, "Unit full name must be 200 characters or fewer."),
  shortName: z
    .string()
    .trim()
    .min(1, "Unit short name is required.")
    .max(50, "Unit short name must be 50 characters or fewer."),
  isPackage: z.boolean(),
  quantity: z
    .number({ error: "Quantity must be a number." })
    .gt(0, "Quantity must be greater than 0.")
    .optional(),
  baseUnitId: z.string().trim().optional(),
});

// Package-level validation that crosses fields: a package unit needs both a
// positive quantity and a base unit. Update payloads are validated at the
// service layer (which also checks the base is simple/visible/owned-by-company
// and falls back to the stored values for omitted fields).
export const createUnitSchema = unitInputSchema
  .extend({ isPackage: z.boolean().default(false) })
  .superRefine((data, ctx) => {
    if (data.isPackage) {
      if (data.quantity === undefined || data.quantity === null) {
        ctx.addIssue({ code: "custom", path: ["quantity"], message: "Quantity is required for a package unit." });
      }
      if (!data.baseUnitId) {
        ctx.addIssue({ code: "custom", path: ["baseUnitId"], message: "Base unit is required for a package unit." });
      }
    }
  });

export const updateUnitSchema = unitInputSchema.partial();
