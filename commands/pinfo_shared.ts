import { CacheType, ChatInputCommandInteraction, EmbedBuilder, InteractionReplyOptions, MessageFlags, } from "discord.js";
import { fmtTimeSpan, getColor, makeRequest, pidToFc, resolvePidFromString, validateId, WiiLinkUser } from "../utils.js";
import { getConfig } from "../config.js";

const config = getConfig();

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
        .setTimestamp();

    const user: WiiLinkUser = res.User;

    let issuedDate = Date.parse(user.BanIssued);
    let expiresDate = Date.parse(user.BanExpires);
    let banLengthStr = null;

    if (!isNaN(expiresDate) && !isNaN(expiresDate)) {
        issuedDate = Math.round(issuedDate / 1000);
        expiresDate = Math.round(expiresDate / 1000);

        if (expiresDate > Date.now())
            user.Restricted = false;
        else
            banLengthStr = fmtTimeSpan(expiresDate - issuedDate);

    }

    embed.addFields(
        { name: "Profile ID", value: `${user.ProfileId}` },
        { name: "Mii Name", value: `${user.LastInGameSn}` },
        { name: "Open Host", value: `${user.OpenHost}` },
        { name: "Banned", value: `${user.Restricted}` }
    );

    if (user.Restricted) {
        embed.addFields(
            { name: "Ban Reason", value: `${user.BanReason}` },
            { name: "Ban Issued", value: `<t:${issuedDate}:F>` },
            { name: "Ban Expires", value: `<t:${expiresDate}:F>` },
            { name: "Ban Length", value: `${banLengthStr ?? "Unknown"}` }
        );
    }

    if (priv) {
        embed.addFields(
            { name: "User ID", value: `${user.UserId}` },
            { name: "Gsbr Code", value: `${user.GsbrCode}` },
            { name: "NG Device IDs", value: `${user.NgDeviceId}` },
            { name: "Email", value: `${user.Email}` },
            { name: "Unique Nick", value: `${user.UniqueNick}` },
            { name: "First Name", value: `${user.FirstName}` },
            { name: "Last Name", value: `${user.LastName}` },
            { name: "Restricted Device ID", value: `${user.RestrictedDeviceId}` },
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
