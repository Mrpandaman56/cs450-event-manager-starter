import { z } from 'zod';

export const eventSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(120),
  date: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must use YYYY-MM-DD format')
    .refine((value) => {
      const parsedDate = new Date(`${value}T00:00:00.000Z`);
      return !Number.isNaN(parsedDate.getTime()) && parsedDate.toISOString().slice(0, 10) === value;
    }, 'Date must be a valid calendar date'),
  location: z.string().trim().min(1, 'Location is required').max(200),
  capacity: z.number().int().positive('Capacity must be a positive integer'),
  description: z.string().trim().max(1000).optional()
}).strict();
