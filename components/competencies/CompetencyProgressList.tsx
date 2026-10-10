import { Award } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { getStudentCompetencyProgressForUser } from "@/actions/competencies";
import { RecordAssessmentDialog } from "@/components/competencies/RecordAssessmentDialog";
import { formatDateTime } from "@/lib/format-date";

type Progress = Awaited<
  ReturnType<typeof getStudentCompetencyProgressForUser>
>["progress"];

export function CompetencyProgressList({
  progress,
  canRecordAssessment,
  studentId,
}: {
  progress: Progress;
  canRecordAssessment: boolean;
  studentId?: string;
}) {
  return (
    <div className="flex flex-col gap-4">
      {progress.map((entry) => (
        <Card key={entry.competency.id}>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Award size={16} />
              {entry.competency.name}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant={entry.currentLevel > 0 ? "secondary" : "outline"}>
                Level {entry.currentLevel}/5
              </Badge>
              {canRecordAssessment && studentId && (
                <RecordAssessmentDialog
                  studentId={studentId}
                  competencyId={entry.competency.id}
                  competencyName={entry.competency.name}
                />
              )}
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {entry.competency.description && (
              <p className="text-sm text-muted-foreground">
                {entry.competency.description}
              </p>
            )}
            {entry.assessments.length === 0 ? (
              <p className="text-sm text-muted-foreground">Not yet assessed.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {entry.assessments.map((assessment) => (
                  <div key={assessment.id} className="rounded-md border p-2 text-sm">
                    <p>
                      Score {assessment.score}/5 — {assessment.assessedBy.name}
                    </p>
                    {assessment.notes && (
                      <p className="text-muted-foreground">{assessment.notes}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(assessment.assessedAt)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
