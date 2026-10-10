"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileText, FlaskConical, Pill, Plus, Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  addClinicalNote,
  addDiagnosis,
  addPrescription,
  addTestOrder,
  addTestResult,
  type getAppointmentRecordsForUser,
} from "@/actions/clinical-records";

type Records = Awaited<ReturnType<typeof getAppointmentRecordsForUser>>;

export function ClinicalRecordsPanel({
  appointmentId,
  canEdit,
  hidePrescriptionsAndTests,
  notes,
  diagnoses,
  prescriptions,
  testOrders,
}: {
  appointmentId: string;
  canEdit: boolean;
  hidePrescriptionsAndTests: boolean;
} & Pick<Records, "notes" | "diagnoses" | "prescriptions" | "testOrders">) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <NotesSection
        appointmentId={appointmentId}
        canEdit={canEdit}
        notes={notes}
      />
      <DiagnosesSection
        appointmentId={appointmentId}
        canEdit={canEdit}
        diagnoses={diagnoses}
      />
      {/* A shadowing student's prescriptions/testOrders are already [] from
          the server (clinical-records.ts never queries them), but we also
          skip rendering the section itself here rather than showing a
          misleading "Nothing recorded yet" for data the student simply
          isn't allowed to see. */}
      {!hidePrescriptionsAndTests && (
        <>
          <PrescriptionsSection
            appointmentId={appointmentId}
            canEdit={canEdit}
            prescriptions={prescriptions}
          />
          <TestsSection
            appointmentId={appointmentId}
            canEdit={canEdit}
            testOrders={testOrders}
          />
        </>
      )}
    </div>
  );
}

