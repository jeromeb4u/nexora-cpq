/**
 * CPQ's session surface.
 *
 * The implementation lives in `@nexora/auth/next`, shared with Platform, so
 * both micro frontends enforce authentication through one code path. CPQ does
 * NOT mount the Better Auth route handler — Platform owns credential handling;
 * CPQ only reads the session cookie Platform issued (docs/MFE.md).
 */
export {
  currentActor,
  permissionsOf,
  requirePagePermission,
  requireSession,
  type Actor,
} from '@nexora/auth/next';
