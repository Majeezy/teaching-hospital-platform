import Link from "next/link";
import { Building2, CalendarClock, Stethoscope, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { STATUS_VARIANT } from "@/lib/appointment-status";
import { StatTile } from "@/components/dashboard/StatTile";
import type { getAdminDashboardForUser } from "@/actions/dashboard";

type Data = Awaited<ReturnType<typeof getAdminDashboardForUser>>;

export function AdminDashboard({ data }: { data: Data }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Patients" value={data.totalPatients} icon={Users} />
        <StatTile
          label="Doctors"
          value={data.totalDoctors}
          icon={Stethoscope}
        />
        <StatTile
          label="Departments"
          value={data.totalDepartments}
          icon={Building2}
        />
        <StatTile
          label="Appointments today"
          value={data.appointmentsToday}
          icon={CalendarClock}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Awaiting confirmation
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {data.pendingAppointments.length === 0 && (
              <p className="text-sm text-zinc-500">Nothing pending.</p>
            )}
            {data.pendingAppointments.map((appointment) => (
              <Link
                key={appointment.id}
                href={`/appointments/${appointment.id}`}
                className="flex items-center justify-between rounded-md border p-3 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-900"
              >
                <div>
                  <p className="font-medium">
                    {appointment.patient.user.name} with Dr.{" "}
                    {appointment.doctor.user.name}
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

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Recent activity
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {data.recentActivity.length === 0 && (
              <p className="text-sm text-zinc-500">No activity recorded yet.</p>
            )}
            {data.recentActivity.map((entry) => (
              <div key={entry.id} className="text-sm">
                <span className="font-medium">{entry.actor.name}</span>{" "}
                <span className="text-zinc-500">
                  {entry.action.replaceAll("_", " ").toLowerCase()} —{" "}
                  {new Date(entry.createdAt).toLocaleString()}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
