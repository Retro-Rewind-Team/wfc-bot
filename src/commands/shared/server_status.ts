export const enum StatusColor {
    RED,
    YELLOW,
    GREEN,
}

export interface Status {
    color: StatusColor,
    message: string,
}

export function getStatusColorEmoji(statusColor: StatusColor): string {
    switch (statusColor) {
    case StatusColor.RED:
        return "🔴";
    case StatusColor.YELLOW:
        return "🟡";
    case StatusColor.GREEN:
        return "🟢";
    }
}

export function getStatusColorText(statusColor: StatusColor): string {
    switch (statusColor) {
    case StatusColor.RED:
        return "OFFLINE";
    case StatusColor.YELLOW:
        return "POOR";
    case StatusColor.GREEN:
        return "GOOD";
    }
}

export function getStatusText(status: Status): string {
    return `Server Status: ${getStatusColorText(status.color)} - ${status.message}`;
}
