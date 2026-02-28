import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { Link } from 'react-router-dom';

interface Props {
  agentId: string;
}

type Tab =
  | 'python-anthropic'
  | 'python-openai'
  | 'typescript-anthropic'
  | 'claude-code'
  | 'chatgpt-extension';

const TAB_LABELS: Record<Tab, string> = {
  'python-anthropic':    'Python · Anthropic',
  'python-openai':       'Python · OpenAI',
  'typescript-anthropic':'TypeScript · Anthropic',
  'claude-code':         'Claude Code',
  'chatgpt-extension':   'ChatGPT',
};

// Tabs that show install instructions instead of a code snippet
const GUIDE_TABS: Set<Tab> = new Set(['claude-code', 'chatgpt-extension']);

export function QuickStart({ agentId }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('python-anthropic');
  const [copied, setCopied] = useState(false);

  const snippets: Record<Tab, string> = {
    'python-anthropic': `import anthropic
from provenant_sdk import instrument

client = instrument(
    anthropic.Anthropic(),
    api_key="pk_live_...",       # get from /api-keys
    agent_id="${agentId}",
    base_url="https://api.provenant.dev",
)

# Zero changes below — sessions recorded automatically
response = client.messages.create(
    model="claude-opus-4-5",
    messages=[{"role": "user", "content": "Hello"}],
    max_tokens=1024,
)`,

    'python-openai': `import openai
from provenant_sdk import instrument

client = instrument(
    openai.OpenAI(),
    api_key="pk_live_...",       # get from /api-keys
    agent_id="${agentId}",
    base_url="https://api.provenant.dev",
)

# Zero changes below — sessions recorded automatically
response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Hello"}],
)`,

    'typescript-anthropic': `import Anthropic from '@anthropic-ai/sdk';
import { instrument } from '@provenant/sdk';

const client = instrument(new Anthropic(), {
  apiKey: 'pk_live_...',         // get from /api-keys
  agentId: '${agentId}',
  baseUrl: 'https://api.provenant.dev',
});

// Zero changes below — sessions recorded automatically
const response = await client.messages.create({
  model: 'claude-opus-4-5',
  messages: [{ role: 'user', content: 'Hello' }],
  max_tokens: 1024,
});`,

    // Guide tabs — content rendered separately below
    'claude-code': '',
    'chatgpt-extension': '',
  };

  function handleCopy() {
    navigator.clipboard.writeText(snippets[activeTab]).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const isGuide = GUIDE_TABS.has(activeTab);

  return (
    <div className="card mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-white text-sm">Quick Start</h2>
        {!isGuide && (
          <p className="text-xs text-gray-500">
            Replace{' '}
            <code className="font-mono text-brand-400 bg-gray-800 px-1 py-0.5 rounded text-xs">
              pk_live_...
            </code>{' '}
            with your{' '}
            <Link to="/api-keys" className="text-brand-400 hover:text-brand-300 underline underline-offset-2">
              API key
            </Link>
          </p>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 mb-3 bg-gray-800 rounded-lg p-1 flex-wrap">
        {(Object.keys(TAB_LABELS) as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={[
              'text-xs py-1.5 px-2.5 rounded-md font-medium transition-colors whitespace-nowrap',
              activeTab === tab
                ? 'bg-gray-700 text-white'
                : 'text-gray-400 hover:text-gray-200',
            ].join(' ')}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {/* ── SDK code tabs ── */}
      {!isGuide && (
        <>
          <div className="relative group">
            <pre className="text-xs font-mono text-gray-300 bg-gray-950 rounded-lg p-4 overflow-x-auto leading-[1.6]">
              {snippets[activeTab]}
            </pre>
            <button
              onClick={handleCopy}
              title="Copy to clipboard"
              className="absolute top-3 right-3 p-1.5 rounded-md bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-gray-200 transition-colors opacity-0 group-hover:opacity-100"
            >
              {copied
                ? <Check className="w-3.5 h-3.5 text-green-400" />
                : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1">
            <p className="text-xs text-gray-500">
              <span className="text-gray-400 font-medium">Install:</span>{' '}
              <code className="font-mono bg-gray-800 px-1.5 py-0.5 rounded text-gray-300 text-xs">
                pip install provenant-sdk
              </code>
            </p>
            <p className="text-xs text-gray-500">
              or{' '}
              <code className="font-mono bg-gray-800 px-1.5 py-0.5 rounded text-gray-300 text-xs">
                npm install @provenant/sdk
              </code>
            </p>
          </div>
        </>
      )}

      {/* ── Claude Code guide ── */}
      {activeTab === 'claude-code' && (
        <div className="bg-gray-950 rounded-lg p-4 space-y-4 text-xs">
          <p className="text-gray-300 leading-relaxed">
            Use the Provenant hooks integration to record every Claude Code tool call
            (Bash, Read, Write, Edit, …) as a session — no code changes needed.
          </p>

          <div className="space-y-2">
            <p className="text-gray-400 font-medium">1 · Install</p>
            <pre className="font-mono text-gray-300 bg-gray-900 rounded p-2.5 overflow-x-auto">
{`npm install -g @provenant/hooks-claude`}
            </pre>
          </div>

          <div className="space-y-2">
            <p className="text-gray-400 font-medium">2 · Run the installer</p>
            <pre className="font-mono text-gray-300 bg-gray-900 rounded p-2.5 overflow-x-auto">
{`provenant-claude-install`}
            </pre>
            <p className="text-gray-500 leading-relaxed">
              Enter your API key, then paste this Agent ID when prompted:
            </p>
            <pre className="font-mono text-brand-400 bg-gray-900 rounded p-2.5 overflow-x-auto">
{agentId}
            </pre>
          </div>

          <div className="space-y-1">
            <p className="text-gray-400 font-medium">3 · Use Claude Code normally</p>
            <p className="text-gray-500 leading-relaxed">
              Sessions appear here automatically every time you run Claude Code.
              Each tool call is recorded as a turn.
            </p>
          </div>
        </div>
      )}

      {/* ── ChatGPT Extension guide ── */}
      {activeTab === 'chatgpt-extension' && (
        <div className="bg-gray-950 rounded-lg p-4 space-y-4 text-xs">
          <p className="text-gray-300 leading-relaxed">
            Install the Provenant Chrome extension to record your ChatGPT conversations
            as sessions — just chat normally, everything is captured automatically.
          </p>

          <div className="space-y-2">
            <p className="text-gray-400 font-medium">1 · Load the extension</p>
            <ol className="text-gray-500 space-y-1 list-decimal list-inside leading-relaxed">
              <li>Open Chrome → <span className="text-gray-300">chrome://extensions</span></li>
              <li>Enable <span className="text-gray-300">Developer mode</span> (top right)</li>
              <li>Click <span className="text-gray-300">Load unpacked</span> → select the <code className="font-mono bg-gray-800 px-1 rounded">extension-chatgpt</code> folder</li>
            </ol>
          </div>

          <div className="space-y-2">
            <p className="text-gray-400 font-medium">2 · Configure</p>
            <p className="text-gray-500 leading-relaxed">
              Click the Provenant icon in Chrome's toolbar. Enter your API key and paste
              this Agent ID:
            </p>
            <pre className="font-mono text-brand-400 bg-gray-900 rounded p-2.5 overflow-x-auto">
{agentId}
            </pre>
          </div>

          <div className="space-y-1">
            <p className="text-gray-400 font-medium">3 · Chat on ChatGPT</p>
            <p className="text-gray-500 leading-relaxed">
              Every conversation on <span className="text-gray-300">chatgpt.com</span> is
              now recorded as a session here, including tool use (browsing, code interpreter).
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
