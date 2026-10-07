"use client";

interface DesignationOption {
  value: string;
  /** Translated "Primary / Alternate" label, e.g. "Petitioner / Plaintiff". */
  label: string;
}

/** Splits a "Petitioner / Plaintiff" label into its two halves; a label without " / " is all primary. */
export function splitDesignationLabel(label: string): [string, string | null] {
  const at = label.indexOf(" / ");
  return at === -1 ? [label, null] : [label.slice(0, at), label.slice(at + 3)];
}

interface DesignationPickerProps {
  /** Unique per party — it's the radio group's name. */
  name: string;
  legend: string;
  value: string;
  onChange: (value: string) => void;
  options: DesignationOption[];
}

/**
 * All designations side by side as a radio group, instead of a dropdown that hid two of the three
 * behind a click. Native radios underneath, so arrow keys move between options for free.
 */
export function DesignationPicker({ name, legend, value, onChange, options }: DesignationPickerProps) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-[10px] font-bold tracking-wider text-muted-foreground uppercase">{legend}</legend>
      <div className="grid grid-cols-3 gap-2">
        {options.map((option) => {
          const [primary, secondary] = splitDesignationLabel(option.label);
          return (
            <label
              key={option.value}
              className="flex cursor-pointer flex-col justify-center gap-0.5 rounded-xl border border-border bg-background px-3 py-2.5 transition-colors hover:border-foreground/30 has-[:checked]:border-brand-gold has-[:checked]:bg-brand-gold/10 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-gold/30"
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={value === option.value}
                onChange={() => onChange(option.value)}
                className="peer sr-only"
              />
              <span className="text-[13px] font-medium leading-tight text-foreground [overflow-wrap:anywhere]">{primary}</span>
              {secondary && (
                <span className="text-[11px] leading-tight text-muted-foreground peer-checked:text-foreground/70 [overflow-wrap:anywhere]">
                  {secondary}
                </span>
              )}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
