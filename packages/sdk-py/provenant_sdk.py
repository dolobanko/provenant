"""
Provenant AgentOps SDK for Python.
Stdlib-only — no third-party dependencies required.
"""

import asyncio
import contextlib
import json
import re
import sys
import threading
import time
import urllib.request
import urllib.error
from contextvars import ContextVar
from typing import Any, Dict, Iterator, List, Optional


# Matches a standard UUID v4 string
_UUID_RE = re.compile(
    r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
    re.IGNORECASE,
)

# Module-level ContextVar — holds the active session ID when inside a
# `with prov.session(...)` block.  ContextVar is safe across threads
# (Python copies the calling context into daemon threads automatically).
_active_session: ContextVar[Optional[str]] = ContextVar('_provenant_session', default=None)


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

    Basic usage::

        prov = ProvenantClient(base_url="http://localhost:4000", api_key="pk_live_...")
        session = prov.create_session(agent_id="<uuid>")
        prov.add_turn(session["id"], role="USER", content="Hello")
        prov.end_session(session["id"])

    Multi-turn session stitching::

        with prov.session(agent_id="<uuid>", user_id="u123") as sid:
            # Every instrumented client.messages.create() call inside this
            # block automatically adds turns to this session instead of
            # creating a new session per call.
            response1 = client.messages.create(...)
            response2 = client.messages.create(...)
        # Session is automatically ended when the block exits.
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

    @contextlib.contextmanager
    def session(
        self,
        agent_id: str,
        *,
        user_id: Optional[str] = None,
        agent_version_id: Optional[str] = None,
        environment_id: Optional[str] = None,
        external_id: Optional[str] = None,
        metadata: Optional[Dict] = None,
        tags: Optional[List[str]] = None,
    ) -> Iterator[Optional[str]]:
        """
        Context manager that groups all instrumented LLM calls inside the
        block into a single Provenant session with multiple turns.

        Usage::

            with prov.session(agent_id, user_id="u1", external_id="conv-abc") as sid:
                r1 = client.messages.create(...)   # turn 1 → same session
                r2 = client.messages.create(...)   # turn 2 → same session
            # Session auto-ended on exit
        """
        try:
            s = self.create_session(
                agent_id=agent_id,
                user_id=user_id,
                agent_version_id=agent_version_id,
                environment_id=environment_id,
                external_id=external_id,
                metadata=metadata,
                tags=tags,
            )
        except Exception as e:
            print(f"[provenant] session create warning: {e}", file=sys.stderr)
            yield None
            return
        token = _active_session.set(s["id"])
        try:
            yield s["id"]
        finally:
            _active_session.reset(token)
            try:
                self.end_session(s["id"])
            except Exception as e:
                print(f"[provenant] session end warning: {e}", file=sys.stderr)

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


# ── Shared helpers ────────────────────────────────────────────────────────────

def _extract_anthropic_tool_calls(response: Any) -> List[Dict]:
    """Extract tool_use blocks from an Anthropic response."""
    return [
        {
            "id": getattr(b, "id", None),
            "name": getattr(b, "name", None),
            "input": getattr(b, "input", {}),
        }
        for b in (getattr(response, "content", []) or [])
        if getattr(b, "type", None) == "tool_use"
    ]


def _extract_anthropic_text(response: Any) -> str:
    """Extract concatenated text from an Anthropic response content array."""
    return "".join(
        getattr(b, "text", "")
        for b in (getattr(response, "content", []) or [])
        if hasattr(b, "text")
    )


def _detect_anthropic_tool_results(messages: List[Dict]) -> List[Dict]:
    """
    Return tool_result content items found in user messages (Anthropic format).
    Each item is: {"type": "tool_result", "tool_use_id": "...", "content": ...}
    """
    results = []
    for m in messages:
        if m.get("role") == "user" and isinstance(m.get("content"), list):
            for c in m["content"]:
                if isinstance(c, dict) and c.get("type") == "tool_result":
                    results.append(c)
    return results


def _detect_openai_tool_results(messages: List[Dict]) -> List[Dict]:
    """Return messages with role == 'tool' (OpenAI tool result format)."""
    return [m for m in messages if isinstance(m, dict) and m.get("role") == "tool"]


# ── Anthropic streaming wrapper ───────────────────────────────────────────────

