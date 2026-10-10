import { Suspense } from "react";
import { getSessionUser } from "@/lib/permissions";
import {
  getMyCompetencyProgress,
  getStudentCompetencyProgress,
  listAllCompetencyProgress,
} from "@/actions/competencies";
import { listSupervisedStudents } from "@/actions/learning-activities";
import { CompetencyProgressList } from "@/components/competencies/CompetencyProgressList";
import { StudentSelector } from "@/components/competencies/StudentSelector";
import { AdminCompetencyTable } from "@/components/competencies/AdminCompetencyTable";

export default function CompetenciesPage(
  props: PageProps<"/competencies">,
) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <CompetenciesContent searchParams={props.searchParams} />
    </Suspense>
  );
}

async function CompetenciesContent({
  searchParams,
}: Pick<PageProps<"/competencies">, "searchParams">) {
  const user = await getSessionUser();
  if (!user) return null; // layout already redirects; satisfies types here

  const isAdmin =
    user.roles.includes("HOSPITAL_ADMIN") || user.roles.includes("SYSTEM_ADMIN");
  const isDoctor = user.roles.includes("DOCTOR");
  const isStudent = user.roles.includes("STUDENT");

  if (isStudent) {
    const { progress } = await getMyCompetencyProgress();
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="font-heading text-2xl font-semibold">Competencies</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your progress against the core competency catalog.
          </p>
        </div>
        <CompetencyProgressList progress={progress} canRecordAssessment={false} />
      </div>
    );
  }

  if (isAdmin) {
    const rows = await listAllCompetencyProgress();
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="font-heading text-2xl font-semibold">Competencies</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every student&rsquo;s competency progress, system-wide.
          </p>
        </div>
        <AdminCompetencyTable rows={rows} />
      </div>
    );
  }

  // Doctor: pick one of their supervised students via a plain GET form
  // (no client JS needed), then show that student's progress plus the
  // ability to record a new assessment.
  const [students, params] = await Promise.all([
    isDoctor ? listSupervisedStudents() : Promise.resolve([]),
    searchParams,
  ]);
  const studentId = typeof params.studentId === "string" ? params.studentId : "";
  const selected = studentId
    ? await getStudentCompetencyProgress(studentId).catch(() => null)
    : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">Competencies</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Track and assess your students&rsquo; competency progress.
        </p>
      </div>
      <StudentSelector students={students} selectedStudentId={studentId} />
      {studentId && (selected ? (
        <CompetencyProgressList
          progress={selected.progress}
          canRecordAssessment={selected.canRecordAssessment}
          studentId={studentId}
        />
      ) : (
        <p className="text-sm text-muted-foreground">
          You don&rsquo;t have access to this student&rsquo;s competency record.
        </p>
      ))}
    </div>
  );
}
