import { CacheType, ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";

const serialRegexp = /([0-9]*)/;

export default {
    modOnly: false,
    adminOnly: false,

    data: new SlashCommandBuilder()
        .setName("dolphin_timestamp")
        .setDescription("List the candidate timestamps for Dolphin serial generators")
        .addStringOption(option => option.setName("serial")
            .setDescription("The serial")
            .setRequired(true)),

    exec: async function(interaction: ChatInputCommandInteraction<CacheType>) {
        const serialRaw = interaction.options.getString("serial", true);

        const matches = serialRaw.match(serialRegexp);

        if (!matches || !matches[0] || matches[0].length < 8 || matches[0].length > 9) {
            await interaction.reply({
                content: `The provided serial '${serialRaw}' is not in the correct format! There should be 9-10 numbers in your serial.`,
            });
            return;
        }

        const [legacy, unix] = decode(matches[0]);

        let fmtLegacy = "— none in range —";
        let fmtUnix = "— none in range —";

        if (legacy.length > 0)
            fmtLegacy = legacy.map(l => "* " + l.toUTCString()).join("\n");

        if (unix.length > 0)
            fmtUnix = unix.map(l => l.toUTCString()).join("\n");

        const response = `Legacy (%j%H%M%S)\n${fmtLegacy}\n\nCurrent (tail-of-Unix-time)\n${fmtUnix}`;

        await interaction.reply({
            content: response,
        });
    }
};

// Adapted from https://gabrlel.github.io/dst.html, with permission.
const BILLION = 1_000_000_000;

interface IntermediateDate {
    day: number,
    hour: number,
    minute: number,
    second: number
}

/* ---------- Legacy decoder (%j%H%M%S) ---------- */
function parseLegacy(serial: string): IntermediateDate | null {
    const s = serial.padStart(9, "0");
    const doy = parseInt(s.slice(0, 3), 10);
    const hour = parseInt(s.slice(3, 5), 10);
    const min = parseInt(s.slice(5, 7), 10);
    const sec = parseInt(s.slice(7, 9), 10);

    if (doy < 1 || doy > 366 || hour > 23 || min > 59 || sec > 59)
        return null;

    return { day: doy, hour, minute: min, second: sec };
}
function buildLegacyDate(year: number, p: IntermediateDate) {
    const d = new Date(year, 0, 1, p.hour, p.minute, p.second);
    d.setDate(d.getDate() + p.day - 1);

    return d.getFullYear() == year ? d : null; // reject overflow on non‑leap years
}

function enumerateLegacy(serial: string, yFrom: number, yTo: number) {
    const parts = parseLegacy(serial);
    if (!parts)
        return [];

    const list = [];

    for (let y = yFrom; y <= yTo; y++) {
        const dt = buildLegacyDate(y, parts);

        if (dt)
            list.push(dt);
    }

    return list;
}

/* ---------- Current decoder (tail‑of‑Unix‑time) ---------- */
function enumerateCurrent(serial: string, yFrom: number, yTo: number) {
    const n = Number(serial.replace(/^0+/, ""));

    if (!Number.isFinite(n) || n >= BILLION)
        return [];

    const startTs = Date.UTC(yFrom, 0, 1) / 1000;
    const endTs = Date.UTC(yTo + 1, 0, 1) / 1000 - 1;
    const kMin = Math.ceil((startTs - n) / BILLION);
    const kMax = Math.floor((endTs - n) / BILLION);

    const list = [];
    for (let k = kMin; k <= kMax; k++) {
        const ts = n + k * BILLION;
        list.push(new Date(ts * 1000));
    }

    return list;
}

function decode(serial: string): [Date[], Date[]] {
    const yFrom = 2017;
    const yTo = (new Date()).getUTCFullYear();

    const legacyDates = enumerateLegacy(serial, yFrom, yTo);
    const currentDates = enumerateCurrent(serial, yFrom, yTo);

    return [legacyDates, currentDates];
}
