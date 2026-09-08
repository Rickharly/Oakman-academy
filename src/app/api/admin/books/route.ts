import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { jsonError } from "@/lib/auth/api";
import { requireParent } from "@/lib/auth/session";
import { bookCandidateSchema, deactivateBook, importBook, setActiveBook } from "@/lib/books/import";

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("import"), title: z.string().min(1) }),
  z.object({ action: z.literal("activate"), bookId: z.string().min(1) }),
  z.object({ action: z.literal("deactivate"), bookId: z.string().min(1) }),
]);

export async function POST(req: Request) {
  try {
    await requireParent();
    const body = bodySchema.parse(await req.json());

    if (body.action === "activate") {
      const book = await setActiveBook(body.bookId);
      return Response.json({ ok: true, active: book.title });
    }
    if (body.action === "deactivate") {
      await deactivateBook(body.bookId);
      return Response.json({ ok: true });
    }

    const file = path.resolve(process.cwd(), "fixtures/books/candidates.json");
    const candidates = z.array(bookCandidateSchema).parse(JSON.parse(fs.readFileSync(file, "utf8")));
    const candidate = candidates.find((c) => c.title === body.title);
    if (!candidate) return Response.json({ error: "Not in the candidate list" }, { status: 404 });

    const result = await importBook(candidate);
    return Response.json({ ok: true, chapters: result.chapters });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return Response.json({ error: "Unrecognised request" }, { status: 400 });
    }
    // The download is the step most likely to fail; the reason is worth showing the parent.
    if (err instanceof Error) return Response.json({ error: err.message }, { status: 502 });
    return jsonError(err);
  }
}
