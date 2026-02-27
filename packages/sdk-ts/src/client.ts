import { ProvenantConfig } from './types';
import { HttpClient } from './http';
import { AgentsResource } from './resources/agents';
import { SessionsResource } from './resources/sessions';
import { EvalsResource } from './resources/evals';

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
}
