import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { createAnalysisHistory, getAnalysisHistory, getAnalysisHistoryById } from "./db";

function runPython(args: string[], input: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const projectPython = path.join(process.cwd(), ".venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
    const python = process.env.PYTHON_BIN || (existsSync(projectPython) ? projectPython : "python3");
    const child = spawn(python, ["scripts/analyze_reviews.py", ...args], { cwd: process.cwd() });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", chunk => { stdout += chunk.toString(); });
    child.stderr.on("data", chunk => { stderr += chunk.toString(); });
    child.on("error", reject);
    child.on("close", code => {
      try {
        const parsed = JSON.parse(stdout);
        if (parsed.error) return reject(new Error(parsed.error));
        if (code !== 0) return reject(new Error(stderr || "Python analysis failed."));
        resolve(parsed);
      } catch {
        reject(new Error(stderr || "The analysis engine returned invalid output."));
      }
    });
    child.stdin.end(input);
  });
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  sentiment: router({
    analyzeCsv: publicProcedure
      .input(z.object({ csv: z.string().min(20, "Please upload a CSV file."), datasetName: z.string().min(1).max(255).default("IMDb review dataset") }))
      .mutation(async ({ input, ctx }) => {
        const result = await runPython([], input.csv) as any;
        await createAnalysisHistory({
          ownerOpenId: ctx.user?.openId || "anonymous",
          datasetName: input.datasetName,
          totalReviews: result.metrics.total,
          accuracy: result.metrics.accuracy,
          macroF1: result.metrics.macroF1,
          positiveCount: result.metrics.predictedCounts.positive || 0,
          neutralCount: result.metrics.predictedCounts.neutral || 0,
          negativeCount: result.metrics.predictedCounts.negative || 0,
          matrixJson: JSON.stringify(result.matrix),
        });
        return result;
      }),
    listHistory: publicProcedure.query(({ ctx }) => getAnalysisHistory(ctx.user?.openId || "anonymous")),
    getHistory: publicProcedure.input(z.object({ id: z.number().int().positive() })).query(({ input, ctx }) => getAnalysisHistoryById(input.id, ctx.user?.openId || "anonymous")),
    compareHistory: publicProcedure.input(z.object({ ids: z.array(z.number().int().positive()).length(2) })).query(async ({ input, ctx }) => {
      const owner = ctx.user?.openId || "anonymous";
      const records = await Promise.all(input.ids.map(id => getAnalysisHistoryById(id, owner)));
      if (records.some(record => !record)) throw new Error("One or more history records could not be found.");
      return records;
    }),
    analyzeOne: publicProcedure
      .input(z.object({ review: z.string().min(1, "Enter a review to analyze.").max(10000) }))
      .mutation(async ({ input }) => runPython(["--single"], input.review)),
  }),
});

export type AppRouter = typeof appRouter;
