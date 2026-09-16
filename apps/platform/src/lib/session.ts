/**
 * Platform's session surface.
 *
 * The implementation lives in `@nexora/auth/next` so both micro frontends
 * enforce authentication through the same code path. This file exists only so
 * that app code imports a local, stable path.
 */
export {
  currentActor,
  permissionsOf,
  requirePagePermission,
  requireSession,
  type Actor,
} from '@nexora/auth/next';
