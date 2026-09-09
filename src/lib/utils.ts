export const formatPkr = (value: number) => `PKR ${new Intl.NumberFormat('en-PK').format(value)}`;
export const formatDate = (value?: string | null) => value ? new Intl.DateTimeFormat('en-PK', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value)) : 'Not set';
export const classNames = (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(' ');
export const titleCase = (value: string) => value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
