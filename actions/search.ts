"use server";

import { requireUser, hasAnyRole, hasRole, type SessionUser } from "@/lib/permissions";
import { listPatientsForUser } from "@/actions/patients";
import { listStaffForUser } from "@/actions/staff";
import { listStudentsForUser } from "@/actions/students";
import {
  listAppointmentsForUser,
  listDoctorsForBookingForUser,
} from "@/actions/appointments";
import { listSupervisedStudentsForUser } from "@/actions/learning-activities";
import { listPlacementsForUser } from "@/actions/placements";

export type SearchResultItem = {
  id: string;
  label: string;
  sublabel: string;
  href: string;
};

export type SearchResultGroup = {
  category: string;
  items: SearchResultItem[];
};

const RESULTS_PER_CATEGORY = 5;

function matches(query: string, ...fields: (string | null | undefined)[]) {
  const needle = query.toLowerCase();
  return fields.some((field) => field?.toLowerCase().includes(needle));
}

/**
 * Every category here is a name-filtered pass over a result set an
 * existing, already-authorized list action already returns in full --
 * there is no new unscoped query anywhere in this file. A nurse's
 * search can't surface more than their own department's appointments
 * already show on /appointments; an admin's "Patients" search can't
 * surface more than /admin/patients already shows. Filtering happens
 * in application code after the fetch, not by writing a new WHERE
 * clause that could drift from the one the list page already enforces.
 */
export async function searchForUser(
  user: SessionUser,
  rawQuery: string,
): Promise<SearchResultGroup[]> {
  const query = rawQuery.trim();
  if (query.length < 2) return [];

  const groups: SearchResultGroup[] = [];
  const isAdmin = hasAnyRole(user, ["HOSPITAL_ADMIN", "SYSTEM_ADMIN"]);

  if (isAdmin) {
    const [patients, staff, students] = await Promise.all([
      listPatientsForUser(user),
      listStaffForUser(user),
      listStudentsForUser(user),
    ]);

    groups.push({
      category: "Patients",
      items: patients
        .filter((p) => matches(query, p.name, p.email))
        .slice(0, RESULTS_PER_CATEGORY)
        .map((p) => ({
          id: p.id,
          label: p.name,
          sublabel: p.email,
          href: "/admin/patients",
        })),
    });

    groups.push({
      category: "Staff",
      items: staff
        .filter((s) => matches(query, s.name, s.email))
        .slice(0, RESULTS_PER_CATEGORY)
        .map((s) => ({
          id: s.id,
          label: s.name,
          sublabel: s.email,
          href: "/admin/staff",
        })),
    });

    groups.push({
      category: "Students",
      items: students
        .filter((s) => matches(query, s.name, s.email, s.studentProfile?.studentNumber))
        .slice(0, RESULTS_PER_CATEGORY)
        .map((s) => ({
          id: s.id,
          label: s.name,
          sublabel: s.studentProfile?.studentNumber ?? s.email,
          href: "/admin/students",
        })),
    });
  }

  if (hasRole(user, "DOCTOR")) {
    const supervisedStudents = await listSupervisedStudentsForUser(user).catch(
      () => [],
    );
    groups.push({
      category: "My Students",
      items: supervisedStudents
        .filter((s) => matches(query, s.user.name, s.studentNumber))
        .slice(0, RESULTS_PER_CATEGORY)
        .map((s) => ({
          id: s.id,
          label: s.user.name,
          sublabel: s.studentNumber,
          href: "/placements",
        })),
    });
  }

  if (hasRole(user, "PATIENT")) {
    const doctors = await listDoctorsForBookingForUser(user);
    groups.push({
      category: "Doctors",
      items: doctors
        .filter((d) => matches(query, d.user.name, d.specialization, d.department.name))
        .slice(0, RESULTS_PER_CATEGORY)
        .map((d) => ({
          id: d.id,
          label: `Dr. ${d.user.name}`,
          sublabel: `${d.specialization} — ${d.department.name}`,
          href: "/appointments",
        })),
    });
  }

  if (hasRole(user, "STUDENT")) {
    const placements = await listPlacementsForUser(user);
    groups.push({
      category: "My Placements",
      items: placements
        .filter((p) =>
          matches(query, p.supervisor.user.name, p.department.name),
        )
        .slice(0, RESULTS_PER_CATEGORY)
        .map((p) => ({
          id: p.id,
          label: `Dr. ${p.supervisor.user.name}`,
          sublabel: p.department.name,
          href: "/placements",
        })),
    });
  }

  const appointments = await listAppointmentsForUser(user).catch(() => []);
  groups.push({
    category: "Appointments",
    items: appointments
      .filter((a) =>
        matches(
          query,
          a.patient.user.name,
          a.doctor.user.name,
          a.department.name,
          a.reason,
        ),
      )
      .slice(0, RESULTS_PER_CATEGORY)
      .map((a) => ({
        id: a.id,
        label: `${a.patient.user.name} with Dr. ${a.doctor.user.name}`,
        sublabel: new Date(a.scheduledAt).toLocaleString(),
        href: `/appointments/${a.id}`,
      })),
  });

  return groups.filter((group) => group.items.length > 0);
}

// Thin wrapper -- the actual "use server" entry point called from the UI.

export async function search(query: string) {
  const user = await requireUser();
  return searchForUser(user, query);
}
