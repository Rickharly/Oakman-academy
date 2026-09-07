import type { LessonStage, Question, QuestionAttempt, AiLearningObservation } from "@/generated/prisma/client";
import type { GradeResult } from "@/lib/questions/types";
import type { GradingContext } from "@/lib/grading/grade";
export { teacherModeForStage } from "./context";
export interface ChatInput { studentId: string; message: string; conversationId?: string; lessonAttemptId?: string; questionId?: string }
export interface ChatResult { conversationId: string; stream: AsyncIterable<string> }
export const teacherAgent = {
  chat: async (_input: ChatInput): Promise<ChatResult> => { throw new Error("not implemented"); },
  grade: async (_args: { question: Question; response: unknown; ctx: GradingContext }): Promise<GradeResult & { raw: unknown; model: string }> => { throw new Error("not implemented"); },
  summarizeLesson: async (_lessonAttemptId: string): Promise<{ forStudent: string; forParent: string; misconceptions: string[] }> => { throw new Error("not implemented"); },
  summarizeDay: async (_studentId: string, _dateKey: string): Promise<{ content: string; data: unknown }> => { throw new Error("not implemented"); },
  generatePractice: async (_args: { studentId: string; lessonId: string; misconception: string; count?: number }): Promise<Question[]> => { throw new Error("not implemented"); },
  identifyMisconceptions: async (_args: { studentId: string; lessonId: string; attempts: QuestionAttempt[] }): Promise<AiLearningObservation[]> => { throw new Error("not implemented"); },
};
