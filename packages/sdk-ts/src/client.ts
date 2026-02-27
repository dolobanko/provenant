import { ProvenantConfig, WithSessionOptions } from './types';
import { HttpClient } from './http';
import { AgentsResource } from './resources/agents';
import { SessionsResource } from './resources/sessions';
import { EvalsResource } from './resources/evals';
import { _activeSession } from './session-context';

export class ProvenantClient {
  readonly agents: AgentsResource;
  readonly sessions: SessionsResource;
  readonly evals: EvalsResource;

  constructor(config: ProvenantConfig) {
    const http = new HttpClient(config);
    this.agents = new AgentsResource(http);
    this.sessions = new SessionsResource(http);
    this.evals = new EvalsResource(http);
  }

  /**
   * Group all instrumented LLM calls inside `fn` into a single Provenant
   * session with multiple turns, rather than creating one session per call.
   *
   * The session is created before `fn` runs and automatically ended when
   * `fn` resolves or rejects. Provenant failures never block `fn` from running.
   *
   * @example
   * ```ts
   * const prov = new ProvenantClient({ baseUrl: '...', apiKey: 'pk_live_...' });
   *
   * await prov.withSession(agentId, { userId: 'u123', externalId: 'conv-abc' }, async (sid) => {
   *   const r1 = await client.messages.create({ ... }); // turn 1 → same session
   *   const r2 = await client.messages.create({ ... }); // turn 2 → same session
   * });
   * // Session ended automatically
   * ```
   */
  async withSession<T>(
    agentId: string,
    opts: WithSessionOptions,
    fn: (sessionId: string) => Promise<T>,
  ): Promise<T> {
    let session: { id: string } | null = null;
    try {
      session = await this.sessions.create({ agentId, ...opts });
    } catch (err) {
      console.error('[provenant] withSession: failed to create session:', err);
      // Run fn without a managed session rather than blocking the caller
      return fn('');
    }

    return _activeSession.run(session.id, async () => {
      try {
        return await fn(session!.id);
      } finally {
        await this.sessions.end(session!.id).catch((err: unknown) => {
          console.error('[provenant] withSession: failed to end session:', err);
        });
      }
    });
  }
}
