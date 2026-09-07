/**
 * GET /api/teacher/conversations/[id] — a student may read their own conversation;
 * a parent may read any conversation belonging to a student linked to them.
 */
import { prisma } from "@/lib/db";
import { ApiError, jsonError, requireUserApi } from "@/lib/auth/api";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const { id } = await ctx.params;
    const user = await requireUserApi(req);

    const conversation = await prisma.aiConversation.findUnique({
      where: { id },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });
    if (!conversation) throw new ApiError(404, "Conversation not found");

    if (user.role === "STUDENT") {
      if (!user.studentProfile || conversation.studentId !== user.studentProfile.id) {
        throw new ApiError(403, "Not your conversation");
      }
    } else {
      const studentProfile = await prisma.studentProfile.findUnique({
        where: { id: conversation.studentId },
        select: { userId: true },
      });
      const link = studentProfile
        ? await prisma.parentStudentLink.findUnique({
            where: { parentId_studentId: { parentId: user.id, studentId: studentProfile.userId } },
          })
        : null;
      if (!link) throw new ApiError(403, "Not linked to this student");
    }

    return Response.json({
      id: conversation.id,
      mode: conversation.mode,
      messages: conversation.messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        createdAt: m.createdAt,
      })),
    });
  } catch (err) {
    return jsonError(err);
  }
}
