import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { listPlacementsForUser } from "@/actions/placements";

type Placement = Awaited<ReturnType<typeof listPlacementsForUser>>[number];

export function PlacementsTable({ placements }: { placements: Placement[] }) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Student</TableHead>
            <TableHead>Supervisor</TableHead>
            <TableHead>Department</TableHead>
            <TableHead>Period</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {placements.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={5}
                className="text-center text-sm text-zinc-500"
              >
                No placements yet.
              </TableCell>
            </TableRow>
          )}
          {placements.map((placement) => (
            <TableRow key={placement.id}>
              <TableCell className="font-medium">
                {placement.student.user.name}
                <span className="block text-xs text-zinc-500">
                  {placement.student.studentNumber}
                </span>
              </TableCell>
              <TableCell>Dr. {placement.supervisor.user.name}</TableCell>
              <TableCell>{placement.department.name}</TableCell>
              <TableCell className="text-sm text-zinc-500">
                {new Date(placement.startDate).toLocaleDateString()} –{" "}
                {new Date(placement.endDate).toLocaleDateString()}
              </TableCell>
              <TableCell>
                <Badge
                  variant={
                    placement.status === "ACTIVE" ? "secondary" : "outline"
                  }
                >
                  {placement.status}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
