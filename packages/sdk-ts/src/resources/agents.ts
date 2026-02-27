import { HttpClient } from '../http';
import { Agent, CreateSessionOptions, Session } from '../types';

export class AgentsResource {
  constructor(private http: HttpClient) {}

  list(): Promise<Agent[]> {
    return this.http.get<Agent[]>('/agents');
  }

  get(id: string): Promise<Agent> {
    return this.http.get<Agent>(`/agents/${id}`);
  }

  createSession(agentId: string, opts: Omit<CreateSessionOptions, 'agentId'> = {}): Promise<Session> {
    return this.http.post<Session>('/sessions', { agentId, ...opts });
  }

  create(opts: { name: string; slug?: string; description?: string; modelFamily?: string }): Promise<Agent> {
    const slug = opts.slug ?? opts.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return this.http.post<Agent>('/agents', { ...opts, slug });
  }

  /** Return an existing agent with the given name, or create it if absent.
   *  Idempotent — safe to call on every startup. */
  getOrCreate(name: string): Promise<Agent> {
    return this.http.post<Agent>('/agents/get-or-create', { name });
  }
}
