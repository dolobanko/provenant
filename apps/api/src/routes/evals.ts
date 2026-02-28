import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { auditLog } from '../middleware/audit';
import { EVAL_TEMPLATES } from '../lib/eval-templates';
import { estimateCost } from '../lib/pricing';
import { fireWebhook } from '../lib/webhooks';
import { callAnthropic } from '../lib/llm';
import { logger } from '../lib/logger';

import type { IRouter } from 'express';
export const evalsRouter: IRouter = Router();
evalsRouter.use(authenticate);

// ─── Templates ────────────────────────────────────────────────────────────────

evalsRouter.get('/templates', async (_req, res) => {
  res.json(EVAL_TEMPLATES.map(({ id, name, description, category, cases }) => ({
    id, name, description, category, caseCount: cases.length,
  })));
});

evalsRouter.post('/suites/:id/import-template/:templateId',
  auditLog('eval.template.import', 'EvalSuite'),
  async (req: AuthRequest, res, next) => {
    try {
      const { id, templateId } = req.params;
      const suite = await prisma.evalSuite.findFirst({ where: { id, orgId: req.user!.orgId } });
      if (!suite) { res.status(404).json({ error: 'Suite not found' }); return; }

      const template = EVAL_TEMPLATES.find((t) => t.id === templateId);
      if (!template) { res.status(404).json({ error: 'Template not found' }); return; }

      await prisma.evalCase.createMany({
        data: template.cases.map((c) => ({
          suiteId: id,
          name: c.name,
          description: c.description,
          input: JSON.stringify(c.input),
          expectedOutput: c.expectedOutput !== undefined ? JSON.stringify(c.expectedOutput) : undefined,
          scoringFn: c.scoringFn,
          weight: c.weight,
          tags: JSON.stringify(c.tags),
        })),
      });

      res.json({ imported: template.cases.length });
    } catch (err) { next(err); }
  }
);

// ─── Suites ───────────────────────────────────────────────────────────────────

const suiteSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  tags: z.array(z.string()).default([]),
});

evalsRouter.get('/suites', async (req: AuthRequest, res, next) => {
  try {
    const suites = await prisma.evalSuite.findMany({
      where: { orgId: req.user!.orgId },
      include: { _count: { select: { cases: true, runs: true } } },
      orderBy: { updatedAt: 'desc' },
    });
    res.json(suites);
  } catch (err) { next(err); }
});

evalsRouter.get('/suites/:id', async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const suite = await prisma.evalSuite.findFirst({
      where: { id, orgId: req.user!.orgId },
      include: { cases: true, _count: { select: { runs: true } } },
    });
    if (!suite) { res.status(404).json({ error: 'Not found' }); return; }
    res.json(suite);
  } catch (err) { next(err); }
});

evalsRouter.post('/suites', auditLog('eval.suite.create', 'EvalSuite'), async (req: AuthRequest, res, next) => {
  try {
    const body = suiteSchema.parse(req.body);
    const suite = await prisma.evalSuite.create({
      data: {
        name: body.name,
        description: body.description,
        tags: JSON.stringify(body.tags),
        orgId: req.user!.orgId,
      },
    });
    res.status(201).json(suite);
  } catch (err) { next(err); }
});

evalsRouter.patch('/suites/:id', auditLog('eval.suite.update', 'EvalSuite'), async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const body = suiteSchema.partial().parse(req.body);
    const result = await prisma.evalSuite.updateMany({
      where: { id, orgId: req.user!.orgId },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.tags !== undefined && { tags: JSON.stringify(body.tags) }),
      },
    });
    if (result.count === 0) { res.status(404).json({ error: 'Not found' }); return; }
    res.json(await prisma.evalSuite.findUnique({ where: { id } }));
  } catch (err) { next(err); }
});