class _AnthropicStreamWrapper:
    """
    Wraps an Anthropic MessageStream context manager to record the final
    message as a Provenant session turn after the stream completes.
    """

    def __init__(
        self,
        ctx_mgr: Any,
        provenant: "ProvenantClient",
        agent_id: str,
        messages: List[Dict],
        session_opts: Dict,
        is_managed: bool,
        existing_sid: Optional[str],
    ) -> None:
        self._ctx_mgr = ctx_mgr
        self._provenant = provenant
        self._agent_id = agent_id
        self._messages = messages
        self._session_opts = session_opts
        self._is_managed = is_managed
        self._existing_sid = existing_sid
        self._stream: Any = None
        self._session_id: Optional[str] = existing_sid
        self._session_ok: bool = is_managed
        self._t: Optional[threading.Thread] = None
        self._session_id_box: List[Optional[str]] = [existing_sid]
        self._ok_box: List[bool] = [is_managed]

    def __enter__(self) -> "_AnthropicStreamWrapper":
        self._stream = self._ctx_mgr.__enter__()
        if not self._is_managed:
            def _create() -> None:
                try:
                    s = self._provenant.create_session(
                        agent_id=self._agent_id, **self._session_opts
                    )
                    self._session_id_box[0] = s["id"]
                    last_user = next(
                        (m for m in reversed(self._messages) if m.get("role") == "user"), None
                    )
                    if last_user:
                        content = last_user.get("content", "")
                        if not isinstance(content, str):
                            content = json.dumps(content)
                        self._provenant.add_turn(
                            self._session_id_box[0], role="USER", content=content
                        )
                    self._ok_box[0] = True
                except Exception as exc:
                    print(f"[provenant] stream session create warning: {exc}", file=sys.stderr)

            self._t = threading.Thread(target=_create, daemon=True)
            self._t.start()
        return self

    def __exit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> Any:
        if self._t is not None:
            self._t.join(timeout=5)
        self._session_id = self._session_id_box[0]
        self._session_ok = self._ok_box[0]

        sid = self._session_id
        if sid and self._session_ok:
            try:
                final = self._stream.get_final_message()
                tool_calls = _extract_anthropic_tool_calls(final)
                text = _extract_anthropic_text(final)
                usage = getattr(final, "usage", None)
                input_tokens = getattr(usage, "input_tokens", None)
                output_tokens = getattr(usage, "output_tokens", None)
                is_managed = self._is_managed

                def _record() -> None:
                    try:
                        self._provenant.add_turn(
                            sid,
                            role="ASSISTANT",
                            content=text,
                            tool_calls=tool_calls or None,
                            input_tokens=input_tokens,
                            output_tokens=output_tokens,
                        )
                        if not is_managed:
                            self._provenant.end_session(sid)
                    except Exception as exc:
                        print(f"[provenant] stream record warning: {exc}", file=sys.stderr)

                threading.Thread(target=_record, daemon=True).start()
            except Exception as exc:
                print(f"[provenant] stream final_message warning: {exc}", file=sys.stderr)

        return self._ctx_mgr.__exit__(exc_type, exc_val, exc_tb)

    def __getattr__(self, name: str) -> Any:
        return getattr(self._stream, name)

    def __iter__(self) -> Any:
        return iter(self._stream)


# ── Anthropic sync instrumentation ───────────────────────────────────────────

