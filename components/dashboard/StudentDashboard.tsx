import Link from "next/link";
import { Award, BookOpen, Clock, Eye, NotebookPen } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatTile } from "@/components/dashboard/StatTile";
import { ACTIVITY_STATUS_VARIANT } from "@/lib/activity-status";
import type { getStudentDashboardForUser } from "@/actions/dashboard";
import { formatDate, formatDateTime } from "@/lib/format-date";

type Data = Awaited<ReturnType<typeof getStudentDashboardForUser>>;

export function StudentDashboard({ data }: { data: Data }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile
          label="Due today"
          value={data.todaysActivities.length}
          icon={BookOpen}
        />
        <StatTile
          label="Upcoming shadowing"
          value={data.upcomingShadowing.length}
          icon={Eye}
        />
        <StatTile
          label="Clinical hours logged"
          value={data.totalHoursLogged}
          icon={Clock}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <NotebookPen size={14} />
              Pending activities
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {data.pendingReflectionActivities.length === 0 && (
              <p className="text-sm text-zinc-500">
                Nothing outstanding --{" "}
                <Link href="/activities" className="underline underline-offset-2">
                  view all activities
                </Link>
                .
              </p>
            )}
            {data.pendingReflectionActivities.map((activity) => (
              <Link
                key={activity.id}
                href={`/activities/${activity.id}`}
                className="flex items-center justify-between rounded-md border p-3 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-900"
              >
                <div>
                  <p className="font-medium">{activity.title}</p>
                  <p className="text-zinc-500">
                    Dr. {activity.supervisor.user.name}
                    {activity.dueDate &&
                      ` — due ${formatDate(activity.dueDate)}`}
                  </p>
                </div>
                <Badge variant={ACTIVITY_STATUS_VARIANT[activity.status]}>
                  {activity.status.replace("_", " ")}
                </Badge>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Eye size={14} />
              Upcoming shadowing
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {data.upcomingShadowing.length === 0 && (
              <p className="text-sm text-zinc-500">
                No upcoming shadowed appointments.
              </p>
            )}
            {data.upcomingShadowing.map((assignment) => (
              <div key={assignment.id} className="rounded-md border p-3 text-sm">
                <p className="font-medium">
                  Dr. {assignment.appointment.doctor.user.name}
                </p>
                <p className="text-zinc-500">
                  {assignment.appointment.department.name} —{" "}
                  {formatDateTime(assignment.appointment.scheduledAt)}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Current placement
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.currentPlacement ? (
              <div className="text-sm">
                <p className="font-medium">
                  {data.currentPlacement.department.name}
                </p>
                <p className="text-zinc-500">
                  Supervised by Dr. {data.currentPlacement.supervisor.user.name}
                </p>
                <p className="text-zinc-500">
                  {formatDate(data.currentPlacement.startDate)}{" "}
                  – {formatDate(data.currentPlacement.endDate)}
                </p>
              </div>
            ) : (
              <p className="text-sm text-zinc-500">No active placement.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Award size={14} />
              Competency progress
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {data.competencyProgress.map((entry) => (
              <div
                key={entry.competency.id}
                className="flex items-center justify-between text-sm"
              >
                <span>{entry.competency.name}</span>
                <Badge variant={entry.currentLevel > 0 ? "secondary" : "outline"}>
                  Level {entry.currentLevel}/5
                </Badge>
              </div>
            ))}
            <Link
              href="/competencies"
              className="mt-1 text-xs text-zinc-500 underline underline-offset-2"
            >
              View full history
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
