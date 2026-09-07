import { notFound } from "next/navigation";
import { Bot, User, Wrench, Terminal } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { requireParentOfStudent } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

const ROLE_ICON = { USER: User, ASSISTANT: Bot, SYSTEM: Terminal, TOOL: Wrench } as const;
const ROLE_LABEL = { USER: "Student", ASSISTANT: "AI teacher", SYSTEM: "System", TOOL: "Tool" } as const;

export default async function AdminConversationPage({
  params,
}: {
  params: Promise<{ studentId: string; conversationId: string }>;
}) {
  const { studentId, conversationId } = await params;
  const { student } = await requireParentOfStudent(studentId);

  const conversation = await prisma.aiConversation.findUnique({
    where: { id: conversationId },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
      lesson: true,
    },
  });
  if (!conversation || conversation.studentId !== studentId) notFound();

  return (
    <>
      <PageHeader
        title={conversation.title ?? "Teacher conversation"}
        description={`${student.user.displayName}${conversation.lesson ? ` · ${conversation.lesson.title}` : ""}`}
        actions={<Badge tone="accent">{conversation.mode}</Badge>}
      />

      {conversation.summary ? (
        <Card padding="md" className="mb-6">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted mb-1">Rolling summary</p>
          <p className="text-sm text-ink">{conversation.summary}</p>
        </Card>
      ) : null}

      <div className="space-y-4">
        {conversation.messages.map((m) => {
          const Icon = ROLE_ICON[m.role];
          const toolCalls = m.toolCalls as unknown[] | null;
          return (
            <Card key={m.id} padding="md" className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-sm font-medium text-ink">
                  <Icon className="h-4 w-4 text-ink-muted" />
                  {ROLE_LABEL[m.role]}
                </span>
                <span className="text-xs text-ink-muted">{m.createdAt.toLocaleString("en-GB")}</span>
              </div>
              <p className="whitespace-pre-wrap text-sm text-ink">{m.content}</p>

              {toolCalls && toolCalls.length > 0 ? (
                <details className="rounded-lg bg-stone-50 p-3">
                  <summary className="cursor-pointer text-xs font-medium text-ink-muted">
                    {toolCalls.length} tool call{toolCalls.length === 1 ? "" : "s"}
                  </summary>
                  <pre className="mt-2 overflow-x-auto text-xs text-ink-muted">{JSON.stringify(toolCalls, null, 2)}</pre>
                </details>
              ) : null}

              {m.contextSnapshot ? (
                <details className="rounded-lg bg-stone-50 p-3">
                  <summary className="cursor-pointer text-xs font-medium text-ink-muted">Context sent to the AI</summary>
                  <pre className="mt-2 overflow-x-auto text-xs text-ink-muted">{JSON.stringify(m.contextSnapshot, null, 2)}</pre>
                </details>
              ) : null}

              {m.model ? (
                <p className="text-xs text-ink-faint">
                  {m.model}
                  {m.tokensIn != null ? ` · ${m.tokensIn} in / ${m.tokensOut ?? 0} out tokens` : ""}
                </p>
              ) : null}
            </Card>
          );
        })}
      </div>
    </>
  );
}
