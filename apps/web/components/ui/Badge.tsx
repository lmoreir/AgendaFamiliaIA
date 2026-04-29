import { cn } from "../../lib/utils";
import type { ActivityCategory } from "../../lib/types";

interface BadgeProps {
  category: ActivityCategory;
  className?: string;
}

const categoryConfig: Record<ActivityCategory, { label: string; className: string }> = {
  SCHOOL:  { label: "Escola",   className: "badge-school" },
  SPORT:   { label: "Esporte",  className: "badge-sport" },
  MEDICAL: { label: "Saúde",    className: "badge-medical" },
  OTHER:   { label: "Outro",    className: "badge-other" },
};

export function CategoryBadge({ category, className }: BadgeProps) {
  const config = categoryConfig[category];
  return (
    <span className={cn(config.className, className)}>
      {config.label}
    </span>
  );
}
