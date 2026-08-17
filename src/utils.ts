import { _fetch as fetch } from "#src/fetch.js";
import crypto from "crypto";
import { CacheType, ChatInputCommandInteraction, EmbedBuilder, GuildMember, PermissionFlagsBits, TextChannel } from "discord.js";
import { getChannels, getConfig } from "#src/config.js";
import { Dictionary } from "#src/dictionary.js";

const fcRegex = new RegExp(/[0-9]{4}-[0-9]{4}-[0-9]{4}/);
const pidRegex = new RegExp(/^\d+$/);

let currentColor = 0;
const colors = [
    0xf38ba8,
    0xfab387,
    0xf9e2af,
    0xa6e3a1,
    0x89b4fa,
    0xb4befe,
];

export function getColor(): number {
    currentColor++;

    if (currentColor >= colors.length)
        currentColor = 0;

    return colors[currentColor];
}

// Takes a string that's either an fc or pid and returns a pid
export function resolvePidFromString(fcOrPid: string): number {
    if (fcOrPid.includes("-"))
        return parseInt(fcOrPid.replace(/-/g, ""), 10) >>> 0;
    else
        return parseInt(fcOrPid);
}

// Checks if friendCode or Pid is correct
export function validateID(fcOrPid: string): [boolean, string | null] {
    if (fcOrPid == "")
        return [false, "Empty fc or pid"];

    if (fcOrPid.match(pidRegex)) {
        const pidNum = parseInt(fcOrPid);
        if (pidNum > 4294967295)
            return [false, "This number is too large. Did you forget hyphens?"];

        return [true, null];
    }

    if (!fcOrPid.match(fcRegex))
        return [false, "Invalid Format"];

    // For FCs, check if they can convert to a pid and then back to the FC.
    // Sometimes the conversion mangles the FC, in which case it's invalid.
    const mangled = pidToFc(resolvePidFromString(fcOrPid));
    const ret = fcOrPid == mangled;

    return [ret, ret ? null : `Valid Format, but the FC would have been mangled to ${mangled}`];
}

