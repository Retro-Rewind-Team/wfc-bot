import crypto from "crypto";
import { CacheType, ChatInputCommandInteraction, EmbedBuilder, GuildMember, PermissionFlagsBits, TextChannel } from "discord.js";
import { client } from "./index.js";
import { getConfig } from "./config.js";
import { Dictionary } from "./dictionary.js";

const fcRegex = new RegExp(/[0-9]{4}-[0-9]{4}-[0-9]{4}/);
const pidRegex = new RegExp(/^\d+$/);
const config = getConfig();
const urlBase = `http://${config.wfcServer}:${config.wfcPort}`;

let currentColor = 0;
const colors = [
    0xf38ba8,
    0xfab387,
    0xf9e2af,
    0xa6e3a1,
    0x89b4fa,
    0xb4befe,
];

export function getColor() {
    currentColor++;

    if (currentColor >= colors.length)
        currentColor = 0;

    return colors[currentColor];
}

// Takes a string that's either an fc or pid and returns a pid
export function resolvePidFromString(fcOrPid: string) {
    if (fcOrPid.includes("-"))
        return parseInt(fcOrPid.replace(/-/g, ""), 10) >>> 0;
    else
        return parseInt(fcOrPid);
}

// Checks if friendCode or Pid is correct
export function validateId(fcOrPid: string) {
    return fcOrPid.match(pidRegex) || fcOrPid.match(fcRegex);
}

export function pidToFc(pid: number) {
    if (pid == 0)
        return "0000-0000-0000";
    else {
        try {
            const buffer = new Uint8Array(8);

            // buffer is pid in little endian, followed by RMCJ in little endian
            buffer[0] = pid >> 0;
            buffer[1] = pid >> 8;
            buffer[2] = pid >> 16;
            buffer[3] = pid >> 24;

            buffer[4] = ("J").charCodeAt(0); // the reversed online relevant game id
            buffer[5] = ("C").charCodeAt(0);
            buffer[6] = ("M").charCodeAt(0);
            buffer[7] = ("R").charCodeAt(0);

            const md5 = crypto.createHash("md5").update(buffer).digest();
            let fc = ((BigInt(md5.at(0)! >> 1) << 32n) | BigInt(pid)).toString();

            if (fc.length < 12)
                fc = "0".repeat(12 - fc.length) + fc;

            return `${fc.slice(0, 4)}-${fc.slice(4, 8)}-${fc.slice(8, 12)}`;
        }
        catch {
            return "0000-0000-0000";
        }
    }
}

export function plural(count: number, text: string) {
    return count == 1 ? text : text + "s";
}

export async function makeRequest(route: string, method: string, data?: object) {
    const url = urlBase + route;

    try {
        const response = await fetch(url, {
            method: method,
            body: data ? JSON.stringify(data) : null
        });

        const rjson = await response.json();

        if (response.ok && !rjson.Error)
            return [true, rjson];
        else {
            console.error(`Failed to make request ${url}, response: ${rjson ? rjson.Error : "no error message provided"}`);

            return [false, rjson];
        }
    }
    catch (error) {
        console.error(`Failed to make request ${url}, error: ${error}`);

        return [false, { error: error }];
    }
}

interface SendEmbedOpt {
    name: string,
    value: string,
    hidden?: boolean,
}

export interface WiiLinkUser {
    ProfileId: number,
    UserId: number,
    GsbrCode: string,
    NgDeviceId: number[],
    Email: string,
    UniqueNick: string,
    FirstName: string,
    LastName: string,
    Restricted: boolean,
    RestrictedDeviceId: number,
    BanReason: string,
    OpenHost: boolean,
    LastIPAddress: string,
    LastInGameSn: string,
    Csnum: string[],
    BanModerator: string,
    BanIssued: string,
    BanExpires: string,
}

export async function sendEmbedLog(interaction: ChatInputCommandInteraction<CacheType>, action: string, fc: string, user: WiiLinkUser, opts: SendEmbedOpt[], hideMiiName = false, noPublicEmbed = false) {
    const miiName = user.LastInGameSn != "" ? user.LastInGameSn : "Unknown";
    const member = interaction.member as GuildMember | null;
    const thumbnail = `https://${config.statusServer}/miiimg?fc=${fc}`;

    const privEmbed = new EmbedBuilder()
        .setColor(getColor())
        .setTitle(`${action.charAt(0).toUpperCase() + action.slice(1)} performed by ${member?.displayName ?? "Unknown"}`)
        .addFields(
            { name: "Server", value: interaction.guild!.name },
            { name: "Moderator", value: `<@${member?.id ?? "Unknown"}>` },
            { name: "Friend Code", value: fc },
            { name: "Mii Name", value: miiName },
            { name: "IP", value: user.LastIPAddress != "" ? user.LastIPAddress : "Unknown" }
        )
        .setTimestamp();

    privEmbed.setThumbnail(thumbnail);
    console.log(thumbnail);

    if (opts)
        privEmbed.addFields(...opts);

    await (client.channels.cache.get(config.logsChannel) as TextChannel | null)?.send({ embeds: [privEmbed] });
    await interaction.reply({ content: `Successful ${action} performed on friend code "${fc}"` });

    if (noPublicEmbed)
        return;

    const pubEmbed = new EmbedBuilder()
        .setColor(getColor())
        .setTitle(`${action.charAt(0).toUpperCase() + action.slice(1)} performed by moderator`)
        .addFields(
            { name: "Friend Code", value: fc },
            { name: "Mii Name", value: hideMiiName ? "\\*\\*\\*\\*\\*" : miiName }
        )
        .setTimestamp();


    if (!hideMiiName)
        pubEmbed.setThumbnail(thumbnail);

    if (opts) {
        const filtered = opts.filter((opt) => !opt["hidden"]);

        pubEmbed.addFields(...filtered);
    }

    await (client.channels.cache.get(config.publicLogsChannel) as TextChannel | null)?.send({ embeds: [pubEmbed] });
}

export function fmtHex(n: number): string {
    let ret = n.toString(16).toUpperCase();

    if (ret.length <= 4)
        ret = "0".repeat(4 - ret.length) + ret;
    else if (ret.length < 8)
        ret = "0".repeat(8 - ret.length) + ret;

    return "0x" + ret;
}

export function fmtTimeSpan(diff: number): string {
    const days = Math.floor(diff / (60 * 60 * 24));
    diff -= days * (60 * 60 * 24);

    const hours = Math.floor(diff / (60 * 60));
    diff -= hours * (60 * 60);

    const mins = Math.floor(diff / (60));
    diff -= mins * (60);

    const seconds = Math.floor(diff);

    return `${days} Days, ${hours} Hours, ${mins} Minutes, ${seconds} Seconds`;
}

export function resolveModRestrictPermission() {
    return (PermissionFlagsBits as Dictionary<bigint>)[config.modRestrictPerm] as bigint;
}
