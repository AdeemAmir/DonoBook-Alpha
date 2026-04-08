import { Badge } from "@/components/ui/badge";
import { Clock, CheckCircle2, Check } from "lucide-react";

interface StatusBadgeProps {
  status: string | undefined;
  className?: string;
}

export const StatusBadge = ({ status, className }: StatusBadgeProps) => {
  switch (status) {
    case "pending":
      return (
        <Badge className={`bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100 gap-1 py-1 px-3 ${className}`}>
          <Clock className="h-3.5 w-3.5" />
          Pending Offer
        </Badge>
      );
    case "claimed":
      return (
        <Badge className={`bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-100 gap-1 py-1 px-3 ${className}`}>
          <CheckCircle2 className="h-3.5 w-3.5" />
          Claimed
        </Badge>
      );
    default:
      return (
        <Badge className={`bg-teal-50 text-teal-700 border border-teal-200 hover:bg-teal-50 gap-1 px-2 py-0.5 text-xs dark:bg-teal-900/20 dark:text-teal-400 dark:border-teal-800 ${className}`}>
          <Check className="h-3.5 w-3.5" />
          Available
        </Badge>
      );
  }
};