def _instrument_anthropic(
    client: Any,
    provenant: ProvenantClient,
    agent_id: str,
    session_opts: Dict,
) -> Any:
    """
    Monkey-patch client.messages.create (and .stream) to automatically record
    sessions. Returns the original client (modified in-place).
    """
    original_create = client.messages.create

    def instrumented_create(*args: Any, **kwargs: Any) -> Any:
        existing_sid = _active_session.get()
        is_managed = existing_sid is not None
        messages = kwargs.get("messages", [])

        # ── Streaming via stream=True kwarg ──────────────────────────────
        if kwargs.get("stream"):
            response_iter = original_create(*args, **kwargs)
            chunks: List[Any] = list(response_iter)
            text = "".join(
                getattr(getattr(c, "delta", None), "text", "") or ""
                for c in chunks
                if getattr(getattr(c, "delta", None), "type", None) == "text_delta"
            )
            if not is_managed:
                def _create_and_record() -> None:
                    try:
                        s = provenant.create_session(agent_id=agent_id, **session_opts)
                        sid = s["id"]
                        last_user = next(
                            (m for m in reversed(messages) if m.get("role") == "user"), None
                        )
                        if last_user:
                            content = last_user.get("content", "")
                            if not isinstance(content, str):
                                content = json.dumps(content)
                            provenant.add_turn(sid, role="USER", content=content)
                        provenant.add_turn(sid, role="ASSISTANT", content=text)
                        provenant.end_session(sid)
                    except Exception as exc:
                        print(f"[provenant] stream warning: {exc}", file=sys.stderr)
                threading.Thread(target=_create_and_record, daemon=True).start()
            else:
                def _record_stream_managed() -> None:
                    try:
                        provenant.add_turn(existing_sid, role="ASSISTANT", content=text)
                    except Exception as exc:
                        print(f"[provenant] stream managed warning: {exc}", file=sys.stderr)
                threading.Thread(target=_record_stream_managed, daemon=True).start()
            return iter(chunks)

        # ── Normal (non-streaming) create ─────────────────────────────────
        last_user = next(
            (m for m in reversed(messages) if isinstance(m, dict) and m.get("role") == "user"),
            None,
        )
        tool_results = _detect_anthropic_tool_results(messages)

        session_id: List[Optional[str]] = [existing_sid]
        session_ok: List[bool] = [is_managed]

        def _create_session() -> None:
            try:
                if not is_managed:
                    s = provenant.create_session(agent_id=agent_id, **session_opts)
                    session_id[0] = s["id"]
                sid = session_id[0]
                if sid is None:
                    return
                if tool_results:
                    provenant.add_turn(sid, role="TOOL", content=json.dumps(tool_results))
                if last_user:
                    content = last_user.get("content", "")
                    if not isinstance(content, str):
                        content = json.dumps(content)
                    provenant.add_turn(sid, role="USER", content=content)
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
            if session_id[0] and not is_managed:
                try:
                    provenant.end_session(session_id[0], status="FAILED")
                except Exception:
                    pass
            raise

        latency_ms = int((time.time() - t0) * 1000)
        t.join(timeout=5)

        usage = getattr(response, "usage", None)
        input_tokens: Optional[int] = getattr(usage, "input_tokens", None)
        output_tokens: Optional[int] = getattr(usage, "output_tokens", None)
        tool_calls = _extract_anthropic_tool_calls(response)
        assistant_text = _extract_anthropic_text(response)

        def _record_and_end() -> None:
            if not session_ok[0] or not session_id[0]:
                return
            try:
                provenant.add_turn(
                    session_id[0],
                    role="ASSISTANT",
                    content=assistant_text,
                    tool_calls=tool_calls or None,
                    latency_ms=latency_ms,
                    input_tokens=input_tokens,
                    output_tokens=output_tokens,
                )
                if not is_managed:
                    provenant.end_session(session_id[0])
            except Exception as exc:
                print(f"[provenant] turn/end warning: {exc}", file=sys.stderr)

        threading.Thread(target=_record_and_end, daemon=True).start()
        return response

    client.messages.create = instrumented_create

    # Also patch client.messages.stream (context manager style)
    if hasattr(client, "messages") and hasattr(client.messages, "stream"):
        original_stream = client.messages.stream

        def patched_stream(*args: Any, **kwargs: Any) -> _AnthropicStreamWrapper:
            existing_sid = _active_session.get()
            msgs = kwargs.get("messages", list(args[1]) if len(args) > 1 else [])
            return _AnthropicStreamWrapper(
                ctx_mgr=original_stream(*args, **kwargs),
                provenant=provenant,
                agent_id=agent_id,
                messages=msgs,
                session_opts=session_opts,
                is_managed=existing_sid is not None,
                existing_sid=existing_sid,
            )

        client.messages.stream = patched_stream

    return client


# ── OpenAI sync instrumentation ──────────────────────────────────────────────

