import { auth } from '@nexora/auth/server';
import { toNextJsHandler } from 'better-auth/next-js';

/**
 * Better Auth's route handler.
 *
 * Mounted ONLY in the Platform app. Authentication is Platform's
 * responsibility (docs/MFE.md); the CPQ app never handles credentials — it
 * reads the session cookie that this endpoint issues. One app owning auth means
 * one place to audit, and one cookie domain to reason about.
 */
export const { GET, POST } = toNextJsHandler(auth);
