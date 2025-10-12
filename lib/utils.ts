import { twMerge } from 'tailwind-merge';

export function cn(...classes: Array<string | false | null | undefined>): string {
  const filtered = classes.filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
  return twMerge(...filtered);
}

const COUNT_UNITS = [
  { value: 1_000_000_000, suffix: 'B' },
  { value: 1_000_000, suffix: 'M' },
  { value: 1_000, suffix: 'K' },
] as const;

export function formatCount(n: number): string {
  if (!Number.isFinite(n)) {
    return '0';
  }

  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);

  for (const unit of COUNT_UNITS) {
    if (abs >= unit.value) {
      const scaled = abs / unit.value;
      const rounded = scaled >= 10 ? Math.round(scaled).toString() : scaled.toFixed(1).replace(/\.0$/, '');
      return `${sign}${rounded}${unit.suffix}`;
    }
  }

  if (abs >= 1) {
    return `${sign}${abs.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  }

  return `${sign}${abs.toPrecision(1)}`;
}

export function assertOk<T>(value: T, message = 'Unexpected null or undefined value'): T {
  if (value === null || value === undefined) {
    throw new Error(message);
  }

  return value;
}
