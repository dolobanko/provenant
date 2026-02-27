import { HttpClient } from '../http';
import { Session, SessionTurn, CreateSessionOptions, AddTurnOptions, EndSessionOptions } from '../types';

export class SessionsResource {
  constructor(private http: HttpClient) {}

  create(opts: CreateSessionOptions): Promise<Session> {
    return this.http.post<Session>('/sessions', opts);
  }

  get(id: string): Promise<Session & { turns: SessionTurn[] }> {
    return this.http.get<Session & { turns: SessionTurn[] }>(`/sessions/${id}`);
  }

  addTurn(sessionId: string, turn: AddTurnOptions): Promise<SessionTurn> {
    return this.http.post<SessionTurn>(`/sessions/${sessionId}/turns`, turn);
  }

  end(sessionId: string, opts: EndSessionOptions = {}): Promise<Session> {
    return this.http.patch<Session>(`/sessions/${sessionId}`, {
      status: opts.status ?? 'COMPLETED',
      endedAt: new Date().toISOString(),
    });
  }
}
