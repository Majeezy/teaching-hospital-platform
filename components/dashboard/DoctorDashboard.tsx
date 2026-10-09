import Link from "next/link";
import { CalendarClock, ClipboardCheck, Clock, History, Users2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatTile } from "@/components/dashboard/StatTile";
import type { getDoctorDashboardForUser } from "@/actions/dashboard";

type Data = Awaited<ReturnType<typeof getDoctorDashboardForUser>>;

function AppointmentRow({
  patientName,
  when,
}: {
  patientName: string;
  when: Date;
}) {
  return (
    <p className="flex items-center justify-between text-sm">
      <span className="font-medium">{patientName}</span>
      <span className="text-zinc-500">{new Date(when).toLocaleString()}</span>
    </p>
  );
}

export function DoctorDashboard({ data }: { data: Data }) {
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
            <CardTitle className="text-sm font-medium">Today</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {data.todaysAppointments.length === 0 && (
              <p className="text-sm text-zinc-500">Nothing scheduled today.</p>
            )}
            {data.todaysAppointments.map((appointment) => (
              <Link key={appointment.id} href={`/appointments/${appointment.id}`}>
                <AppointmentRow
                  patientName={appointment.patient.user.name}
                  when={appointment.scheduledAt}
                />
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
              <p className="text-sm text-zinc-500">Nothing else upcoming.</p>
            )}
            {data.upcomingAppointments.map((appointment) => (
              <Link key={appointment.id} href={`/appointments/${appointment.id}`}>
                <AppointmentRow
                  patientName={appointment.patient.user.name}
                  when={appointment.scheduledAt}
                />
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <History size={14} />
              Recent patient interactions
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {data.recentCompleted.length === 0 && (
              <p className="text-sm text-zinc-500">
                No completed appointments yet.
              </p>
            )}
            {data.recentCompleted.map((appointment) => (
              <Link key={appointment.id} href={`/appointments/${appointment.id}`}>
                <AppointmentRow
                  patientName={appointment.patient.user.name}
                  when={appointment.scheduledAt}
                />
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      {data.supervisedStudents.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <Users2 size={14} />
                My students
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {data.supervisedStudents.map((placement) => (
                <p key={placement.id} className="text-sm">
                  {placement.student.user.name}
                </p>
              ))}
              <Link
                href="/placements"
                className="mt-1 text-xs text-zinc-500 underline underline-offset-2"
              >
                View placements
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <ClipboardCheck size={14} />
                Activities awaiting your feedback
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {data.activitiesAwaitingFeedback.length === 0 && (
                <p className="text-sm text-zinc-500">Nothing to review.</p>
              )}
              {data.activitiesAwaitingFeedback.map((activity) => (
                <Link
                  key={activity.id}
                  href={`/activities/${activity.id}`}
                  className="flex items-center justify-between rounded-md border p-3 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-900"
                >
                  <span className="font-medium">{activity.title}</span>
                  <span className="text-zinc-500">{activity.student.user.name}</span>
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
