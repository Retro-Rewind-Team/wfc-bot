import { CacheType, ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { getChannels, getConfig } from "#src/config.js";
import { makeWFCRequest, pidToFc, resolvePidFromString, sendEmbedLog, validateID } from "#src/utils.js";
import { PermissionBit } from "#src/commands/shared/roles.js";
import { Command } from "#src/commands/shared/command.js";

const config = getConfig();

export const command: Command = {
    permissions: PermissionBit.NONE,
    featureFlags: [ "selfCommand" ],

    data: new SlashCommandBuilder()
        .setName("self")
        .setDescription("Perform a command on yourself or a froom you host")
        .addSubcommand(subcommand => subcommand.setName("kick")
            .setDescription("Kick yourself"))
        .addSubcommand(subcommand => subcommand.setName("froom_kick")
            .setDescription("Kick someone from a froom you host")
            .addStringOption(option => option.setName("id")
                .setDescription("friend code or pid to kick")
                .setRequired(true))),

    exec: async function(interaction: ChatInputCommandInteraction<CacheType>): Promise<void> {
        const subcommand = interaction.options.getSubcommand(true);

        switch (subcommand) {
        case "froom_kick":
            await froomKick(interaction);
            break;
        case "kick":
            await selfKick(interaction);
            break;
        }
    }
};

async function froomKick(interaction: ChatInputCommandInteraction<CacheType>): Promise<void> {
    const discordID = interaction.user.id;

    let id = interaction.options.getString("id", true);
    id = id.trim();

    const [valid, err] = validateID(id);
    if (!valid) {
        await interaction.reply({ content: `Error kicking friend code or pid "${id}": ${err}` });
        return;
    }

    const pid = resolvePidFromString(id);
    await interaction.deferReply();

    const [success, res] = await makeWFCRequest("/api/self", "POST", {
        secret: config.wfcSecret,
        discordID: discordID,
        command: "froom_kick",
        pid: pid,
    });

    if (!success) {
        await interaction.editReply({
            content: `Failed to kick friend code "${pidToFc(pid)}": error ${res.Error ?? "no error message provided"}`
        });
        return;
    }

    await sendEmbedLog(
        interaction,
        res.User,
        {
            action: "froom-kick",
            pubChannel: getChannels().publicSelfLogs,
        }
    );
}

async function selfKick(interaction: ChatInputCommandInteraction<CacheType>): Promise<void> {
    const discordID = interaction.user.id;

    await interaction.deferReply();

    const [success, res] = await makeWFCRequest("/api/self", "POST", {
        secret: config.wfcSecret,
        discordID: discordID,
        command: "kick",
    });

    if (!success) {
        await interaction.editReply({
            content: `Failed to self-kick: error ${res.Error ?? "no error message provided"}`
        });
        return;
    }

    await sendEmbedLog(
        interaction,
        res.User,
        {
            action: "self-kick",
            pubChannel: getChannels().publicSelfLogs,
        }
    );
}
