import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle, Circle, X, ChevronRight, Bot, Key, MessageSquare, UserCheck } from 'lucide-react';
import clsx from 'clsx';

interface Step {
  id: string;
  icon: typeof Bot;
  title: string;
  description: string;
  done: boolean;
  link?: string;
  linkLabel?: string;
}

interface OnboardingChecklistProps {
  agentCount: number;
  apiKeyCount: number;
  sessionCount: number;
}

export function OnboardingChecklist({ agentCount, apiKeyCount, sessionCount }: OnboardingChecklistProps) {
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem('onboarding_dismissed') === '1',
  );

  const steps: Step[] = [
    {
      id: 'account',
      icon: UserCheck,
      title: 'Create your account',
      description: 'You\'re signed in and ready to go.',
      done: true,
    },
    {
      id: 'agent',
      icon: Bot,
      title: 'Register your first agent',
      description: 'Agents are the AI assistants you want to monitor. Give each one a name and version.',
      done: agentCount > 0,
      link: '/agents',
      linkLabel: 'Create an agent →',
    },
    {
      id: 'apikey',
      icon: Key,
      title: 'Generate an API key',
      description: 'Your SDK needs a key to send data to Provenant.',
      done: apiKeyCount > 0,
      link: '/api-keys',
      linkLabel: 'Generate API key →',
    },
    {
      id: 'session',
      icon: MessageSquare,
      title: 'Log your first conversation',
      description: 'Use the SDK to start a session and log turns. Then conversations will appear here.',
      done: sessionCount > 0,
      link: '/agents',
      linkLabel: 'View quickstart →',
    },
  ];

  const completedCount = steps.filter((s) => s.done).length;
  const allDone = completedCount === steps.length;

  if (dismissed) return null;
  if (allDone) return null; // Hide once everything is done

  function dismiss() {
    localStorage.setItem('onboarding_dismissed', '1');
    setDismissed(true);
  }

  return (
    <div className="card border-brand-700/40 bg-brand-950/20 mb-8">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-white">Get started with Provenant</h2>
          <p className="text-sm text-gray-400 mt-0.5">
            {completedCount} of {steps.length} steps complete
          </p>
        </div>
        <button
          onClick={dismiss}
          className="text-gray-600 hover:text-gray-400 transition-colors"
          title="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-gray-800 rounded-full mb-5 overflow-hidden">
        <div
          className="h-full bg-brand-500 rounded-full transition-all duration-500"
          style={{ width: `${(completedCount / steps.length) * 100}%` }}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        {steps.map((step) => {
          return (
            <div
              key={step.id}
              className={clsx(
                'rounded-xl p-4 border transition-colors',
                step.done
                  ? 'bg-green-950/20 border-green-800/30'
                  : 'bg-gray-800/50 border-gray-700/50',
              )}
            >
              <div className="flex items-start gap-3 mb-2">
                {step.done ? (
                  <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                ) : (
                  <Circle className="w-5 h-5 text-gray-600 flex-shrink-0 mt-0.5" />
                )}
                <div className="min-w-0">
                  <p className={clsx('text-sm font-medium', step.done ? 'text-green-300' : 'text-white')}>
                    {step.title}
                  </p>
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">{step.description}</p>
                </div>
              </div>
              {!step.done && step.link && (
                <Link
                  to={step.link}
                  className="flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300 mt-2 pl-8"
                >
                  {step.linkLabel}
                  <ChevronRight className="w-3 h-3" />
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
