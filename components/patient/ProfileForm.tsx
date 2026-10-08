"use client";

import { FormEvent, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { PatientProfile } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateMyProfile } from "@/actions/patients";

const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

export function ProfileForm({ profile }: { profile: PatientProfile }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const allergiesText = String(formData.get("allergies") ?? "");

    startTransition(async () => {
      try {
        await updateMyProfile({
          contactPhone: String(formData.get("contactPhone") ?? ""),
          emergencyContact: String(formData.get("emergencyContact") ?? ""),
          bloodType: String(formData.get("bloodType") ?? ""),
          allergies: allergiesText
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
        });
        toast.success("Profile updated");
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Something went wrong",
        );
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">
          Contact & medical details
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="contactPhone">Contact phone</Label>
            <Input
              id="contactPhone"
              name="contactPhone"
              type="tel"
              defaultValue={profile.contactPhone ?? ""}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="emergencyContact">Emergency contact</Label>
            <Input
              id="emergencyContact"
              name="emergencyContact"
              type="text"
              placeholder="Name and phone number"
              defaultValue={profile.emergencyContact ?? ""}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bloodType">Blood type</Label>
            <Select name="bloodType" defaultValue={profile.bloodType ?? undefined}>
              <SelectTrigger id="bloodType">
                <SelectValue placeholder="Unknown" />
              </SelectTrigger>
              <SelectContent>
                {BLOOD_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="allergies">Allergies</Label>
            <Input
              id="allergies"
              name="allergies"
              type="text"
              placeholder="Comma-separated, e.g. Penicillin, Peanuts"
              defaultValue={profile.allergies.join(", ")}
            />
          </div>

          <div>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
