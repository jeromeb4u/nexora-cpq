'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { prisma } from '@nexora/db';
import { requireActor } from '@nexora/auth/session';
import { updateProfileSchema } from '@nexora/validation';
import { AppError, ErrorCode, logger, toSafeError } from '@nexora/observability';

export type ProfileActionResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly message: string; readonly reference: string };

/**
 * Update the signed-in user's own display name and job title.
 *
 * Deliberately narrow. The actor can only ever edit themselves — there is no
 * user id in the input, so there is nothing to tamper with. Role, manager and
 * active status are not in the schema at all: those are server-owned, and the
 * same fields are marked `input: false` in the Better Auth config for the same
 * reason. Self-service must never be a path to escalating your own privileges.
 */
export async function updateOwnProfile(input: unknown): Promise<ProfileActionResult> {
  try {
    const actor = await requireActor(await headers());

    const parsed = updateProfileSchema.safeParse(input);
    if (!parsed.success) {
      throw new AppError(
        ErrorCode.VALIDATION,
        parsed.error.issues[0]?.message ?? 'Some of the details entered are not valid.',
      );
    }

    const { name, jobTitle } = parsed.data;
    const before = await prisma.user.findUniqueOrThrow({
      where: { id: actor.id },
      select: { name: true, jobTitle: true },
    });

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: actor.id },
        data: { name, jobTitle: jobTitle ?? null },
      });

      await tx.auditEvent.create({
        data: {
          action: 'PROFILE_UPDATED',
          entity: 'USER',
          entityId: actor.id,
          actorId: actor.id,
          summary: 'Updated their profile',
          metadata: {
            nameChanged: before.name !== name,
            jobTitleChanged: (before.jobTitle ?? null) !== (jobTitle ?? null),
          },
        },
      });
    });

    revalidatePath('/profile');
    revalidatePath('/', 'layout');
    return { ok: true };
  } catch (error) {
    const safe = toSafeError(error);
    if (!(error instanceof AppError)) {
      logger.error('profile update failed', {
        reference: safe.reference,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    return { ok: false, message: safe.message, reference: safe.reference };
  }
}
