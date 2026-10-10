import { Suspense } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getAppointmentRecords } from "@/actions/clinical-records";
import {
  listShadowableStudents,
  listShadowingForAppointment,
} from "@/actions/shadowing";
import { Badge } from "@/components/ui/badge";
import { STATUS_VARIANT } from "@/lib/appointment-status";
import { ClinicalRecordsPanel } from "@/components/appointments/ClinicalRecordsPanel";
import { ShadowingPanel } from "@/components/appointments/ShadowingPanel";

export default function AppointmentDetailPage(
  props: PageProps<"/appointments/[appointmentId]">,
) {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
      <AppointmentDetailContent params={props.params} />
    </Suspense>
  );
}

async function AppointmentDetailContent({
  params,
}: Pick<PageProps<"/appointments/[appointmentId]">, "params">) {
  const { appointmentId } = await params;

  // A record that doesn't exist and one that exists-but-is-forbidden both
  // render the same "not found" page -- not distinguishing the two avoids
  // leaking which appointments exist to someone who can't see them.
  //
  // All three fetches run together rather than one-after-another --
  // listShadowingForAppointment and listShadowableStudents don't depend
  // on getAppointmentRecords' result, they independently re-check the
  // same underlying access rule. Sequencing them added a whole extra
  // network round trip to Neon before the page could render anything,
  // which (combined with React's transition semantics keeping the old
  // UI on screen during a refresh) made a just-saved change take
  // noticeably longer than necessary to visibly appear. listShadowing
  // ForAppointment gets its own `.catch(() => [])` here (it previously
  // had none) purely so an unauthorized caller resolves safely instead
  // of rejecting mid-Promise.all -- the notFound() below is still what
  // actually decides access, driven by `data` alone.
  const [data, shadowingAssignments, shadowableStudents] = await Promise.all([
    getAppointmentRecords(appointmentId).catch(() => null),
    listShadowingForAppointment(appointmentId).catch(() => []),
    listShadowableStudents(appointmentId).catch(() => null),
  ]);
  if (!data) notFound();

  const {
    appointment,
    canEdit,
    isShadowingStudent,
    notes,
    diagnoses,
    prescriptions,
    testOrders,
  } = data;

  const canManageShadowing = shadowableStudents !== null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/appointments"
          className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          <ArrowLeft size={16} />
          All appointments
        </Link>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">
            {appointment.patient.user.name} with Dr.{" "}
            {appointment.doctor.user.name}
          </h1>
          <Badge variant={STATUS_VARIANT[appointment.status]}>
            {appointment.status.replace("_", " ")}
          </Badge>
          {isShadowingStudent && (
            <Badge variant="outline">Shadowing — read-only</Badge>
          )}
        </div>
        <p className="mt-1 text-sm text-zinc-500">
          {appointment.department.name} —{" "}
          {new Date(appointment.scheduledAt).toLocaleString()}
        </p>
        {appointment.reason && (
          <p className="mt-2 text-sm">Reason: {appointment.reason}</p>
        )}
      </div>

      {(canManageShadowing || shadowingAssignments.length > 0) && (
        <ShadowingPanel
          appointmentId={appointment.id}
          canAssign={canManageShadowing}
          assignments={shadowingAssignments}
          shadowableStudents={shadowableStudents ?? []}
        />
      )}

      <ClinicalRecordsPanel
        appointmentId={appointment.id}
        canEdit={canEdit}
        hidePrescriptionsAndTests={isShadowingStudent}
        notes={notes}
        diagnoses={diagnoses}
        prescriptions={prescriptions}
        testOrders={testOrders}
      />
    </div>
  );
}
