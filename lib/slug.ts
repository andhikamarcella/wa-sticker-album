const TRIM_HYPHENS_REGEX = /(^-+|-+$)/g;
const NON_ALPHANUMERIC_REGEX = /[^a-z0-9-]/g;
const SEPARATOR_REGEX = /[\s_]+/g;
const COLLAPSE_HYPHENS_REGEX = /-{2,}/g;

export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
    .replace(SEPARATOR_REGEX, '-')
    .replace(NON_ALPHANUMERIC_REGEX, '')
    .replace(COLLAPSE_HYPHENS_REGEX, '-')
    .replace(TRIM_HYPHENS_REGEX, '');
}
