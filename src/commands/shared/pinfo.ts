import { CacheType, ChatInputCommandInteraction, InteractionReplyOptions, MessageFlags, } from "discord.js";
import { createUserEmbed, makeWFCRequest, pidToFc, resolvePidFromString, validateID, WiiLinkUser } from "#src/utils.js";
import { getConfig } from "#src/config.js";

const config = getConfig();

async function reply(
    interaction: ChatInputCommandInteraction<CacheType>,
    priv: boolean,
    options: InteractionReplyOptions
): Promise<void> {
    if (priv) {
        if (typeof options.flags == "number")
            options.flags |= MessageFlags.Ephemeral;
        else
            options.flags = MessageFlags.Ephemeral;
    }

    await interaction.reply(options);
}

export async function pinfo(interaction: ChatInputCommandInteraction<CacheType>, priv: boolean): Promise<void> {
    let id = interaction.options.getString("id", true);
    id = id.trim();

    const [valid, idErr] = validateID(id);
    if (!valid) {
        await reply(
            interaction,
            priv,
            { content: `Error retrieving friend code or pid "${id}": ${idErr}` }
        );
        return;
    }

    const pid = resolvePidFromString(id);

    const fc = pidToFc(pid);
    const [user, err] = await fetchPinfo(pid, priv);
    if (err) {
        await reply(
            interaction,
            priv,
            { content: `Failed to fetch info for friend code "${fc}": error ${err}` }
        );
        return;
    }

    await reply(
        interaction,
        priv,
        { embeds: [
            createUserEmbed(user, {
                priv: priv,
                hideMii: false,
                verbose: true,
                showBanInfo: true,
            })
        ]}
    );
}

export async function fetchPinfo(pid: number, priv: boolean): Promise<[WiiLinkUser, string | null]> {
    const [success, res] = await makeWFCRequest("/pinfo", "POST", {
        pid: pid,
        secret: priv ? config.wfcSecret : null,
    });

    return [ res.User, success ? null : res.Error ?? "no error message provided" ];
}
