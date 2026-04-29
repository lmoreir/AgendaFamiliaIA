import { cn } from "../../lib/utils";
import { type SelectHTMLAttributes, forwardRef } from "react";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, hint, className, id, children, ...props }, ref) => {
    const selectId = id || label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="space-y-1">
        {label && (
          <label htmlFor={selectId} className="label block">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={cn(
            "input",
            error && "border-red-300 focus:border-red-500 focus:ring-red-500/20",
            className
          )}
          aria-invalid={!!error}
          aria-describedby={error ? `${selectId}-error` : hint ? `${selectId}-hint` : undefined}
          {...props}
        >
          {children}
        </select>
        {error && (
          <p id={`${selectId}-error`} className="text-xs text-red-600">
            {error}
          </p>
        )}
        {hint && !error && (
          <p id={`${selectId}-hint`} className="text-xs text-gray-500">
            {hint}
          </p>
        )}
      </div>
    );
  }
);

Select.displayName = "Select";
