"""
Provenant AgentOps SDK for Python.
Stdlib-only — no third-party dependencies required.
"""

import json
import re
import sys
import threading
import time
import urllib.request
import urllib.error
from typing import Any, Dict, List, Optional


# Matches a standard UUID v4 string
_UUID_RE = re.compile(
    r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
    re.IGNORECASE,
)


class ProvenantError(Exception):
    def __init__(self, status_code: int, message: str):
        super().__init__(f"HTTP {status_code}: {message}")
        self.status_code = status_code


class _HttpClient:
    def __init__(self, base_url: str, api_key: str, timeout: int = 30):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.timeout = timeout

    def _request(self, method: str, path: str, body: Optional[Dict] = None) -> Any:
        url = f"{self.base_url}/api{path}"
        data = json.dumps(body).encode() if body is not None else None
        req = urllib.request.Request(
            url,
            data=data,
            method=method,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.api_key}",
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                return json.loads(resp.read().decode())
        except urllib.error.HTTPError as e:
            try:
                payload = json.loads(e.read().decode())
                msg = payload.get("error", e.reason)
            except Exception:
                msg = e.reason
            raise ProvenantError(e.code, msg)

    def get(self, path: str) -> Any:
        return self._request("GET", path)

    def post(self, path: str, body: Dict) -> Any:
        return self._request("POST", path, body)

    def patch(self, path: str, body: Dict) -> Any:
        return self._request("PATCH", path, body)

    def delete(self, path: str) -> Any:
        return self._request("DELETE", path)


class ProvenantClient:
    """
    Client for the Provenant AgentOps API.

    Usage::

        client = ProvenantClient(
            base_url="http://localhost:4000",
            api_key="pk_live_..."
        )
        session = client.create_session(agent_id="<uuid>")
        client.add_turn(session["id"], role="USER", content="Hello")
        client.end_session(session["id"])
    """

    def __init__(self, base_url: str, api_key: str, timeout: int = 30):
        self._http = _HttpClient(base_url, api_key, timeout)

    # ── Agents ──────────────────────────────────────────────────────────────

    def list_agents(self) -> List[Dict]:
        return self._http.get("/agents")

    def get_agent(self, agent_id: str) -> Dict:
        return self._http.get(f"/agents/{agent_id}")

    def get_or_create_agent(self, name: str) -> str:
        """
        Return the ID of an existing agent with the given name, creating it
        if it doesn't exist yet. Idempotent — safe to call on every startup.
        """
        result = self._http.post("/agents/get-or-create", {"name": name})
        return result["id"]

    # ── Sessions ─────────────────────────────────────────────────────────────

    def create_session(
        self,
        agent_id: str,
        agent_version_id: Optional[str] = None,
        environment_id: Optional[str] = None,
        external_id: Optional[str] = None,
        user_id: Optional[str] = None,
        metadata: Optional[Dict] = None,
        tags: Optional[List[str]] = None,
    ) -> Dict:
        body: Dict[str, Any] = {"agentId": agent_id}
        if agent_version_id:
            body["agentVersionId"] = agent_version_id
        if environment_id:
            body["environmentId"] = environment_id
        if external_id:
            body["externalId"] = external_id
        if user_id:
            body["userId"] = user_id
        if metadata:
            body["metadata"] = metadata
        if tags:
            body["tags"] = tags
        return self._http.post("/sessions", body)

    def get_session(self, session_id: str) -> Dict:
        return self._http.get(f"/sessions/{session_id}")

    def add_turn(
        self,
        session_id: str,
        role: str,
        content: Any,
        tool_calls: Optional[List] = None,
        latency_ms: Optional[int] = None,
        input_tokens: Optional[int] = None,
        output_tokens: Optional[int] = None,
        metadata: Optional[Dict] = None,
    ) -> Dict:
        body: Dict[str, Any] = {"role": role, "content": content}
        if tool_calls is not None:
            body["toolCalls"] = tool_calls
        if latency_ms is not None:
            body["latencyMs"] = latency_ms
        if input_tokens is not None:
            body["inputTokens"] = input_tokens
        if output_tokens is not None:
            body["outputTokens"] = output_tokens
        if metadata:
            body["metadata"] = metadata
        return self._http.post(f"/sessions/{session_id}/turns", body)

    def end_session(self, session_id: str, status: str = "COMPLETED") -> Dict:
        import datetime
        return self._http.patch(f"/sessions/{session_id}", {
            "status": status,
            "endedAt": datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S.000Z"),
        })

    # ── Evals ────────────────────────────────────────────────────────────────

    def create_eval_run(
        self,
        suite_id: str,
        agent_id: str,
        agent_version_id: Optional[str] = None,
        environment_id: Optional[str] = None,
    ) -> Dict:
        body: Dict[str, Any] = {"suiteId": suite_id, "agentId": agent_id}
        if agent_version_id:
            body["agentVersionId"] = agent_version_id
        if environment_id:
            body["environmentId"] = environment_id
        return self._http.post("/evals/runs", body)

    def get_eval_run(self, run_id: str) -> Dict:
        return self._http.get(f"/evals/runs/{run_id}")

    def submit_results(self, run_id: str, results: List[Dict]) -> Dict:
        return self._http.post(f"/evals/runs/{run_id}/results", {"results": results})

    def wait_for_completion(
        self,
        run_id: str,
        poll_interval_seconds: float = 2.0,
        timeout_seconds: float = 300.0,
    ) -> Dict:
        deadline = time.time() + timeout_seconds
        while time.time() < deadline:
            run = self.get_eval_run(run_id)
            if run["status"] in ("COMPLETED", "FAILED"):
                return run
            time.sleep(poll_interval_seconds)
        raise TimeoutError(f"Eval run {run_id} did not complete within {timeout_seconds}s")


