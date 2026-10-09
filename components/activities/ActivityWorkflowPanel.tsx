"use client";

import { FormEvent, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { NotebookPen, MessageSquare, PlayCircle, Star } from "lucide-react";
import type { LearningActivityStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  giveFeedback,
  startActivity,
  submitReflection,
  type getActivityForUser,
} from "@/actions/learning-activities";

type ActivityData = Awaited<ReturnType<typeof getActivityForUser>>;

export function ActivityWorkflowPanel({
  activityId,
  status,
  reflection,
  feedback,
  canStart,
  canSubmitReflection,
  canGiveFeedback,
}: {
  activityId: string;
  status: LearningActivityStatus;
  reflection: ActivityData["activity"]["reflection"];
  feedback: ActivityData["activity"]["feedback"];
  canStart: boolean;
  canSubmitReflection: boolean;
  canGiveFeedback: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleStart() {
    startTransition(async () => {
      try {
        await startActivity(activityId);
        toast.success("Activity started");
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Something went wrong",
        );
      }
    });
  }

  function handleReflectionSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = String(
      new FormData(event.currentTarget).get("content") ?? "",
    );
    startTransition(async () => {
      try {
        await submitReflection({ learningActivityId: activityId, content });
        toast.success("Reflection submitted");
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Something went wrong",
        );
      }
    });
  }

  function handleFeedbackSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const rating = String(formData.get("rating") ?? "");
    startTransition(async () => {
      try {
        await giveFeedback({
          learningActivityId: activityId,
          rating: rating ? Number(rating) : undefined,
          strengths: String(formData.get("strengths") ?? "") || undefined,
          areasForImprovement:
            String(formData.get("areasForImprovement") ?? "") || undefined,
          recommendedActivities:
            String(formData.get("recommendedActivities") ?? "") || undefined,
        });
        toast.success("Feedback recorded");
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Something went wrong",
        );
      }
    });
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <NotebookPen size={16} />
            Reflection
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {reflection ? (
            <div className="rounded-md border p-3">
              <p className="text-sm">{reflection.content}</p>
              <p className="mt-1 text-xs text-zinc-500">
                Submitted {new Date(reflection.submittedAt).toLocaleString()}
              </p>
            </div>
          ) : (
            <>
              {canStart && status === "ASSIGNED" && (
                <Button
                  variant="outline"
                  size="sm"
                  className="self-start"
                  onClick={handleStart}
                  disabled={isPending}
                >
                  <PlayCircle size={14} />
                  Start activity
                </Button>
              )}
              {canSubmitReflection ? (
                <form
                  onSubmit={handleReflectionSubmit}
                  className="flex flex-col gap-3"
                >
                  <Textarea
                    name="content"
                    required
                    rows={5}
                    placeholder="What did you observe or learn from this activity?"
                  />
                  <Button type="submit" disabled={isPending} className="self-start">
                    {isPending ? "Submitting…" : "Submit reflection"}
                  </Button>
                </form>
              ) : (
                <p className="text-sm text-zinc-500">
                  No reflection submitted yet.
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <MessageSquare size={16} />
            Supervisor Feedback
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {feedback.length > 0 ? (
            feedback.map((entry) => (
              <div key={entry.id} className="rounded-md border p-3">
                {entry.rating && (
                  <p className="flex items-center gap-1 text-sm font-medium">
                    {Array.from({ length: entry.rating }).map((_, i) => (
                      <Star key={i} size={14} className="fill-current" />
                    ))}
                  </p>
                )}
                {entry.strengths && (
                  <p className="mt-1 text-sm">
                    <span className="font-medium">Strengths: </span>
                    {entry.strengths}
                  </p>
                )}
                {entry.areasForImprovement && (
                  <p className="mt-1 text-sm">
                    <span className="font-medium">Areas for improvement: </span>
                    {entry.areasForImprovement}
                  </p>
                )}
                {entry.recommendedActivities && (
                  <p className="mt-1 text-sm">
                    <span className="font-medium">Recommended next: </span>
                    {entry.recommendedActivities}
                  </p>
                )}
                <p className="mt-1 text-xs text-zinc-500">
                  {new Date(entry.createdAt).toLocaleString()}
                </p>
              </div>
            ))
          ) : canGiveFeedback ? (
            <form onSubmit={handleFeedbackSubmit} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="rating">Rating (optional)</Label>
                <Select name="rating">
                  <SelectTrigger id="rating">
                    <SelectValue placeholder="No rating" />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n} star{n > 1 ? "s" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="strengths">Strengths</Label>
                <Textarea id="strengths" name="strengths" rows={2} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="areasForImprovement">
                  Areas for improvement
                </Label>
                <Textarea
                  id="areasForImprovement"
                  name="areasForImprovement"
                  rows={2}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="recommendedActivities">
                  Recommended next activities
                </Label>
                <Textarea
                  id="recommendedActivities"
                  name="recommendedActivities"
                  rows={2}
                />
              </div>
              <Button type="submit" disabled={isPending} className="self-start">
                {isPending ? "Saving…" : "Record feedback"}
              </Button>
            </form>
          ) : (
            <p className="text-sm text-zinc-500">
              {status === "COMPLETED"
                ? "Awaiting supervisor feedback."
                : "No feedback yet."}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
