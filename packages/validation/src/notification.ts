import { z } from 'zod';
import { cuidSchema } from './common';

/** Marking one notification read. The owner is the session, never the input. */
export const markNotificationReadSchema = z.object({ notificationId: cuidSchema });
export type MarkNotificationReadInput = z.infer<typeof markNotificationReadSchema>;
