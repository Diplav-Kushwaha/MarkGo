import { z } from "zod";

const categoryInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Category name is required.")
    .max(100, "Category name must be 100 characters or fewer."),
  type: z.enum(["PRODUCT", "SERVICE"], {
    errorMap: () => ({ message: "Category type must be Product or Service." }),
  }),
});

export const createCategorySchema = categoryInputSchema;

export const updateCategorySchema = categoryInputSchema.partial();
