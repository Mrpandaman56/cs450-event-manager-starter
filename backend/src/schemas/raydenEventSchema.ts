
import { z } from 'zod';

export const raydenEventSchema = z.object({
  title: z.string()
    .trim()
    .min(1, 'Event title is required')
    .max(100, 'Title cannot exceed 100 characters'),

  date: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must use YYYY-MM-DD format')
    .refine((value) => {
      const date = new Date(`${value}T00:00:00.000Z`);
      return !Number.isNaN(date.getTime()) &&
        date.toISOString().slice(0, 10) === value;
    }, 'Enter a valid calendar date'),

  location: z.string()
    .trim()
    .min(1, 'Event location is required')
    .max(150, 'Location cannot exceed 150 characters'),

  capacity: z.number()
    .int('Capacity must be a whole number')
    .min(1, 'Capacity must be at least 1')
    .max(5000, 'Capacity cannot exceed 5000'),

  price: z.number()
    .min(0, 'Price cannot be negative')
    .max(10000, 'Price cannot exceed 10000'),

  description: z.string()
    .trim()
    .max(500, 'Description cannot exceed 500 characters')
    .optional()
}).strict();

export type RaydenEventInput = z.infer<typeof raydenEventSchema>;
