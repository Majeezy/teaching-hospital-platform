import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { listLogbookEntriesForUser } from "@/actions/logbook";

type LogbookEntry = Awaited<ReturnType<typeof listLogbookEntriesForUser>>[number];

export function LogbookTable({ entries }: { entries: LogbookEntry[] }) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Student</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Appointment</TableHead>
            <TableHead>Hours</TableHead>
            <TableHead>Logged</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={5}
                className="text-center text-sm text-zinc-500"
              >
                No clinical hours logged yet.
              </TableCell>
            </TableRow>
          )}
          {entries.map((entry) => (
            <TableRow key={entry.id}>
              <TableCell className="font-medium">
                {entry.student.user.name}
              </TableCell>
              <TableCell>
                <Badge variant="outline">
                  {entry.type.replace(/_/g, " ")}
                </Badge>
              </TableCell>
              <TableCell className="text-sm text-zinc-500">
                {entry.relatedAppointment
                  ? `${new Date(entry.relatedAppointment.scheduledAt).toLocaleDateString()} with Dr. ${entry.relatedAppointment.doctor.user.name}`
                  : "—"}
              </TableCell>
              <TableCell>{Number(entry.hours).toFixed(1)}</TableCell>
              <TableCell className="text-sm text-zinc-500">
                {new Date(entry.loggedAt).toLocaleDateString()}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
