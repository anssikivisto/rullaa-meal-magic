import { cn } from "@/lib/utils";

const DIET = [
  "kasvis",
  "vegaani",
  "gluteeniton",
  "maidoton",
  "terveellinen",
  "kala",
  "kana",
  "liha",
];
const TIME = ["alle-20min", "alle-30min", "nopea", "hidas", "uuniruoka", "pakastettava"];

export function tagKind(tag: string): "diet" | "time" | "occasion" {
  const t = tag.toLowerCase();
  if (DIET.includes(t)) return "diet";
  if (TIME.includes(t) || /min$/.test(t)) return "time";
  return "occasion";
}

export function TagChip({
  tag,
  active,
  onClick,
  className,
}: {
  tag: string;
  active?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  const kind = tagKind(tag);
  const palette =
    kind === "diet"
      ? "bg-tag-diet text-tag-diet-foreground"
      : kind === "time"
        ? "bg-tag-time text-tag-time-foreground"
        : "bg-tag-occasion text-tag-occasion-foreground";
  const Comp = onClick ? "button" : "span";
  return (
    <Comp
      {...(onClick ? { type: "button" as const, onClick } : {})}
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium transition-all",
        palette,
        active && "ring-2 ring-ring ring-offset-1 ring-offset-background",
        onClick && "hover:brightness-97 active:scale-95",
        className,
      )}
    >
      #{tag}
    </Comp>
  );
}
