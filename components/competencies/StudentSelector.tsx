import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { listSupervisedStudentsForUser } from "@/actions/learning-activities";

type Student = Awaited<ReturnType<typeof listSupervisedStudentsForUser>>[number];

export function StudentSelector({
  students,
  selectedStudentId,
}: {
  students: Student[];
  selectedStudentId: string;
}) {
  if (students.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No students placed under you yet.
      </p>
    );
  }

  return (
    <form
      method="GET"
      className="flex flex-wrap items-end gap-3 rounded-md border p-4"
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="studentId">Student</Label>
        <select
          id="studentId"
          name="studentId"
          defaultValue={selectedStudentId}
          className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
        >
          <option value="">Select a student</option>
          {students.map((student) => (
            <option key={student.id} value={student.id}>
              {student.user.name}
            </option>
          ))}
        </select>
      </div>
      <Button type="submit" variant="outline" size="sm">
        View progress
      </Button>
    </form>
  );
}
