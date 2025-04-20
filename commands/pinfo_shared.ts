import { CacheType, ChatInputCommandInteraction, EmbedBuilder, InteractionReplyOptions, MessageFlags, } from "discord.js";
import { fmtTimeSpan, getColor, makeRequest, pidToFc, resolvePidFromString, validateId, WiiLinkUser } from "../utils.js";
import { getConfig } from "../config.js";

const config = getConfig();
const idRegex = new RegExp(/^\d+$/);

function fmtDeviceID(deviceIDs: number[]) {
    if (!deviceIDs)
        return "null";

    let ret = "";

    for (let i = 0; i < deviceIDs.length; i++) {
        const deviceID = deviceIDs[i];
        switch (deviceID) {
        case 33869561:
        case 59541067:
        case 68042647:
        case 107866953:
        case 170939432:
        case 172260247:
            ret += deviceID + " (leaked)";
            break;
        case 67349608:
            ret += deviceID + " (dolphin)";
            break;
        default:
            ret += deviceID;
        }

        ret += (i + 1 == deviceIDs.length ? "" : ", ");
    }

    return ret;
}

async function reply(interaction: ChatInputCommandInteraction<CacheType>, priv: boolean, options: InteractionReplyOptions) {
    if (priv) {
        if (typeof options.flags == "number")
            options.flags |= MessageFlags.Ephemeral;
        else
            options.flags = MessageFlags.Ephemeral;
    }

    await interaction.reply(options);
}

export async function pinfo(interaction: ChatInputCommandInteraction<CacheType>, priv: boolean) {
    let id = interaction.options.getString("id", true);
    id = id.trim();

    if (!validateId(id)) {
        await reply(
            interaction,
            priv,
            { content: `Error retrieving friend code or pid "${id}": Incorrect format` }
        );
        return;
    }

    const pid = resolvePidFromString(id);

    const fc = pidToFc(pid);
    const [success, res] = await makeRequest("/api/pinfo", "POST", {
        pid: pid,
        secret: priv ? config.wfcSecret : null
    });
    if (!success) {
        await reply(
            interaction,
            priv,
            { content: `Failed to query friend code "${fc}": error ${res.Error ?? "no error message provided"}` }
        );

        return;
    }

    const embed = new EmbedBuilder()
        .setColor(getColor())
        .setTitle(`Player info for friend code ${fc}`)
        .setThumbnail(`https://${config.statusServer}/miiimg?fc=${fc}`)
        .setTimestamp();

    const user: WiiLinkUser = res.User;

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

    embed.addFields(
        { name: "Profile ID", value: `${user.ProfileId}` },
        { name: "Mii Name", value: `${user.LastInGameSn}` },
        { name: "Open Host", value: `${user.OpenHost}` },
        { name: "Banned", value: `${user.Restricted}${expiredBan ? " (Expired)" : ""}` }
    );

    if (user.Restricted || expiredBan) {
        if (priv) {
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

        if (priv) {
            embed.addFields({
                name: "Hidden Reason",
                value: `${user.BanReasonHidden && user.BanReasonHidden.length != 0 ? user.BanReasonHidden : "None"}`
            });
        }

        embed.addFields(
            { name: "Ban Issued", value: `<t:${issuedDate}:F>` },
            { name: "Ban Expires", value: `<t:${expiresDate}:F>` },
            { name: "Ban Length", value: `${banLengthStr ?? "Unknown"}` },
        );
    }

    if (priv) {
        embed.addFields(
            { name: "User ID", value: `${user.UserId}` },
            { name: "Gsbr Code", value: `${user.GsbrCode}` },
            { name: "NG Device IDs", value: `${fmtDeviceID(user.NgDeviceId)}` },
            { name: "Email", value: `${user.Email}` },
            { name: "Unique Nick", value: `${user.UniqueNick}` },
            { name: "First Name", value: `${user.FirstName}` },
            { name: "Last Name", value: `${user.LastName}` },
            { name: "Last IP Address", value: `${user.LastIPAddress}` },
            { name: "Console Serial Numbers", value: `${user.Csnum}` },
        );
    }

    await reply(
        interaction,
        priv,
        { embeds: [embed], }
    );
}
