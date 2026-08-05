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

// Maps to ingame glyphs
export function getStatusColorGlyph(statusColor: StatusColor): string {
    switch (statusColor) {
    case StatusColor.RED:
        return "\uE009"; // Angry
    case StatusColor.YELLOW:
        return "\uE00A"; // Sad
    case StatusColor.GREEN:
        return "\uE008"; // Smiley
    }
}

export function getStatusText(status: Status): string {
    return `Server Status: ${getStatusColorGlyph(status.color)} - ${status.message}`;
}