# ── Auto-instrumentation ──────────────────────────────────────────────────────

def _instrument_anthropic(client: Any, provenant: ProvenantClient, agent_id: str) -> Any:
    """
    Monkey-patch client.messages.create to automatically record sessions.
    The original client object is returned (modified in-place).
    """
    original_create = client.messages.create

    def instrumented_create(*args: Any, **kwargs: Any) -> Any:
        messages = kwargs.get("messages", [])
        last_user = next(
            (m for m in reversed(messages) if isinstance(m, dict) and m.get("role") == "user"),
            None,
        )

        # Shared state between threads via single-element list (avoids nonlocal)
        session_id: List[Optional[str]] = [None]
        session_ok: List[bool] = [False]

        def _create_session() -> None:
            try:
                session = provenant.create_session(agent_id=agent_id)
                session_id[0] = session["id"]
                if last_user:
                    content = last_user.get("content", "")
                    provenant.add_turn(session_id[0], role="USER", content=content)
                session_ok[0] = True
            except Exception as exc:
                print(f"[provenant] session create warning: {exc}", file=sys.stderr)

        t = threading.Thread(target=_create_session, daemon=True)
        t.start()

        t0 = time.time()
        try:
            response = original_create(*args, **kwargs)
        except Exception:
            t.join(timeout=2)
            if session_id[0]:
                try:
                    provenant.end_session(session_id[0], status="FAILED")
                except Exception:
                    pass
            raise

        latency_ms = int((time.time() - t0) * 1000)
        t.join(timeout=5)  # wait for session creation before adding assistant turn

        # Extract Anthropic response fields
        usage = getattr(response, "usage", None)
        input_tokens: Optional[int] = getattr(usage, "input_tokens", None)
        output_tokens: Optional[int] = getattr(usage, "output_tokens", None)
        content_blocks = getattr(response, "content", []) or []
        assistant_text = "".join(
            getattr(b, "text", "") for b in content_blocks if hasattr(b, "text")
        )

        def _record_and_end() -> None:
            if not session_ok[0] or not session_id[0]:
                return
            try:
                provenant.add_turn(
                    session_id[0],
                    role="ASSISTANT",
                    content=assistant_text,
                    latency_ms=latency_ms,
                    input_tokens=input_tokens,
                    output_tokens=output_tokens,
                )
                provenant.end_session(session_id[0])
            except Exception as exc:
                print(f"[provenant] turn/end warning: {exc}", file=sys.stderr)

        threading.Thread(target=_record_and_end, daemon=True).start()
        return response

    client.messages.create = instrumented_create
    return client


