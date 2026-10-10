import { Suspense } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getActivity } from "@/actions/learning-activities";
import { Badge } from "@/components/ui/badge";
import { ACTIVITY_STATUS_VARIANT } from "@/lib/activity-status";
import { ActivityWorkflowPanel } from "@/components/activities/ActivityWorkflowPanel";
import { formatDate, formatDateTime } from "@/lib/format-date";

export default function ActivityDetailPage(
  props: PageProps<"/activities/[activityId]">,
) {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
      <ActivityDetailContent params={props.params} />
    </Suspense>
  );
}

async function ActivityDetailContent({
  params,
}: Pick<PageProps<"/activities/[activityId]">, "params">) {
  const { activityId } = await params;

  // Same not-found-masks-forbidden pattern as the appointment detail page
  // -- a non-existent activity and one you can't see both render as 404.
  const data = await getActivity(activityId).catch(() => null);
  if (!data) notFound();

  const { activity, canStart, canSubmitReflection, canGiveFeedback } = data;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/activities"
          className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          <ArrowLeft size={16} />
          All activities
        </Link>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">{activity.title}</h1>
          <Badge variant={ACTIVITY_STATUS_VARIANT[activity.status]}>
            {activity.status.replace("_", " ")}
          </Badge>
        </div>
        <p className="mt-1 text-sm text-zinc-500">
          {activity.student.user.name} — supervised by Dr.{" "}
          {activity.supervisor.user.name}
        </p>
        <p className="mt-2 text-sm">{activity.description}</p>
        {activity.dueDate && (
          <p className="mt-1 text-sm text-zinc-500">
            Due {formatDate(activity.dueDate)}
          </p>
        )}
        {activity.relatedAppointment && (
          <p className="mt-1 text-sm text-zinc-500">
            Related to the shadowed appointment on{" "}
            {formatDateTime(activity.relatedAppointment.scheduledAt)}
            {activity.relatedAppointment.reason
              ? ` (${activity.relatedAppointment.reason})`
              : ""}
          </p>
        )}
      </div>

      <ActivityWorkflowPanel
        activityId={activity.id}
        status={activity.status}
        reflection={activity.reflection}
        feedback={activity.feedback}
        canStart={canStart}
        canSubmitReflection={canSubmitReflection}
        canGiveFeedback={canGiveFeedback}
      />
    </div>
  );
}
