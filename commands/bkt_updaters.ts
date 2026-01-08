import { CacheType, ChatInputCommandInteraction, EmbedBuilder, GuildMember, MessageFlags, PermissionFlagsBits, SlashCommandBuilder, User } from "discord.js";
import { getChannels, getConfig, setConfig } from "../config.js";
import { getColor } from "../utils.js";

const config = getConfig();
const channels = getChannels();

async function sendEmbed(interaction: ChatInputCommandInteraction<CacheType>, action: string, updatedUser: User) {
    const member = interaction.member as GuildMember | null;

    const embed = new EmbedBuilder()
        .setColor(getColor())
        .setTitle(`${action.charAt(0).toUpperCase() + action.slice(1)} performed by ${member?.displayName ?? "Unknown"}`)
        .addFields(
            { name: "Server", value: interaction.guild!.name },
            { name: "BKTUpdater", value: `<@${member?.id ?? "Unknown"}>` },
            { name: "Updated User", value: `<@${updatedUser.id}>` },
        )
        .setTimestamp();

    await channels.logs.send({ embeds: [embed] });
}

export default {
    modOnly: false,
    adminOnly: true,

    data: new SlashCommandBuilder()
        .setName("bkt_updaters")
        .setDescription("Manage BKT Updaters")
        .addSubcommand(subcommand => subcommand.setName("add")
            .setDescription("Add a BKT Updater")
            .addUserOption(option => option.setName("user")
                .setDescription("The user to add as a BKTUpdater")
                .setRequired(true)))
        .addSubcommand(subcommand => subcommand.setName("remove")
            .setDescription("Remove a BKTUpdater")
            .addUserOption(option => option.setName("user")
                .setDescription("The user to remove as a BKTUpdater")
                .setRequired(true)))
        .addSubcommand(subcommand => subcommand.setName("list")
            .setDescription("List BKTUpdaters"))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    exec: async function(interaction: ChatInputCommandInteraction<CacheType>) {
        const subcommand = interaction.options.getSubcommand();
        const user = interaction.options.getUser("user")!;

        if (!config.allowedBKTUpdaters)
            config.allowedBKTUpdaters = [];

        switch (subcommand) {
        case "add": {
            if (!config.allowedBKTUpdaters.includes(user.id)) {
                config.allowedBKTUpdaters.push(user.id);

                setConfig(config);

                await interaction.reply({ content: `User ${user.tag} has been added as a BKT Updater.` });
                await sendEmbed(interaction, "BKT Updater Addition", user);
            }
            else
                await interaction.reply({ content: `User ${user.tag} is already a BKT Updater.` });

            break;
        }
        case "remove": {
            const index = config.allowedBKTUpdaters.indexOf(user.id);

            if (index > -1) {
                config.allowedBKTUpdaters.splice(index, 1);

                setConfig(config);

                await interaction.reply({ content: `User ${user.tag} has been removed as a BKT Updater.` });

                await sendEmbed(interaction, "BKT Updater Removal", user);
            }
            else
                await interaction.reply({ content: `User ${user.tag} is not a BKTUpdater.` });

            break;
        }
        case "list": {
            const uids = Object.values(config.allowedBKTUpdaters);

            let content = uids.map((uid) => `<@${uid}>`).join("\n");
            if (content.length == 0)
                content = "No BKT Updaters are set!";

            await interaction.reply({
                content: content,
                flags: MessageFlags.Ephemeral
            });

            break;
        }
        }
    }
};
