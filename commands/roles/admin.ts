import { CacheType, ChatInputCommandInteraction, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { getConfig } from "../../config.js";

const config = getConfig();

export default {
    modOnly: false,
    adminOnly: true,

    // Only allowed to list admins. Admins should not be able to propagate.
    data: new SlashCommandBuilder()
        .setName("admin")
        .setDescription("Manage admins")
        .addSubcommand(subcommand => subcommand.setName("list")
            .setDescription("List admins"))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    exec: async function(interaction: ChatInputCommandInteraction<CacheType>) {
        const subcommand = interaction.options.getSubcommand();

        if (!config.allowedAdmins)
            config.allowedAdmins = [];

        switch (subcommand) {
        case "list": {
            const uids = Object.values(config.allowedAdmins);

            let content = uids.map((uid) => `<@${uid}>`).join("\n");
            if (content.length == 0)
                content = "No moderators are set!";

            await interaction.reply({
                content: content,
                flags: MessageFlags.Ephemeral
            });

            break;
        }
        }
    }
};
