import { BookOpen } from "lucide-react";
import { requireStudent } from "@/lib/auth/session";
import { EmptyState } from "@/components/ui/EmptyState";
import { ReadingRoom, type ReadingRoomEntry } from "@/components/student/ReadingRoom";
import { getNextReadingText, getReadingText } from "@/lib/reading/service";
import { prisma } from "@/lib/db";

export default async function ReadingPage({
  searchParams,
}: {
  searchParams: Promise<{ assignmentId?: string; textId?: string }>;
}) {
  const user = await requireStudent();
  const { assignmentId, textId } = await searchParams;
  const studentId = user.studentProfile.id;

  // An assignment pins the passage once one has been started, so coming back to the same
  // slot does not swap the text out from under them.
  let text = textId ? await getReadingText(textId) : null;
  if (!text && assignmentId) {
    const started = await prisma.readingEntry.findFirst({
      where: { studentId, assignmentId },
      orderBy: { submittedAt: "asc" },
      include: { readingText: true },
    });
    text = started?.readingText ?? null;
  }
  if (!text) text = await getNextReadingText(studentId);

  if (!text) {
    return (
      <EmptyState
        icon={BookOpen}
        title="Nothing left to read just yet"
        description="You've worked through everything in the library. Ask a parent to add more."
      />
    );
  }

  const previous = await prisma.readingEntry.findMany({
    where: { studentId, readingTextId: text.id },
    orderBy: { submittedAt: "asc" },
  });

  const entries: ReadingRoomEntry[] = previous.map((e) => ({
    id: e.id,
    kind: e.kind,
    prompt: e.prompt,
    response: e.response,
    feedback: e.feedback,
    score: e.score,
    maxScore: e.maxScore,
  }));

  const prompts = Array.isArray(text.prompts)
    ? (text.prompts as unknown[]).filter((p): p is string => typeof p === "string")
    : [];
  const vocabulary = Array.isArray(text.vocabulary)
    ? (text.vocabulary as unknown[]).filter(
        (v): v is { word: string; meaning: string } =>
          typeof v === "object" && v !== null && "word" in v && "meaning" in v,
      )
    : [];

  return (
    <ReadingRoom
      text={{
        id: text.id,
        title: text.title,
        author: text.author,
        genre: text.genre,
        body: text.body,
        wordCount: text.wordCount,
        estimatedMinutes: text.estimatedMinutes,
        prompts,
        essayPrompt: text.essayPrompt,
        vocabulary,
      }}
      entries={entries}
      assignmentId={assignmentId}
    />
  );
}