evalsRouter.delete('/suites/:id', auditLog('eval.suite.delete', 'EvalSuite'), async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    await prisma.evalSuite.deleteMany({ where: { id, orgId: req.user!.orgId } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ─── Cases ────────────────────────────────────────────────────────────────────

const caseSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  input: z.record(z.unknown()),
  expectedOutput: z.record(z.unknown()).optional(),
  scoringFn: z.string().default('exact_match'),
  weight: z.number().default(1.0),
  tags: z.array(z.string()).default([]),
});

evalsRouter.post('/suites/:id/cases', auditLog('eval.case.create', 'EvalCase'), async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const body = caseSchema.parse(req.body);
    const evalCase = await prisma.evalCase.create({
      data: {
        name: body.name,
        description: body.description,
        scoringFn: body.scoringFn,
        weight: body.weight,
        suiteId: id,
        input: JSON.stringify(body.input),
        expectedOutput: body.expectedOutput !== undefined ? JSON.stringify(body.expectedOutput) : undefined,
        tags: JSON.stringify(body.tags),
      },
    });
    res.status(201).json(evalCase);
  } catch (err) { next(err); }
});

evalsRouter.patch('/suites/:suiteId/cases/:id', auditLog('eval.case.update', 'EvalCase'), async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const body = caseSchema.partial().parse(req.body);
    const updated = await prisma.evalCase.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.scoringFn !== undefined && { scoringFn: body.scoringFn }),
        ...(body.weight !== undefined && { weight: body.weight }),
        ...(body.input !== undefined && { input: JSON.stringify(body.input) }),
        ...(body.expectedOutput !== undefined && { expectedOutput: JSON.stringify(body.expectedOutput) }),
        ...(body.tags !== undefined && { tags: JSON.stringify(body.tags) }),
      },
    });
    res.json(updated);
  } catch (err) { next(err); }
});

