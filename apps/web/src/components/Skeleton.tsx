import clsx from 'clsx';

interface SkeletonProps {
  className?: string;
}

/** Base skeleton pulse element */
export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={clsx('bg-gray-800 animate-pulse rounded-lg', className)}
      aria-hidden="true"
    />
  );
}

/** Skeleton for a full table row with N columns */
export function SkeletonRow({ cols = 4 }: { cols?: number }) {
  return (
    <tr className="border-b border-gray-800">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="table-cell">
          <Skeleton className="h-4 w-full" />
        </td>
      ))}
    </tr>
  );
}

/** Skeleton for a card (e.g. agent card) */
export function SkeletonCard() {
  return (
    <div className="card space-y-3" aria-hidden="true">
      <div className="flex items-start justify-between">
        <Skeleton className="w-10 h-10 rounded-xl" />
        <Skeleton className="w-16 h-5" />
      </div>
      <Skeleton className="h-5 w-2/3" />
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-4 w-full" />
      <div className="flex gap-2">
        <Skeleton className="h-5 w-16" />
        <Skeleton className="h-5 w-12" />
      </div>
    </div>
  );
}

/** Skeleton for a stat card */
export function SkeletonStat() {
  return (
    <div className="card text-center" aria-hidden="true">
      <Skeleton className="h-8 w-16 mx-auto mb-2" />
      <Skeleton className="h-4 w-24 mx-auto" />
    </div>
  );
}

/** Full-page loading skeleton for table pages */
export function TableSkeleton({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="card overflow-x-auto" aria-hidden="true">
      <table className="w-full">
        <thead>
          <tr>
            {Array.from({ length: cols }).map((_, i) => (
              <th key={i} className="table-header">
                <Skeleton className="h-4 w-full" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <SkeletonRow key={i} cols={cols} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Grid of skeleton cards */
export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
