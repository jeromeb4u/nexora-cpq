import type { Metadata } from 'next';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  DataList,
  DataListItem,
  PageHeader,
} from '@nexora/ui';
import { prisma } from '@nexora/db';
import { ROLE_LABELS } from '@nexora/auth/permissions';

import { requireSession } from '@/lib/session';
import { ProfileForm } from '@/components/profile-form';

export const metadata: Metadata = { title: 'Profile' };

export default async function ProfilePage() {
  const actor = await requireSession();

  // Read the row fresh rather than trusting the session payload, so a name
  // edited a moment ago is what the form starts from.
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: actor.id },
    select: {
      name: true,
      email: true,
      jobTitle: true,
      role: true,
      createdAt: true,
      manager: { select: { name: true } },
      reports: { select: { id: true } },
    },
  });

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader title="Profile" description="Your account details." />

      <Card>
        <CardHeader>
          <CardTitle>Personal details</CardTitle>
          <CardDescription>The name and title colleagues see on your quotes.</CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm name={user.name} jobTitle={user.jobTitle} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>
            Managed by an administrator. Roles cannot be changed from your own profile.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataList>
            <DataListItem label="Email">{user.email}</DataListItem>
            <DataListItem label="Role">{ROLE_LABELS[user.role]}</DataListItem>
            <DataListItem label="Reports to">{user.manager?.name ?? '—'}</DataListItem>
            <DataListItem label="Direct reports">
              {user.reports.length === 0 ? 'None' : String(user.reports.length)}
            </DataListItem>
            <DataListItem label="Member since">
              {user.createdAt.toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </DataListItem>
          </DataList>
        </CardContent>
      </Card>
    </div>
  );
}