def _instrument_openai(client: Any, provenant: ProvenantClient, agent_id: str) -> Any:
    """
    Monkey-patch client.chat.completions.create to automatically record sessions.
    The original client object is returned (modified in-place).
    """
    original_create = client.chat.completions.create

    def instrumented_create(*args: Any, **kwargs: Any) -> Any:
        messages = kwargs.get("messages", [])
        last_user = next(
            (m for m in reversed(messages) if isinstance(m, dict) and m.get("role") == "user"),
            None,
        )

        session_id: List[Optional[str]] = [None]
        session_ok: List[bool] = [False]

        def _create_session() -> None:
            try:
                session = provenant.create_session(agent_id=agent_id)
                session_id[0] = session["id"]
                if last_user:
                    content = last_user.get("content", "")
                    provenant.add_turn(session_id[0], role="USER", content=content)
                session_ok[0] = True
            except Exception as exc:
                print(f"[provenant] session create warning: {exc}", file=sys.stderr)

        t = threading.Thread(target=_create_session, daemon=True)
        t.start()

        t0 = time.time()
        try:
            response = original_create(*args, **kwargs)
        except Exception:
            t.join(timeout=2)
            if session_id[0]:
                try:
                    provenant.end_session(session_id[0], status="FAILED")
                except Exception:
                    pass
            raise

        latency_ms = int((time.time() - t0) * 1000)
        t.join(timeout=5)

        # Extract OpenAI response fields
        usage = getattr(response, "usage", None)
        input_tokens: Optional[int] = getattr(usage, "prompt_tokens", None)
        output_tokens: Optional[int] = getattr(usage, "completion_tokens", None)
        choices = getattr(response, "choices", []) or []
        assistant_text = ""
        if choices:
            msg = getattr(choices[0], "message", None)
            assistant_text = getattr(msg, "content", "") or ""

        def _record_and_end() -> None:
            if not session_ok[0] or not session_id[0]:
                return
            try:
                provenant.add_turn(
                    session_id[0],
                    role="ASSISTANT",
                    content=assistant_text,
                    latency_ms=latency_ms,
                    input_tokens=input_tokens,
                    output_tokens=output_tokens,
                )
                provenant.end_session(session_id[0])
            except Exception as exc:
                print(f"[provenant] turn/end warning: {exc}", file=sys.stderr)

        threading.Thread(target=_record_and_end, daemon=True).start()
        return response

    client.chat.completions.create = instrumented_create
    return client


def instrument(
    client: Any,
    *,
    api_key: str,
    agent_id: str,
    base_url: str = "https://api.provenant.dev",
    timeout: int = 10,
) -> Any:
    """
    Instrument an Anthropic or OpenAI client to automatically record every
    LLM call as a Provenant session with turns and token counts.

    ``agent_id`` can be a UUID or a human-readable name — if a name is given,
    the agent is created automatically if it doesn't already exist.

    The original client object is returned so you can use it as a drop-in
    replacement::

        import anthropic
        from provenant_sdk import instrument

        client = instrument(
            anthropic.Anthropic(),
            api_key="pk_live_...",
            agent_id="My Support Bot",
            base_url="https://api.provenant.dev",
        )

        # Everything below is recorded automatically — no code changes needed
        response = client.messages.create(
            model="claude-opus-4-5",
            messages=[{"role": "user", "content": "Hello"}],
            max_tokens=1024,
        )

    Provenant API failures are never raised — they are logged to stderr only,
    so your agent continues to work even if the observability layer is down.

    Note: streaming responses and async clients are not yet supported.
    """
    provenant = ProvenantClient(base_url=base_url, api_key=api_key, timeout=timeout)

    # Resolve agent_id: UUID → use directly; name → get or create
    resolved_id = agent_id if _UUID_RE.match(agent_id) else provenant.get_or_create_agent(agent_id)

    module = (type(client).__module__ or "").lower()
    qualname = (type(client).__qualname__ or "").lower()
    identifier = f"{module}.{qualname}"

    if "anthropic" in identifier:
        return _instrument_anthropic(client, provenant, resolved_id)
    if "openai" in identifier:
        return _instrument_openai(client, provenant, resolved_id)

    raise ValueError(
        f"[provenant] Unsupported client type: {type(client).__name__}. "
        "Supported: anthropic.Anthropic, openai.OpenAI"
    )
