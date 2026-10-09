import Link from "next/link";
import { CalendarClock, History } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { STATUS_VARIANT } from "@/lib/appointment-status";
import { StatTile } from "@/components/dashboard/StatTile";
import type { getPatientDashboardForUser } from "@/actions/dashboard";

type Data = Awaited<ReturnType<typeof getPatientDashboardForUser>>;

export function PatientDashboard({ data }: { data: Data }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <StatTile
          label="Upcoming appointments"
          value={data.upcomingAppointments.length}
          icon={CalendarClock}
        />
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-zinc-500">
              Blood type
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {data.patientProfile.bloodType || "Not set"}
            </p>
            <Link
              href="/patient/profile"
              className="text-xs text-zinc-500 underline underline-offset-2"
            >
              Edit profile
            </Link>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Upcoming appointments
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {data.upcomingAppointments.length === 0 && (
              <p className="text-sm text-zinc-500">
                Nothing upcoming.{" "}
                <Link
                  href="/appointments"
                  className="underline underline-offset-2"
                >
                  Request an appointment
                </Link>
                .
              </p>
            )}
            {data.upcomingAppointments.map((appointment) => (
              <Link
                key={appointment.id}
                href={`/appointments/${appointment.id}`}
                className="flex items-center justify-between rounded-md border p-3 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-900"
              >
                <div>
                  <p className="font-medium">
                    Dr. {appointment.doctor.user.name}
                  </p>
                  <p className="text-zinc-500">
                    {appointment.department.name} —{" "}
                    {new Date(appointment.scheduledAt).toLocaleString()}
                  </p>
                </div>
                <Badge variant={STATUS_VARIANT[appointment.status]}>
                  {appointment.status}
                </Badge>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <History size={14} />
              Past appointments
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {data.pastAppointments.length === 0 && (
              <p className="text-sm text-zinc-500">No past appointments.</p>
            )}
            {data.pastAppointments.map((appointment) => (
              <Link
                key={appointment.id}
                href={`/appointments/${appointment.id}`}
                className="flex items-center justify-between rounded-md border p-3 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-900"
              >
                <div>
                  <p className="font-medium">
                    Dr. {appointment.doctor.user.name}
                  </p>
                  <p className="text-zinc-500">
                    {new Date(appointment.scheduledAt).toLocaleString()}
                  </p>
                </div>
                <Badge variant={STATUS_VARIANT[appointment.status]}>
                  {appointment.status}
                </Badge>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