def _instrument_openai(
    client: Any,
    provenant: ProvenantClient,
    agent_id: str,
    session_opts: Dict,
) -> Any:
    """
    Monkey-patch client.chat.completions.create to automatically record
    sessions. Returns the original client (modified in-place).
    """
    original_create = client.chat.completions.create

    def instrumented_create(*args: Any, **kwargs: Any) -> Any:
        existing_sid = _active_session.get()
        is_managed = existing_sid is not None
        messages = kwargs.get("messages", [])

        # ── Streaming via stream=True kwarg ──────────────────────────────
        if kwargs.get("stream"):
            response_iter = original_create(*args, **kwargs)
            chunks: List[Any] = list(response_iter)
            text_parts = []
            for chunk in chunks:
                choices = getattr(chunk, "choices", [])
                delta = getattr(choices[0], "delta", None) if choices else None
                part = getattr(delta, "content", None) if delta else None
                if part:
                    text_parts.append(part)
            text = "".join(text_parts)

            if not is_managed:
                def _create_and_record() -> None:
                    try:
                        s = provenant.create_session(agent_id=agent_id, **session_opts)
                        sid = s["id"]
                        last_user = next(
                            (m for m in reversed(messages) if m.get("role") == "user"), None
                        )
                        if last_user:
                            provenant.add_turn(sid, role="USER", content=last_user.get("content", ""))
                        provenant.add_turn(sid, role="ASSISTANT", content=text)
                        provenant.end_session(sid)
                    except Exception as exc:
                        print(f"[provenant] stream warning: {exc}", file=sys.stderr)
                threading.Thread(target=_create_and_record, daemon=True).start()
            else:
                def _record_managed_stream() -> None:
                    try:
                        provenant.add_turn(existing_sid, role="ASSISTANT", content=text)
                    except Exception as exc:
                        print(f"[provenant] stream managed warning: {exc}", file=sys.stderr)
                threading.Thread(target=_record_managed_stream, daemon=True).start()
            return iter(chunks)

        # ── Normal (non-streaming) create ─────────────────────────────────
        last_user = next(
            (m for m in reversed(messages) if isinstance(m, dict) and m.get("role") == "user"),
            None,
        )
        tool_result_msgs = _detect_openai_tool_results(messages)

        session_id: List[Optional[str]] = [existing_sid]
        session_ok: List[bool] = [is_managed]

        def _create_session() -> None:
            try:
                if not is_managed:
                    s = provenant.create_session(agent_id=agent_id, **session_opts)
                    session_id[0] = s["id"]
                sid = session_id[0]
                if sid is None:
                    return
                for tr in tool_result_msgs:
                    content = tr.get("content", "")
                    if not isinstance(content, str):
                        content = json.dumps(content)
                    provenant.add_turn(sid, role="TOOL", content=content)
                if last_user:
                    content = last_user.get("content", "")
                    if not isinstance(content, str):
                        content = json.dumps(content)
                    provenant.add_turn(sid, role="USER", content=content)
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
            if session_id[0] and not is_managed:
                try:
                    provenant.end_session(session_id[0], status="FAILED")
                except Exception:
                    pass
            raise

        latency_ms = int((time.time() - t0) * 1000)
        t.join(timeout=5)

        usage = getattr(response, "usage", None)
        input_tokens: Optional[int] = getattr(usage, "prompt_tokens", None)
        output_tokens: Optional[int] = getattr(usage, "completion_tokens", None)
        choices = getattr(response, "choices", []) or []
        assistant_text = ""
        tool_calls_list: List[Dict] = []
        if choices:
            msg = getattr(choices[0], "message", None)
            assistant_text = getattr(msg, "content", "") or ""
            raw_tc = getattr(msg, "tool_calls", None) or []
            tool_calls_list = [
                {
                    "id": getattr(tc, "id", None),
                    "name": getattr(getattr(tc, "function", None), "name", None),
                    "arguments": getattr(getattr(tc, "function", None), "arguments", None),
                }
                for tc in raw_tc
            ]

        def _record_and_end() -> None:
            if not session_ok[0] or not session_id[0]:
                return
            try:
                provenant.add_turn(
                    session_id[0],
                    role="ASSISTANT",
                    content=assistant_text,
                    tool_calls=tool_calls_list or None,
                    latency_ms=latency_ms,
                    input_tokens=input_tokens,
                    output_tokens=output_tokens,
                )
                if not is_managed:
                    provenant.end_session(session_id[0])
            except Exception as exc:
                print(f"[provenant] turn/end warning: {exc}", file=sys.stderr)

        threading.Thread(target=_record_and_end, daemon=True).start()
        return response

    client.chat.completions.create = instrumented_create
    return client


# ── Anthropic async instrumentation ──────────────────────────────────────────

