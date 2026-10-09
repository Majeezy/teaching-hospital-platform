import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ACTIVITY_STATUS_VARIANT } from "@/lib/activity-status";
import type { listActivitiesForUser } from "@/actions/learning-activities";

type Activity = Awaited<ReturnType<typeof listActivitiesForUser>>[number];

export function ActivitiesTable({ activities }: { activities: Activity[] }) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Title</TableHead>
            <TableHead>Student</TableHead>
            <TableHead>Supervisor</TableHead>
            <TableHead>Due</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {activities.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={5}
                className="text-center text-sm text-zinc-500"
              >
                No learning activities yet.
              </TableCell>
            </TableRow>
          )}
          {activities.map((activity) => (
            <TableRow key={activity.id}>
              <TableCell className="font-medium">
                <Link
                  href={`/activities/${activity.id}`}
                  className="hover:underline"
                >
                  {activity.title}
                </Link>
              </TableCell>
              <TableCell>{activity.student.user.name}</TableCell>
              <TableCell>Dr. {activity.supervisor.user.name}</TableCell>
              <TableCell className="text-sm text-zinc-500">
                {activity.dueDate
                  ? new Date(activity.dueDate).toLocaleDateString()
                  : "—"}
              </TableCell>
              <TableCell>
                <Badge variant={ACTIVITY_STATUS_VARIANT[activity.status]}>
                  {activity.status.replace("_", " ")}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
