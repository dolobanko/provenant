import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { auditLog } from '../middleware/audit';
import { EVAL_TEMPLATES } from '../lib/eval-templates';
import { estimateCost } from '../lib/pricing';
import { fireWebhook } from '../lib/webhooks';
import { callAnthropic } from '../lib/llm';

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

    // Compute estimated cost from tokenCount across all case results
    const modelId = run.agentVersion?.modelId ?? '';
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
      include: { suite: { include: { cases: true } } },
    });

    // Simulate async processing (in production this would be a Bull job)
    setTimeout(async () => {
      try {
        await prisma.evalRun.update({ where: { id: run.id }, data: { status: 'RUNNING', startedAt: new Date() } });
        const cases = run.suite.cases as Array<{ id: string; expectedOutput?: unknown }>;
        if (cases.length === 0) {
          await prisma.evalRun.update({ where: { id: run.id }, data: { status: 'COMPLETED', completedAt: new Date(), passRate: 0, score: 0 } });
          return;
        }
        const results = cases.map((c) => ({
          runId: run.id,
          caseId: c.id,
          passed: Math.random() > 0.2,
          score: Math.random() * 100,
          latencyMs: Math.floor(Math.random() * 2000) + 100,
          tokenCount: Math.floor(Math.random() * 500) + 50,
          actualOutput: JSON.stringify(c.expectedOutput ?? {}),
          metadata: JSON.stringify({}),
        }));
        await prisma.evalCaseResult.createMany({ data: results });
        const passRate = results.filter((r) => r.passed).length / results.length;
        const avgScore = results.reduce((a, r) => a + r.score, 0) / results.length;
        await prisma.evalRun.update({
          where: { id: run.id },
          data: { status: 'COMPLETED', completedAt: new Date(), passRate, score: avgScore },
        });
        if (passRate < 0.8) {
          fireWebhook(req.user!.orgId, 'eval.failed', {
            runId: run.id,
            suiteId: run.suiteId,
            agentId: run.agentId,
            passRate: Math.round(passRate * 100) / 100,
          }).catch(() => {});
        }
      } catch { /* swallow */ }
    }, 2000);

    res.status(201).json(run);
  } catch (err) { next(err); }
});

// Submit results externally
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

    // Strip possible markdown fences
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