def _instrument_anthropic_async(
    client: Any,
    provenant: ProvenantClient,
    agent_id: str,
    session_opts: Dict,
) -> Any:
    """Patch AsyncAnthropic client.messages.create with an async def wrapper."""
    original_create = client.messages.create

    async def instrumented_create(*args: Any, **kwargs: Any) -> Any:
        existing_sid = _active_session.get()
        is_managed = existing_sid is not None
        messages = kwargs.get("messages", [])

        async def _to_thread(fn: Any, *a: Any, **kw: Any) -> Any:
            if hasattr(asyncio, "to_thread"):
                return await asyncio.to_thread(fn, *a, **kw)
            loop = asyncio.get_event_loop()
            return await loop.run_in_executor(None, lambda: fn(*a, **kw))

        session_id: Optional[str] = existing_sid
        last_user = next(
            (m for m in reversed(messages) if isinstance(m, dict) and m.get("role") == "user"),
            None,
        )
        tool_results = _detect_anthropic_tool_results(messages)

        try:
            if not is_managed:
                s = await _to_thread(provenant.create_session, agent_id=agent_id, **session_opts)
                session_id = s["id"]
            if session_id:
                if tool_results:
                    await _to_thread(
                        provenant.add_turn, session_id, role="TOOL", content=json.dumps(tool_results)
                    )
                if last_user:
                    content = last_user.get("content", "")
                    if not isinstance(content, str):
                        content = json.dumps(content)
                    await _to_thread(provenant.add_turn, session_id, role="USER", content=content)
        except Exception as exc:
            print(f"[provenant] async session create warning: {exc}", file=sys.stderr)

        t0 = time.time()
        try:
            response = await original_create(*args, **kwargs)
        except Exception:
            if session_id and not is_managed:
                try:
                    await _to_thread(provenant.end_session, session_id, status="FAILED")
                except Exception:
                    pass
            raise

        latency_ms = int((time.time() - t0) * 1000)
        tool_calls = _extract_anthropic_tool_calls(response)
        assistant_text = _extract_anthropic_text(response)
        usage = getattr(response, "usage", None)
        input_tokens = getattr(usage, "input_tokens", None)
        output_tokens = getattr(usage, "output_tokens", None)
        _sid = session_id

        async def _record() -> None:
            if not _sid:
                return
            try:
                await _to_thread(
                    provenant.add_turn,
                    _sid,
                    role="ASSISTANT",
                    content=assistant_text,
                    tool_calls=tool_calls or None,
                    latency_ms=latency_ms,
                    input_tokens=input_tokens,
                    output_tokens=output_tokens,
                )
                if not is_managed:
                    await _to_thread(provenant.end_session, _sid)
            except Exception as exc:
                print(f"[provenant] async record warning: {exc}", file=sys.stderr)

        asyncio.create_task(_record())
        return response

    client.messages.create = instrumented_create
    return client


# ── OpenAI async instrumentation ─────────────────────────────────────────────

def _instrument_openai_async(
    client: Any,
    provenant: ProvenantClient,
    agent_id: str,
    session_opts: Dict,
) -> Any:
    """Patch AsyncOpenAI client.chat.completions.create with an async def wrapper."""
    original_create = client.chat.completions.create

    async def instrumented_create(*args: Any, **kwargs: Any) -> Any:
        existing_sid = _active_session.get()
        is_managed = existing_sid is not None
        messages = kwargs.get("messages", [])

        async def _to_thread(fn: Any, *a: Any, **kw: Any) -> Any:
            if hasattr(asyncio, "to_thread"):
                return await asyncio.to_thread(fn, *a, **kw)
            loop = asyncio.get_event_loop()
            return await loop.run_in_executor(None, lambda: fn(*a, **kw))

        session_id: Optional[str] = existing_sid
        tool_result_msgs = _detect_openai_tool_results(messages)
        last_user = next(
            (m for m in reversed(messages) if isinstance(m, dict) and m.get("role") == "user"),
            None,
        )

        try:
            if not is_managed:
                s = await _to_thread(provenant.create_session, agent_id=agent_id, **session_opts)
                session_id = s["id"]
            if session_id:
                for tr in tool_result_msgs:
                    content = tr.get("content", "")
                    if not isinstance(content, str):
                        content = json.dumps(content)
                    await _to_thread(provenant.add_turn, session_id, role="TOOL", content=content)
                if last_user:
                    content = last_user.get("content", "")
                    if not isinstance(content, str):
                        content = json.dumps(content)
                    await _to_thread(provenant.add_turn, session_id, role="USER", content=content)
        except Exception as exc:
            print(f"[provenant] async session create warning: {exc}", file=sys.stderr)

        t0 = time.time()
        try:
            response = await original_create(*args, **kwargs)
        except Exception:
            if session_id and not is_managed:
                try:
                    await _to_thread(provenant.end_session, session_id, status="FAILED")
                except Exception:
                    pass
            raise

        latency_ms = int((time.time() - t0) * 1000)
        usage = getattr(response, "usage", None)
        input_tokens = getattr(usage, "prompt_tokens", None)
        output_tokens = getattr(usage, "completion_tokens", None)
        choices = getattr(response, "choices", []) or []
        assistant_text = ""
        tool_calls_list: List[Dict] = []
        if choices:
            msg = getattr(choices[0], "message", None)
            assistant_text = getattr(msg, "content", "") or ""
            raw_tc = getattr(msg, "tool_calls", None) or []
            tool_calls_list = [
                {
                    "id": getattr(tc, "id", None),
                    "name": getattr(getattr(tc, "function", None), "name", None),
                    "arguments": getattr(getattr(tc, "function", None), "arguments", None),
                }
                for tc in raw_tc
            ]
        _sid = session_id

        async def _record() -> None:
            if not _sid:
                return
            try:
                await _to_thread(
                    provenant.add_turn,
                    _sid,
                    role="ASSISTANT",
                    content=assistant_text,
                    tool_calls=tool_calls_list or None,
                    latency_ms=latency_ms,
                    input_tokens=input_tokens,
                    output_tokens=output_tokens,
                )
                if not is_managed:
                    await _to_thread(provenant.end_session, _sid)
            except Exception as exc:
                print(f"[provenant] async record warning: {exc}", file=sys.stderr)

        asyncio.create_task(_record())
        return response

    client.chat.completions.create = instrumented_create
    return client


