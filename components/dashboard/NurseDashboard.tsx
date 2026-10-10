import Link from "next/link";
import { CalendarClock, Clock, History } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatTile } from "@/components/dashboard/StatTile";
import type { getNurseDashboardForUser } from "@/actions/dashboard";
import { formatDateTime } from "@/lib/format-date";

type Data = Awaited<ReturnType<typeof getNurseDashboardForUser>>;
type Appointment = Data["todaysAppointments"][number];

function AppointmentRow({ appointment }: { appointment: Appointment }) {
  return (
    <p className="flex items-center justify-between text-sm">
      <span className="font-medium">
        {appointment.patient.user.name}
        <span className="text-muted-foreground"> — Dr. {appointment.doctor.user.name}</span>
      </span>
      <span className="text-muted-foreground">
        {formatDateTime(appointment.scheduledAt)}
      </span>
    </p>
  );
}

export function NurseDashboard({ data }: { data: Data }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <StatTile
          label="Today's appointments"
          value={data.todaysAppointments.length}
          icon={CalendarClock}
        />
        <StatTile
          label="Upcoming appointments"
          value={data.upcomingAppointments.length}
          icon={Clock}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Today in your department
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {data.todaysAppointments.length === 0 && (
              <p className="text-sm text-muted-foreground">Nothing scheduled today.</p>
            )}
            {data.todaysAppointments.map((appointment) => (
              <Link key={appointment.id} href={`/appointments/${appointment.id}`}>
                <AppointmentRow appointment={appointment} />
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Upcoming</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {data.upcomingAppointments.length === 0 && (
              <p className="text-sm text-muted-foreground">Nothing else upcoming.</p>
            )}
            {data.upcomingAppointments.map((appointment) => (
              <Link key={appointment.id} href={`/appointments/${appointment.id}`}>
                <AppointmentRow appointment={appointment} />
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <History size={14} />
              Recently completed
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {data.recentCompleted.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No completed appointments yet.
              </p>
            )}
            {data.recentCompleted.map((appointment) => (
              <Link key={appointment.id} href={`/appointments/${appointment.id}`}>
                <AppointmentRow appointment={appointment} />
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