function SectionShell({
  title,
  icon: Icon,
  canEdit,
  onAdd,
  addLabel,
  empty,
  children,
}: {
  title: string;
  icon: typeof FileText;
  canEdit: boolean;
  onAdd: () => void;
  addLabel: string;
  empty: boolean;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Icon size={16} />
          {title}
        </CardTitle>
        {canEdit && (
          <Button variant="outline" size="sm" onClick={onAdd}>
            <Plus size={14} />
            {addLabel}
          </Button>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {empty ? (
          <p className="text-sm text-zinc-500">Nothing recorded yet.</p>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}

function RecordMeta({ author, date }: { author: string; date: Date }) {
  return (
    <p className="text-xs text-zinc-500">
      {author} — {new Date(date).toLocaleString()}
    </p>
  );
}

function NotesSection({
  appointmentId,
  canEdit,
  notes,
}: {
  appointmentId: string;
  canEdit: boolean;
  notes: Records["notes"];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = String(
      new FormData(event.currentTarget).get("content") ?? "",
    );
    startTransition(async () => {
      try {
        await addClinicalNote({ appointmentId, content });
        toast.success("Note added");
        setOpen(false);
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Something went wrong",
        );
      }
    });
  }

  return (
    <>
      {/* The dialog must live outside SectionShell's children, not
          inside -- SectionShell only renders children when the list
          is non-empty, so a dialog nested in there would never mount
          (and the "Add" button would silently do nothing) the very
          first time anyone tries to add one, i.e. always, on a brand
          new appointment. Found via a real browser E2E test; curl and
          direct action-function tests never click a button, so
          neither caught it. */}
      <SectionShell
        title="Clinical Notes"
        icon={FileText}
        canEdit={canEdit}
        onAdd={() => setOpen(true)}
        addLabel="Add note"
        empty={notes.length === 0}
      >
        {notes.map((note) => (
          <div key={note.id} className="rounded-md border p-3">
            <p className="text-sm">{note.content}</p>
            <RecordMeta author={note.author.name} date={note.createdAt} />
          </div>
        ))}
      </SectionShell>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add clinical note</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Textarea name="content" required rows={5} />
            <DialogFooter>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving…" : "Save note"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function DiagnosesSection({
  appointmentId,
  canEdit,
  diagnoses,
}: {
  appointmentId: string;
  canEdit: boolean;
  diagnoses: Records["diagnoses"];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      try {
        await addDiagnosis({
          appointmentId,
          description: String(formData.get("description") ?? ""),
          icdCode: String(formData.get("icdCode") ?? "") || undefined,
        });
        toast.success("Diagnosis added");
        setOpen(false);
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Something went wrong",
        );
      }
    });
  }

  return (
    <>
      <SectionShell
        title="Diagnoses"
        icon={Stethoscope}
        canEdit={canEdit}
        onAdd={() => setOpen(true)}
        addLabel="Add diagnosis"
        empty={diagnoses.length === 0}
      >
        {diagnoses.map((diagnosis) => (
          <div key={diagnosis.id} className="rounded-md border p-3">
            <p className="text-sm">
              {diagnosis.description}
              {diagnosis.icdCode && (
                <span className="text-zinc-500"> ({diagnosis.icdCode})</span>
              )}
            </p>
            <RecordMeta
              author={diagnosis.author.name}
              date={diagnosis.createdAt}
            />
          </div>
        ))}
      </SectionShell>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add diagnosis</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" name="description" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="icdCode">ICD code (optional)</Label>
              <Input id="icdCode" name="icdCode" />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving…" : "Save diagnosis"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function PrescriptionsSection({
  appointmentId,
  canEdit,
  prescriptions,
}: {
  appointmentId: string;
  canEdit: boolean;
  prescriptions: Records["prescriptions"];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      try {
        await addPrescription({
          appointmentId,
          medication: String(formData.get("medication") ?? ""),
          dosage: String(formData.get("dosage") ?? ""),
          instructions: String(formData.get("instructions") ?? "") || undefined,
        });
        toast.success("Prescription added");
        setOpen(false);
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Something went wrong",
        );
      }
    });
  }

  return (
    <>
      <SectionShell
        title="Prescriptions"
        icon={Pill}
        canEdit={canEdit}
        onAdd={() => setOpen(true)}
        addLabel="Add prescription"
        empty={prescriptions.length === 0}
      >
        {prescriptions.map((prescription) => (
          <div key={prescription.id} className="rounded-md border p-3">
            <p className="text-sm font-medium">
              {prescription.medication} — {prescription.dosage}
            </p>
            {prescription.instructions && (
              <p className="text-sm text-zinc-500">
                {prescription.instructions}
              </p>
            )}
            <RecordMeta
              author={prescription.author.name}
              date={prescription.createdAt}
            />
          </div>
        ))}
      </SectionShell>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add prescription</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="medication">Medication</Label>
              <Input id="medication" name="medication" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="dosage">Dosage</Label>
              <Input id="dosage" name="dosage" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="instructions">Instructions (optional)</Label>
              <Textarea id="instructions" name="instructions" />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving…" : "Save prescription"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function TestsSection({
  appointmentId,
  canEdit,
  testOrders,
}: {
  appointmentId: string;
  canEdit: boolean;
  testOrders: Records["testOrders"];
}) {
  const router = useRouter();
  const [orderOpen, setOrderOpen] = useState(false);
  const [resultTarget, setResultTarget] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleOrderSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const testType = String(
      new FormData(event.currentTarget).get("testType") ?? "",
    );
    startTransition(async () => {
      try {
        await addTestOrder({ appointmentId, testType });
        toast.success("Test ordered");
        setOrderOpen(false);
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Something went wrong",
        );
      }
    });
  }

  function handleResultSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!resultTarget) return;
    const result = String(
      new FormData(event.currentTarget).get("result") ?? "",
    );
    startTransition(async () => {
      try {
        await addTestResult({ testOrderId: resultTarget, result });
        toast.success("Result recorded");
        setResultTarget(null);
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Something went wrong",
        );
      }
    });
  }

  return (
    <>
      <SectionShell
        title="Tests"
        icon={FlaskConical}
        canEdit={canEdit}
        onAdd={() => setOrderOpen(true)}
        addLabel="Order test"
        empty={testOrders.length === 0}
      >
        {testOrders.map((order) => (
          <div key={order.id} className="rounded-md border p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">{order.testType}</p>
              <span className="text-xs text-zinc-500">{order.status}</span>
            </div>
            <RecordMeta author={order.author.name} date={order.orderedAt} />
            {order.result ? (
              <div className="mt-2 rounded bg-zinc-50 p-2 text-sm dark:bg-zinc-900">
                {order.result.result}
              </div>
            ) : (
              canEdit && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => setResultTarget(order.id)}
                >
                  Enter result
                </Button>
              )
            )}
          </div>
        ))}
      </SectionShell>

      <Dialog open={orderOpen} onOpenChange={setOrderOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Order a test</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleOrderSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="testType">Test type</Label>
              <Input
                id="testType"
                name="testType"
                required
                placeholder="e.g. Complete Blood Count"
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Ordering…" : "Order test"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={resultTarget !== null}
        onOpenChange={(open) => !open && setResultTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record test result</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleResultSubmit} className="flex flex-col gap-4">
            <Textarea name="result" required rows={5} />
            <DialogFooter>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving…" : "Save result"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