# ── Public API ────────────────────────────────────────────────────────────────

def instrument(
    client: Any,
    *,
    api_key: str,
    agent_id: str,
    base_url: str = "https://api.provenant.dev",
    timeout: int = 10,
    user_id: Optional[str] = None,
    agent_version_id: Optional[str] = None,
    environment_id: Optional[str] = None,
    external_id: Optional[str] = None,
) -> Any:
    """
    Instrument an Anthropic or OpenAI client to automatically record every
    LLM call as a Provenant session with turns, token counts, and tool calls.

    ``agent_id`` can be a UUID or a human-readable name — if a name is given,
    the agent is created automatically if it doesn't already exist.

    Optional session parameters are forwarded to every session created::

        client = instrument(
            anthropic.Anthropic(),
            api_key="pk_live_...",
            agent_id="My Support Bot",
            base_url="https://api.provenant.dev",
            user_id="user-123",
            environment_id="env-prod-uuid",
        )

    **Multi-turn session stitching** — group multiple calls into one session::

        prov = ProvenantClient(base_url="...", api_key="pk_live_...")
        with prov.session(resolved_agent_id, user_id="u1") as sid:
            r1 = client.messages.create(...)  # turn 1
            r2 = client.messages.create(...)  # turn 2 — same session

    **Async clients** (AsyncAnthropic / AsyncOpenAI) are supported::

        async_client = instrument(anthropic.AsyncAnthropic(), ...)
        response = await async_client.messages.create(...)

    **Streaming** is buffered — full response collected, then recorded::

        for chunk in client.messages.create(..., stream=True):
            print(chunk)  # real chunks; Provenant records after

        with client.messages.stream(...) as stream:
            for text in stream.text_stream:
                print(text)  # Provenant records when context exits

    Provenant API failures are NEVER raised — logged to stderr only.
    """
    provenant = ProvenantClient(base_url=base_url, api_key=api_key, timeout=timeout)

    # Resolve agent_id: UUID → use directly; name → get or create
    resolved_id = (
        agent_id if _UUID_RE.match(agent_id) else provenant.get_or_create_agent(agent_id)
    )

    # Build session opts dict (drop None values to avoid sending nulls)
    _session_opts = {
        k: v for k, v in {
            "user_id": user_id,
            "agent_version_id": agent_version_id,
            "environment_id": environment_id,
            "external_id": external_id,
        }.items() if v is not None
    }

    module = (type(client).__module__ or "").lower()
    qualname = (type(client).__qualname__ or "").lower()
    identifier = f"{module}.{qualname}"
    is_async = "async" in qualname

    if "anthropic" in identifier:
        if is_async:
            return _instrument_anthropic_async(client, provenant, resolved_id, _session_opts)
        return _instrument_anthropic(client, provenant, resolved_id, _session_opts)

    if "openai" in identifier:
        if is_async:
            return _instrument_openai_async(client, provenant, resolved_id, _session_opts)
        return _instrument_openai(client, provenant, resolved_id, _session_opts)

    raise ValueError(
        f"[provenant] Unsupported client type: {type(client).__name__}. "
        "Supported: anthropic.Anthropic, anthropic.AsyncAnthropic, "
        "openai.OpenAI, openai.AsyncOpenAI"
    )
