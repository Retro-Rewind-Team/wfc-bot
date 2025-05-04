import { CacheType, ChatInputCommandInteraction, InteractionReplyOptions, MessageFlags, } from "discord.js";
import { createUserEmbed, makeRequest, pidToFc, resolvePidFromString, validateId } from "../utils.js";
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

    await reply(
        interaction,
        priv,
        { embeds: [createUserEmbed(res.User, priv)] }
    );
}
