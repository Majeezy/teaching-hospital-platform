import { Suspense } from "react";
import { getSessionUser } from "@/lib/permissions";
import { listAppointments, listDoctorsForBooking } from "@/actions/appointments";
import { AppointmentsTable } from "@/components/appointments/AppointmentsTable";
import { RequestAppointmentDialog } from "@/components/appointments/RequestAppointmentDialog";

export default function AppointmentsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <AppointmentsContent />
    </Suspense>
  );
}

async function AppointmentsContent() {
  const user = await getSessionUser();
  if (!user) return null; // layout already redirects; satisfies types here

  const isPatient = user.roles.includes("PATIENT");
  const [appointments, doctors] = await Promise.all([
    listAppointments(),
    isPatient ? listDoctorsForBooking() : Promise.resolve([]),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold">Appointments</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isPatient
              ? "Your appointments."
              : "Appointments you're involved in."}
          </p>
        </div>
        {isPatient && <RequestAppointmentDialog doctors={doctors} />}
      </div>
      <AppointmentsTable appointments={appointments} viewerRoles={user.roles} />
    </div>
  );
}
