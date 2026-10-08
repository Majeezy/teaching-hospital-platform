import { Suspense } from "react";
import { getSessionUser } from "@/lib/permissions";
import { getMyProfile } from "@/actions/patients";
import { ProfileForm } from "@/components/patient/ProfileForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ProfilePage() {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
      <ProfileContent />
    </Suspense>
  );
}

async function ProfileContent() {
  const [user, profile] = await Promise.all([getSessionUser(), getMyProfile()]);
  if (!user) return null; // layout already redirects; satisfies types here

  const age = calculateAge(profile.dateOfBirth);

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">My profile</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Keep your contact and medical information current.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Account</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-zinc-500">Name</p>
            <p>{user.name}</p>
          </div>
          <div>
            <p className="text-zinc-500">Email</p>
            <p>{user.email}</p>
          </div>
          <div>
            <p className="text-zinc-500">Date of birth</p>
            <p>
              {profile.dateOfBirth.toLocaleDateString()} ({age} years old)
            </p>
          </div>
        </CardContent>
      </Card>

      <ProfileForm profile={profile} />
    </div>
  );
}

function calculateAge(dateOfBirth: Date): number {
  const today = new Date();
  let age = today.getFullYear() - dateOfBirth.getFullYear();
  const monthDiff = today.getMonth() - dateOfBirth.getMonth();
  if (
    monthDiff < 0 ||
    (monthDiff === 0 && today.getDate() < dateOfBirth.getDate())
  ) {
    age--;
  }
  return age;
}
