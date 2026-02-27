import { HttpClient } from '../http';
import { EvalRun, EvalCaseResult, CreateEvalRunOptions, SubmitResultOptions, WaitForCompletionOptions } from '../types';

export class EvalsResource {
  constructor(private http: HttpClient) {}

  createRun(opts: CreateEvalRunOptions): Promise<EvalRun> {
    return this.http.post<EvalRun>('/evals/runs', opts);
  }

  getRun(id: string): Promise<EvalRun & { results: EvalCaseResult[] }> {
    return this.http.get<EvalRun & { results: EvalCaseResult[] }>(`/evals/runs/${id}`);
  }

  submitResults(runId: string, results: SubmitResultOptions[]): Promise<{ count: number }> {
    return this.http.post<{ count: number }>(`/evals/runs/${runId}/results`, { results });
  }

  async waitForCompletion(
    runId: string,
    opts: WaitForCompletionOptions = {},
  ): Promise<EvalRun & { results: EvalCaseResult[] }> {
    const { pollIntervalMs = 2000, timeoutMs = 300_000 } = opts;
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const run = await this.getRun(runId);
      if (run.status === 'COMPLETED' || run.status === 'FAILED') {
        return run;
      }
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    throw new Error(`Eval run ${runId} did not complete within ${timeoutMs}ms`);
  }
}
