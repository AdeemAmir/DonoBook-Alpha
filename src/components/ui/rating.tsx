import * as React from "react"
import { Star } from "lucide-react"
import { cn } from "@/lib/utils"

interface RatingProps extends React.HTMLAttributes<HTMLDivElement> {
    value: number
    max?: number
    onValueChange?: (value: number) => void
    disabled?: boolean
}

const Rating = ({
    value,
    max = 5,
    onValueChange,
    disabled,
    className,
    ...props
}: RatingProps) => {
    return (
        <div className={cn("flex items-center gap-1", className)} {...props}>
            {Array.from({ length: max }).map((_, i) => {
                const starValue = i + 1
                const isSelected = starValue <= value

                return (
                    <Star
                        key={i}
                        className={cn(
                            "h-6 w-6 transition-all",
                            // Color when SELECTED
                            isSelected
                                ? "fill-yellow-400 text-yellow-400"
                                : "fill-none text-slate-400", // Color when EMPTY (Light gray fill/outline)

                            // Hover effects
                            !disabled && "cursor-pointer hover:scale-110 hover:text-yellow-500",
                            disabled && "opacity-50 cursor-not-allowed"
                        )}
                        onClick={() => !disabled && onValueChange?.(starValue)}
                    />
                )
            })}
        </div>
    )
}

export { Rating }