export function pidToFc(pid: number): string {
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

export function plural(count: number, text: string): string {
    return count == 1 ? text : text + "s";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function makeWFCRequest(route: string, method: string, data?: object): Promise<[boolean, any]> {
    const config = getConfig();
    const url = config.wfcAPIBase + route;

    try {
        const response = await fetch(url, {
            method: method,
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${config.wfcSecret}`,
            },
            body: data ? JSON.stringify(data) : null,
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

        return [false, { Error: error }];
    }
}

export interface WiiLinkUser {
    ProfileId: number;
    UserId: number;
    GsbrCode: string;
    NgDeviceId: number[];
    Email: string;
    UniqueNick: string;
    FirstName: string;
    LastName: string;
    Restricted: boolean;
    RestrictedDeviceId: number;
    BanReason: string;
    OpenHost: boolean;
    LastIPAddress: string;
    LastInGameSn: string;
    Csnum: string[];
    DiscordID: string;
    BanModerator: string;
    BanReasonHidden: string;
    BanIssued: string;
    BanExpires: string;
}

interface SendEmbedLogField {
    name: string;
    value: string;
    hidden?: boolean;
}

export interface SendEmbedLogOpts {
    action: string;
    extraFields?: SendEmbedLogField[];
    hideMii?: boolean;
    noPublicEmbed?: boolean;
    verbose?: boolean;
    showBanInfo?: boolean;
    // Show who sent the command publically
    showMember?: boolean;
    // Action was not performed by a moderator
    nonModerator?: boolean;
    pubChannel?: TextChannel;
}

export async function sendEmbedLog(
    interaction: ChatInputCommandInteraction<CacheType>,
    user: WiiLinkUser,
    opts: SendEmbedLogOpts,
): Promise<void> {
    const fc = pidToFc(user.ProfileId);
    const member = interaction.member as GuildMember ?? interaction.user;

    const privEmbed = new EmbedBuilder()
        .setColor(getColor())
        .setTitle(`${capitalize(opts.action)} performed by ${member.displayName}`)
        .setTimestamp()
        .addFields(
            { name: "Server", value: interaction.guild?.name ?? "Unknown"},
            {
                name: opts.nonModerator ? "User" : "Moderator",
                value: `<@${interaction.user.id}>`,
            },
        );

    if (opts.extraFields)
        privEmbed.addFields(...opts.extraFields);

    createUserEmbed(user, {
        priv: true,
        template: privEmbed,
        hideMii: false,
        verbose: opts.verbose,
        showBanInfo: opts.showBanInfo,
    });

    await getChannels().logs.send({ embeds: [privEmbed] });

    const content = `Successful ${opts.action} performed on friend code "${fc}"`;
    if (interaction.deferred)
        await interaction.editReply(content);
    else if (interaction.replied)
        await interaction.followUp(content);
    else
        await interaction.reply(content);

    if (opts.noPublicEmbed)
        return;

    let title = `${capitalize(opts.action)} performed by `;
    if (opts.showMember)
        title += member.displayName;
    else if (opts.nonModerator)
        title += "user";
    else
        title += "moderator";

    const pubEmbed = new EmbedBuilder()
        .setColor(getColor())
        .setTitle(title)
        .setTimestamp();

    if (opts.showMember) {
        pubEmbed.addFields({
            name: opts.nonModerator ? "User" : "Moderator",
            value: `<@${interaction.user.id}>`,
        });
    }

    if (opts.extraFields) {
        const filtered = opts.extraFields.filter((opt) => !opt["hidden"]);

        pubEmbed.addFields(...filtered);
    }

    createUserEmbed(user, {
        priv: false,
        template: pubEmbed,
        hideMii: opts.hideMii,
        verbose: opts.verbose,
        showBanInfo: opts.showBanInfo,
    });

    await (opts.pubChannel ?? getChannels().publicLogs).send({ embeds: [pubEmbed] });
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

export function resolveModRestrictPermission(): bigint {
    return (PermissionFlagsBits as Dictionary<bigint>)[getConfig().modRestrictPerm] as bigint;
}

const idRegex = new RegExp(/^\d+$/);

function fmtDeviceID(deviceIDs: number[]): string {
    if (!deviceIDs)
        return "Null";

    if (deviceIDs.length == 0)
        return "None";

    let ret = "";

    for (let i = 0; i < deviceIDs.length; i++) {
        const deviceID = deviceIDs[i];
        switch (deviceID) {
        case 0x02000001:
            ret += deviceID + " (internal)";
            break;
        case 0x403ac68:
            ret += deviceID + " (dolphin)";
            break;
        case 0x0204cef9:
        case 0x038c864b:
        case 0x040e3f97:
        case 0x04cb7515:
        case 0x066deb49:
        case 0x06bcc32d:
        case 0x06d0437a:
        case 0x089120c8:
        case 0x0a305428:
        case 0x0a447b97:
        case 0x0a1e97cf: // Thanks gab
        case 0x0e19d5ed:
        case 0x0e31482b:
        case 0x2428a8cb:
        case 0x247dd10b:
            ret += deviceID + " (leaked)";
            break;
        default:
            ret += deviceID;
        }

        ret += (i + 1 == deviceIDs.length ? "" : ", ");
    }

    return ret;
}

export interface CreateUserEmbedOpts {
    // Private embed, hide sensitive fields
    priv: boolean;
    // Template embed, prefill certain fields and avoid setting the title
    template?: EmbedBuilder;
    // Hide the Mii name and image
    hideMii?: boolean;
    // Show detailed fields for private embeds
    verbose?: boolean;
    // Show ban info
    showBanInfo?: boolean;
    // Default true. Determines if csnum, ip, etc are shown
    showPII?: boolean;
}

// Creates an embed based on a WiiLinkUser.
// priv exposes private fields such as IP Address, Device ID, and serials
// templateEmbed will prevent touching color, title, or timestamp
// hideMii avoids showing the mii image or name
// reduced will clear some of the clutter fields from private embeds.
export function createUserEmbed(
    user: WiiLinkUser,
    opts: CreateUserEmbedOpts,
): EmbedBuilder {
    const fc = pidToFc(user.ProfileId);

    if (opts.showPII == undefined)
        opts.showPII = true;

    const embed = opts.template
        ? opts.template
        : new EmbedBuilder()
            .setColor(getColor())
            .setTitle(`Player info for friend code ${fc}`)
            .setTimestamp();

    if (opts.priv || !opts.hideMii)
        embed.setThumbnail(getMiiImageURL(fc));

    let issuedDate = Date.parse(user.BanIssued);
    let expiresDate = Date.parse(user.BanExpires);
    let banLengthStr = null;
    let expiredBan = false;

    if (!isNaN(expiresDate) && !isNaN(expiresDate)) {
        issuedDate = Math.round(issuedDate / 1000);
        expiresDate = Math.round(expiresDate / 1000);

        if (expiresDate < Date.now() / 1000) {
            expiredBan = true;
            user.Restricted = false;
        }

        banLengthStr = fmtTimeSpan(expiresDate - issuedDate);
    }

    const miiName = !opts.priv && opts.hideMii
        ? "\\*\\*\\*\\*\\*"
        : user.LastInGameSn != ""
            ? user.LastInGameSn
            : "Unknown";

    embed.addFields(
        { name: "Profile ID", value: `${user.ProfileId}` },
        { name: "Friend Code", value: fc },
        { name: "Mii Name", value: miiName },
    );

    if (opts.verbose)
        embed.addFields({ name: "Open Host", value: `${user.OpenHost }` });

    if (user.DiscordID.length != 0) {
        embed.addFields({
            name: "Discord ID",
            value: `<@${user.DiscordID }>`,
        });
    }

    if (opts.showBanInfo) {
        embed.addFields({ name: "Banned", value: `${user.Restricted}${expiredBan ? " (Expired)" : ""}` });

        if (user.Restricted || expiredBan) {
            if (opts.priv) {
                let banModerator;

                if (!user.BanModerator || user.BanModerator == "" || user.BanModerator == "admin")
                    banModerator = "Unknown";
                else if (user.BanModerator.match(idRegex))
                    banModerator = `<@${user.BanModerator}>`;
                else
                    banModerator = user.BanModerator;

                embed.addFields({ name: "Ban Moderator", value: `${banModerator}` });
            }

            embed.addFields({ name: "Ban Reason", value: `${user.BanReason}` });

            if (opts.priv) {
                embed.addFields({
                    name: "Hidden Reason",
                    value: `${user.BanReasonHidden && user.BanReasonHidden.length != 0 ? user.BanReasonHidden : "None"}`,
                });
            }

            embed.addFields(
                { name: "Ban Issued", value: `<t:${issuedDate}:F>` },
                { name: "Ban Expires", value: `<t:${expiresDate}:F>` },
                { name: "Ban Length", value: `${banLengthStr ?? "Unknown"}` },
            );
        }
    }

    if (opts.priv) {
        if (opts.verbose) {
            embed.addFields(
                { name: "User ID", value: `${user.UserId}` },
                { name: "Gsbr Code", value: `${user.GsbrCode}` },
                { name: "Email", value: `${user.Email}` },
                { name: "Unique Nick", value: `${user.UniqueNick}` },
                { name: "First Name", value: `${user.FirstName}` },
                { name: "Last Name", value: `${user.LastName}` },
            );
        }

        const csnums = !user.Csnum
            ? "Null"
            : user.Csnum.length == 0
                ? "None"
                : user.Csnum.join(", ");

        if (opts.showPII) {
            embed.addFields({ name: "NG Device IDs", value: `${fmtDeviceID(user.NgDeviceId) }` } );

            if (user.LastIPAddress != "") {
                embed.addFields(
                    { name: "Last IP Address", value: `${user.LastIPAddress }` },
                    { name: "IP Info", value: `https://ipinfo.io/${user.LastIPAddress }` },
                );
            }
            else
                embed.addFields({ name: "Last IP Address", value: "None" });

            embed.addFields({
                name: "Console Serial Numbers",
                value: `${csnums.length<=1024?csnums: "Too many Serial Numbers!" }`,
            });
        }
    }

    return embed;
}

export async function haste(body: string): Promise<[number, string, string]> {
    const config = getConfig();
    const res = await fetch(`${config.hasteServer}/documents`, {
        method: "POST",
        body: body,
    });

    if (!res.ok)
        return [res.status, "", res.statusText];

    const key = (await res.json()).key;

    return [200, `${config.hasteServer}/${key}`, ""];
}

export function throwInline(err: string): never {
    throw new Error(err);
}

export async function queryJson<T>(url: string): Promise<T | null> {
    const response = await fetch(url);

    if (!response.ok) {
        console.error(`Unable to fetch groups, status code: ${response.status}`);
        return null;
    }

    const json = await response.json();

    if (!json) {
        console.error(`Invalid response from ${url}, unable to populate groups!`);
        return null;
    }

    return json as T;
}

export function wrapTryCatch(fn: () => Promise<void>): () => Promise<void> {
    return async () => {
        try {
            await fn();
        }
        catch (e) {
            console.error(e);
        }
    };
}

export function getMiiImageURL(fc: string): string {
    return getConfig().miiEndPoint.replace("{fc}", fc);
}

export function capitalize(str: string): string {
    return `${str.charAt(0).toUpperCase() + str.slice(1)}`;
}
