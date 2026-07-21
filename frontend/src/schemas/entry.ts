import { z } from "zod";

/** Shared entry form validation for the web registration flow. */
export const entrySchema = z.object({
  firstName: z.string().min(1, "First name is required").max(100),
  lastName: z.string().min(1, "Last name is required").max(100),
  phone: z
    .string()
    .min(7, "Enter a valid phone number")
    .max(20)
    .regex(/^[+\d][\d\s()-]+$/, "Enter a valid phone number"),
  email: z.string().email("Enter a valid email").optional().or(z.literal("")),
  address: z.string().max(500).optional().or(z.literal("")),
  acceptTerms: z.literal(true, {
    errorMap: () => ({ message: "You must accept the terms" }),
  }),
});

export type EntryFormValues = z.infer<typeof entrySchema>;

export const lotterySchema = z
  .object({
    name: z.string().min(1).max(200),
    description: z.string().max(2000).optional(),
    prizeText: z.string().max(1000).optional(),
    startDate: z.string(),
    endDate: z.string(),
    drawingDate: z.string().optional(),
    maxParticipants: z.number().int().positive(),
    minCharge: z.number().int().min(1),
    maxCharge: z.number().int().min(1),
  })
  .refine((v) => v.maxCharge >= v.minCharge, {
    message: "Max charge must be ≥ min charge",
    path: ["maxCharge"],
  })
  .refine((v) => v.maxCharge - v.minCharge + 1 >= 1, {
    message: "Charge range must allow at least one ticket",
    path: ["maxCharge"],
  });

export type LotteryFormValues = z.infer<typeof lotterySchema>;
