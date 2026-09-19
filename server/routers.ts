import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { analyzeSource, explainImpact, getGraph, isNeo4jAvailable, seedDemo, simulateChange, type ChangeType, type SourceFile } from "./analysis";

const sourceFileSchema = z.object({ path: z.string().min(1), content: z.string() });
const changeTypeSchema = z.enum(["modify_implementation", "change_parameters", "change_return_type", "rename", "remove"]);

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  blast: router({
    demo: publicProcedure.query(() => seedDemo()),
    status: publicProcedure.query(() => ({ neo4j: isNeo4jAvailable(), explanation: Boolean(process.env.GEMINI_API_KEY) })),
    analyze: publicProcedure
      .input(z.object({ repo: z.string().optional(), slug: z.string().optional(), files: z.array(sourceFileSchema).max(180).optional() }))
      .mutation(({ input }) => analyzeSource({ repo: input.repo, slug: input.slug, files: input.files as SourceFile[] | undefined })),
    graph: publicProcedure.input(z.object({ projectId: z.string() })).query(({ input }) => getGraph(input.projectId)),
    simulate: publicProcedure.input(z.object({ projectId: z.string(), selectedId: z.string(), changeType: changeTypeSchema })).query(({ input }) => simulateChange(input.projectId, input.selectedId, input.changeType as ChangeType)),
    explain: publicProcedure.input(z.object({ result: z.any() })).query(({ input }) => explainImpact(input.result)),
  }),
});

export type AppRouter = typeof appRouter;
