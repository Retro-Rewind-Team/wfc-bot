export const enum StatusColor {
    RED,
    YELLOW,
    GREEN,
}

export interface Status {
    color: StatusColor,
    message: string,
}

interface Glyph {
    game: string;
    motd: string;
    emoji: string;
}

const glyphs: Record<StatusColor, Glyph> = {
    [StatusColor.RED]: { game: "\uE009", motd: ">:(", emoji:   "🔴" },
    [StatusColor.YELLOW]: { game: "\uE00A", motd: ":(", emoji: "🟡" },
    [StatusColor.GREEN]: { game: "\uE008", motd: ":)", emoji:  "🟢" }
};

export function getStatusColorEmoji(statusColor: StatusColor): string {
    return glyphs[statusColor].emoji;
}

// Maps to ingame glyphs
export function getStatusColorGlyph(statusColor: StatusColor): string {
    return glyphs[statusColor].game;
}

export function getStatusText(status: Status): string {
    return `Server Status: ${getStatusColorGlyph(status.color)} - ${status.message}`;
}

export function replaceGlyphsForDiscord(motd: string): string {
    for (const glyph of Object.values(glyphs))
        motd = motd.replace(glyph.game, glyph.motd);

    return motd;
}
