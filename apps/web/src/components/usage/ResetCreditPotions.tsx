import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";

export function ResetCreditPotions({
  count,
  label = `${count} reset ${count === 1 ? "credit" : "credits"} available`,
}: {
  readonly count: number;
  readonly label?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            role="img"
            aria-label={label}
            className="inline-flex shrink-0 flex-wrap items-center gap-0.5 align-middle text-muted-foreground"
          />
        }
      >
        {Array.from({ length: Math.max(3, count) }, (_, index) => {
          const filled = index < count;
          return (
            <svg
              key={index}
              aria-hidden
              viewBox="0 0 20 24"
              fill="none"
              className="size-5 shrink-0"
            >
              <path
                d="M7 5v4l-3.5 5a5 5 0 0 0 4.1 8h4.8a5 5 0 0 0 4.1-8L13 9V5"
                fill="currentColor"
                fillOpacity={filled ? 0.08 : 0.04}
                stroke="currentColor"
                strokeOpacity={filled ? 0.7 : 0.3}
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
              {filled ? (
                <>
                  <path
                    d="M5.3 14h9.4l.6.9a3.5 3.5 0 0 1-2.9 5.6H7.6a3.5 3.5 0 0 1-2.9-5.6Z"
                    fill="var(--color-violet-400)"
                  />
                  <path
                    d="M6.5 16a2 2 0 0 0 0 2.5"
                    stroke="var(--color-violet-100)"
                    strokeLinecap="round"
                  />
                </>
              ) : null}
              <rect
                x="6"
                y="1.5"
                width="8"
                height="4"
                rx="1"
                fill={filled ? "var(--color-amber-600)" : "currentColor"}
                fillOpacity={filled ? 1 : 0.25}
              />
              <path d="M6 6.5h8" stroke="currentColor" strokeOpacity={filled ? 0.7 : 0.3} />
            </svg>
          );
        })}
      </TooltipTrigger>
      <TooltipPopup side="top">{label}</TooltipPopup>
    </Tooltip>
  );
}
