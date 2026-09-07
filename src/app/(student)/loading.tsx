import { Skeleton } from "@/components/ui/Skeleton";

export default function StudentLoading() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-40" />
      </div>
      <div className="space-y-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="card space-y-3 p-6">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-5 w-56" />
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}
