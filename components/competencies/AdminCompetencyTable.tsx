import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { listAllCompetencyProgressForUser } from "@/actions/competencies";
import { formatDate } from "@/lib/format-date";

type Row = Awaited<ReturnType<typeof listAllCompetencyProgressForUser>>[number];

export function AdminCompetencyTable({ rows }: { rows: Row[] }) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Student</TableHead>
            <TableHead>Competency</TableHead>
            <TableHead>Level</TableHead>
            <TableHead>Last assessed</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-sm text-zinc-500">
                No assessments recorded yet.
              </TableCell>
            </TableRow>
          )}
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="font-medium">{row.student.user.name}</TableCell>
              <TableCell>{row.competency.name}</TableCell>
              <TableCell>
                <Badge variant={row.currentLevel > 0 ? "secondary" : "outline"}>
                  {row.currentLevel}/5
                </Badge>
              </TableCell>
              <TableCell className="text-sm text-zinc-500">
                {row.lastAssessedAt
                  ? formatDate(row.lastAssessedAt)
                  : "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
