import clsx from 'clsx';

const map: Record<string, string> = {
  ACTIVE: 'badge-green',
  PUBLISHED: 'badge-green',
  COMPLETED: 'badge-green',
  PROMOTED: 'badge-green',
  APPROVED: 'badge-green',
  PROCESSED: 'badge-green',
  DRAFT: 'badge-gray',
  QUEUED: 'badge-gray',
  PENDING: 'badge-yellow',
  AWAITING_APPROVAL: 'badge-yellow',
  RUNNING: 'badge-blue',
  PROCESSING: 'badge-blue',
  REPLAYING: 'badge-blue',
  DEPRECATED: 'badge-yellow',
  ARCHIVED: 'badge-gray',
  FAILED: 'badge-red',
  REJECTED: 'badge-red',
  YANKED: 'badge-red',
  CANCELLED: 'badge-gray',
  LOW: 'badge-green',
  MEDIUM: 'badge-yellow',
  HIGH: 'badge-red',
  CRITICAL: 'badge-red',
  WARN: 'badge-yellow',
  BLOCK: 'badge-red',
  NOTIFY: 'badge-blue',
  DEVELOPMENT: 'badge-blue',
  STAGING: 'badge-yellow',
  PRODUCTION: 'badge-green',
  CUSTOM: 'badge-purple',
};

export function StatusBadge({ status }: { status: string }) {
  return <span className={clsx('badge', map[status] ?? 'badge-gray')}>{status}</span>;
}
