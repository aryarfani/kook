/** Format a local calendar day with its offset for the export query. */
export function toLocalIso(date: Date, endOfDay: boolean): string {
    const pad = (value: number) => String(value).padStart(2, '0');
    const offsetMinutes = -date.getTimezoneOffset();
    const sign = offsetMinutes >= 0 ? '+' : '-';
    const absolute = Math.abs(offsetMinutes);

    const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    const time = endOfDay ? '23:59:59.999' : '00:00:00.000';
    const offset = `${sign}${pad(Math.floor(absolute / 60))}:${pad(absolute % 60)}`;

    return `${day}T${time}${offset}`;
}
