import { z } from "zod";

const dateString = (label) =>
  z
    .string()
    .min(1, `${label} date is required.`)
    .refine((value) => !Number.isNaN(new Date(value).getTime()), `Invalid ${label.toLowerCase()} date.`);

export const salesReportQuerySchema = z
  .object({
    from: dateString("From").transform((value) => new Date(value)),
    to: dateString("To").transform((value) => new Date(value)),
  })
  .refine((data) => data.from <= data.to, {
    message: "From date must be before or equal to to date.",
    path: ["from"],
  });
