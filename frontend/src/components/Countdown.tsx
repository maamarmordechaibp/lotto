import { useEffect, useState } from "react";

function diff(target: Date) {
  const ms = Math.max(0, target.getTime() - Date.now());
  return {
    days: Math.floor(ms / 86_400_000),
    hours: Math.floor((ms % 86_400_000) / 3_600_000),
    minutes: Math.floor((ms % 3_600_000) / 60_000),
    seconds: Math.floor((ms % 60_000) / 1000),
    done: ms === 0,
  };
}

export function Countdown({ target }: { target: string | Date }) {
  const date = typeof target === "string" ? new Date(target) : target;
  const [time, setTime] = useState(() => diff(date));

  useEffect(() => {
    const id = setInterval(() => setTime(diff(date)), 1000);
    return () => clearInterval(id);
  }, [date]);

  if (time.done) return <p className="text-sm font-medium text-muted-foreground">Drawing closed</p>;

  const units = [
    { label: "Days", value: time.days },
    { label: "Hours", value: time.hours },
    { label: "Min", value: time.minutes },
    { label: "Sec", value: time.seconds },
  ];

  return (
    <div className="flex gap-3">
      {units.map((u) => (
        <div key={u.label} className="flex flex-col items-center rounded-lg bg-secondary px-3 py-2">
          <span className="text-2xl font-bold tabular-nums">{String(u.value).padStart(2, "0")}</span>
          <span className="text-xs text-muted-foreground">{u.label}</span>
        </div>
      ))}
    </div>
  );
}