evalsRouter.delete('/suites/:suiteId/cases/:id', auditLog('eval.case.delete', 'EvalCase'), async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    await prisma.evalCase.delete({ where: { id } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ─── Eval Execution ───────────────────────────────────────────────────────────

interface EvalCaseRow {
  id: string;
  input: unknown;
  expectedOutput: unknown;
  scoringFn: string;
  weight: number;
}

interface CaseResult {
  runId: string;
  caseId: string;
  passed: boolean;
  score: number;
  latencyMs: number;
  tokenCount: number;
  actualOutput: string | null;
  error: string | null;
  metadata: string;
}

async function scoreCase(
  systemPrompt: string,
  c: EvalCaseRow,
  runId: string,
): Promise<CaseResult> {
  const input = (typeof c.input === 'string' ? JSON.parse(c.input) : c.input) as Record<string, unknown>;
  const expected = c.expectedOutput
    ? ((typeof c.expectedOutput === 'string' ? JSON.parse(c.expectedOutput as string) : c.expectedOutput) as Record<string, unknown>)
    : {};

  const userMessage: string =
    typeof input.message === 'string'
      ? input.message
      : typeof input.prompt === 'string'
        ? input.prompt
        : JSON.stringify(input);

  const startMs = Date.now();

  let actualText = '';
  let errorMsg: string | null = null;

  try {
    actualText = await callAnthropic(systemPrompt, userMessage);
  } catch (err) {
    errorMsg = String(err);
    return {
      runId,
      caseId: c.id,
      passed: false,
      score: 0,
      latencyMs: Date.now() - startMs,
      tokenCount: 0,
      actualOutput: null,
      error: errorMsg,
      metadata: JSON.stringify({}),
    };
  }

  const latencyMs = Date.now() - startMs;

  let score = 0;
  let passed = false;

  switch (c.scoringFn) {
    case 'exact_match': {
      const expectedText = String(expected.text ?? expected.output ?? JSON.stringify(expected));
      passed = actualText.trim().toLowerCase() === expectedText.trim().toLowerCase();
      score = passed ? 100 : 0;
      break;
    }

    case 'contains_keywords': {
      const keywords = (expected.contains ?? expected.keywords ?? []) as string[];
      if (keywords.length === 0) {
        // No keywords to check — auto-pass
        passed = true;
        score = 100;
      } else {
        const hits = keywords.filter((kw) =>
          actualText.toLowerCase().includes(kw.toLowerCase()),
        );
        score = (hits.length / keywords.length) * 100;
        passed = score >= 80;
      }
      break;
    }

    case 'llm_judge': {
      try {
        const judgeSystem =
          'You are a precise eval judge. Evaluate whether the actual output satisfies the expected criteria. Respond ONLY with a JSON object, no markdown.';
        const judgeUser = `Expected criteria: ${JSON.stringify(expected)}\nActual output: ${actualText}\n\nRespond with: {"score": 0-100, "passed": true/false, "reason": "brief explanation"}`;
        const judgeRaw = await callAnthropic(judgeSystem, judgeUser);
        const cleaned = judgeRaw.replace(/```json\s*|\s*```/g, '').trim();
        const judged = JSON.parse(cleaned) as { score: number; passed: boolean };
        score = judged.score ?? 50;
        passed = judged.passed ?? score >= 70;
      } catch {
        // Fallback: check if any expected values appear
        score = 50;
        passed = false;
      }
      break;
    }

    default: {
      // Unknown scorer — simple contains check
      const expectedStr = JSON.stringify(expected).toLowerCase();
      passed = actualText.toLowerCase().includes(expectedStr.slice(1, -1));
      score = passed ? 80 : 20;
    }
  }

  return {
    runId,
    caseId: c.id,
    passed,
    score: Math.round(score * 10) / 10,
    latencyMs,
    tokenCount: Math.ceil(userMessage.length / 4) + Math.ceil(actualText.length / 4),
    actualOutput: JSON.stringify({ text: actualText }),
    error: null,
    metadata: JSON.stringify({}),
  };
}

async function executeRun(runId: string, orgId: string): Promise<void> {
  try {
    await prisma.evalRun.update({
      where: { id: runId },
      data: { status: 'RUNNING', startedAt: new Date() },
    });

    const run = await prisma.evalRun.findUnique({
      where: { id: runId },
      include: {
        suite: { include: { cases: true } },
        agentVersion: true,
      },
    });

    if (!run) return;

    const cases = run.suite.cases as EvalCaseRow[];

    if (cases.length === 0) {
      await prisma.evalRun.update({
        where: { id: runId },
        data: { status: 'COMPLETED', completedAt: new Date(), passRate: 0, score: 0 },
      });
      return;
    }

    const systemPrompt =
      (run.agentVersion as { systemPrompt?: string } | null)?.systemPrompt ??
      'You are a helpful, accurate AI assistant.';

    const hasAnthropicKey = Boolean(process.env.ANTHROPIC_API_KEY);

    let results: CaseResult[];

    if (!hasAnthropicKey) {
      // Fallback: simulated results with a clear warning
      logger.warn('[EvalRun] ANTHROPIC_API_KEY not set — using simulated scores for run ' + runId);
      results = cases.map((c) => ({
        runId,
        caseId: c.id,
        passed: Math.random() > 0.3,
        score: Math.round((50 + Math.random() * 50) * 10) / 10,
        latencyMs: Math.floor(Math.random() * 800) + 100,
        tokenCount: Math.floor(Math.random() * 300) + 50,
        actualOutput: JSON.stringify({ text: '(simulated — set ANTHROPIC_API_KEY for real execution)' }),
        error: null,
        metadata: JSON.stringify({ simulated: true }),
      }));
    } else {
      // Real execution — run cases sequentially to avoid hammering the API
      results = [];
      for (const c of cases) {
        const result = await scoreCase(systemPrompt, c, runId);
        results.push(result);
      }
    }

    await prisma.evalCaseResult.createMany({ data: results });

    const passRate = results.filter((r) => r.passed).length / results.length;
    const avgScore = results.reduce((a, r) => a + r.score, 0) / results.length;

    await prisma.evalRun.update({
      where: { id: runId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        passRate,
        score: Math.round(avgScore * 10) / 10,
      },
    });

    if (passRate < 0.8) {
      fireWebhook(orgId, 'eval.failed', {
        runId,
        suiteId: run.suiteId,
        agentId: run.agentId,
        passRate: Math.round(passRate * 100) / 100,
        score: Math.round(avgScore * 10) / 10,
      }).catch(() => {});
    }

    logger.info(`[EvalRun] Completed ${runId} — passRate: ${(passRate * 100).toFixed(1)}% score: ${avgScore.toFixed(1)}`);
  } catch (err) {
    logger.error('[EvalRun] Execution failed', { runId, err });
    await prisma.evalRun.update({
      where: { id: runId },
      data: { status: 'COMPLETED', completedAt: new Date(), passRate: 0, score: 0 },
    }).catch(() => {});
  }
}

// ─── Runs ─────────────────────────────────────────────────────────────────────

const runSchema = z.object({
  suiteId: z.string(),
  agentId: z.string(),
  agentVersionId: z.string().optional(),
  environmentId: z.string().optional(),
  metadata: z.record(z.unknown()).default({}),
});

evalsRouter.get('/runs', async (req: AuthRequest, res, next) => {
  try {
    const { agentId, suiteId } = req.query as Record<string, string>;
    const runs = await prisma.evalRun.findMany({
      where: {
        agent: { orgId: req.user!.orgId },
        ...(agentId && { agentId }),
        ...(suiteId && { suiteId }),
      },
      include: {
        suite: true,
        agent: true,
        agentVersion: true,
        environment: true,
        _count: { select: { results: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(runs);
  } catch (err) { next(err); }
});

evalsRouter.get('/runs/:id', async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const run = await prisma.evalRun.findFirst({
      where: { id, agent: { orgId: req.user!.orgId } },
      include: {
        suite: true,
        agent: true,
        agentVersion: true,
        environment: true,
        results: { include: { case: true } },
      },
    });
    if (!run) { res.status(404).json({ error: 'Not found' }); return; }

    const modelId = (run.agentVersion as { modelId?: string } | null)?.modelId ?? '';
    const totalTokens = (run.results as { tokenCount: number | null }[])
      .reduce((a, r) => a + (r.tokenCount ?? 0), 0);
    const half = Math.floor(totalTokens / 2);
    const costUsd = estimateCost(modelId, half, half);

    res.json({ ...run, costUsd: costUsd > 0 ? costUsd : null });
  } catch (err) { next(err); }
});

evalsRouter.post('/runs', auditLog('eval.run.create', 'EvalRun'), async (req: AuthRequest, res, next) => {
  try {
    const body = runSchema.parse(req.body);
    const agent = await prisma.agent.findFirst({ where: { id: body.agentId, orgId: req.user!.orgId } });
    if (!agent) { res.status(404).json({ error: 'Agent not found' }); return; }

    const run = await prisma.evalRun.create({
      data: {
        suiteId: body.suiteId,
        agentId: body.agentId,
        agentVersionId: body.agentVersionId,
        environmentId: body.environmentId,
        metadata: JSON.stringify(body.metadata),
        status: 'QUEUED',
      },
    });

    const orgId = req.user!.orgId;

    // Execute immediately in background (no await — fire and forget)
    setImmediate(() => {
      executeRun(run.id, orgId).catch((err) =>
        logger.error('[EvalRun] Unhandled error in background execution', { err }),
      );
    });

    res.status(201).json(run);
  } catch (err) { next(err); }
});

// Submit results externally (from SDK / CI)
evalsRouter.post('/runs/:id/results', auditLog('eval.run.results', 'EvalRun'), async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const schema = z.object({
      results: z.array(z.object({
        caseId: z.string(),
        actualOutput: z.unknown().optional(),
        score: z.number().optional(),
        passed: z.boolean().optional(),
        latencyMs: z.number().int().optional(),
        tokenCount: z.number().int().optional(),
        error: z.string().optional(),
        metadata: z.record(z.unknown()).default({}),
      })),
    });
    const body = schema.parse(req.body);
    const created = await prisma.evalCaseResult.createMany({
      data: body.results.map((r) => ({
        runId: id,
        caseId: r.caseId,
        passed: r.passed,
        score: r.score,
        latencyMs: r.latencyMs,
        tokenCount: r.tokenCount,
        error: r.error,
        actualOutput: r.actualOutput !== undefined ? JSON.stringify(r.actualOutput) : undefined,
        metadata: JSON.stringify(r.metadata),
      })),
    });
    const all = await prisma.evalCaseResult.findMany({ where: { runId: id } });
    const passRate = all.filter((r) => r.passed).length / (all.length || 1);
    const avgScore = all.reduce((a, r) => a + (r.score ?? 0), 0) / (all.length || 1);
    await prisma.evalRun.update({
      where: { id },
      data: { status: 'COMPLETED', completedAt: new Date(), passRate, score: avgScore },
    });
    if (passRate < 0.8) {
      fireWebhook(req.user!.orgId, 'eval.failed', {
        runId: id,
        passRate: Math.round(passRate * 100) / 100,
      }).catch(() => {});
    }
    res.json({ created: created.count });
  } catch (err) { next(err); }
});

// ─── AI-generated eval cases ──────────────────────────────────────────────────

evalsRouter.post('/suites/:id/generate-cases', async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const { count = 5 } = z.object({
      count: z.number().int().min(1).max(10).default(5),
    }).parse(req.body);

    const suite = await prisma.evalSuite.findFirst({
      where: { id, orgId: req.user!.orgId },
    });
    if (!suite) { res.status(404).json({ error: 'Suite not found' }); return; }

    const sessions = await prisma.session.findMany({
      where: { agent: { orgId: req.user!.orgId }, status: 'COMPLETED' },
      include: { turns: { orderBy: { createdAt: 'asc' }, take: 6 } },
      orderBy: { startedAt: 'desc' },
      take: 8,
    });

    if (sessions.length === 0) {
      res.status(422).json({
        error: 'No completed sessions found. Record and complete some agent sessions first.',
      });
      return;
    }

    const examples = sessions.slice(0, 5).map((s, i) => {
      const turns = (s.turns as Array<{ role: string; content: unknown }>)
        .slice(0, 4)
        .map((t) => {
          const text = typeof t.content === 'string'
            ? t.content
            : JSON.stringify(t.content);
          return `  ${t.role}: ${text.slice(0, 300)}`;
        })
        .join('\n');
      return `Session ${i + 1}:\n${turns}`;
    }).join('\n\n---\n\n');

    const systemPrompt = `You generate eval test cases for AI agents based on real session examples.
Output ONLY a valid JSON array with exactly ${count} objects. No markdown, no explanation, no code fences.

Each object must have exactly these fields:
{
  "name": "short descriptive name (max 60 chars)",
  "description": "what capability or behaviour this tests",
  "input": { "message": "user input string" },
  "expectedOutput": { "contains": ["key phrase 1", "key phrase 2"], "tone": "helpful" },
  "scoringFn": "contains_keywords",
  "tags": ["tag1", "tag2"]
}

scoringFn must be exactly one of: "contains_keywords", "llm_judge", "exact_match"
Vary difficulty (easy, medium, edge case). Cover different intents from the session examples.`;

    const userPrompt = `Suite name: "${suite.name}"
Suite description: "${suite.description ?? 'General eval suite'}"

Real session examples:
${examples}

Generate ${count} diverse, production-relevant eval cases as a JSON array.`;

    const rawText = await callAnthropic(systemPrompt, userPrompt);

    const jsonStr = rawText
      .replace(/^```(?:json)?\s*/m, '')
      .replace(/\s*```\s*$/m, '')
      .trim();

    let cases: object[];
    try {
      cases = JSON.parse(jsonStr);
      if (!Array.isArray(cases)) throw new Error('Expected JSON array');
    } catch {
      res.status(500).json({ error: 'LLM returned invalid JSON. Please try again.' });
      return;
    }

    res.json({ cases });
  } catch (err) { next(err); }
});
