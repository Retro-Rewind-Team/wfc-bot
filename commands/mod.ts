import { CacheType, ChatInputCommandInteraction, EmbedBuilder, GuildMember, PermissionFlagsBits, SlashCommandBuilder, User } from "discord.js";
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
            { name: "Moderator", value: `<@${member?.id ?? "Unknown"}>` },
            { name: "Updated User", value: `<@${updatedUser.id}>` },
        )
        .setTimestamp();

    await channels.logs.send({ embeds: [embed] });
}

export default {
    modOnly: false,
    adminOnly: true,

    data: new SlashCommandBuilder()
        .setName("mod")
        .setDescription("Manage moderators")
        .addSubcommand(subcommand => subcommand.setName("add")
            .setDescription("Add a moderator")
            .addUserOption(option => option.setName("user")
                .setDescription("The user to add as a moderator")
                .setRequired(true)))
        .addSubcommand(subcommand => subcommand.setName("remove")
            .setDescription("Remove a moderator")
            .addUserOption(option => option.setName("user")
                .setDescription("The user to remove as a moderator")
                .setRequired(true)))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    exec: async function(interaction: ChatInputCommandInteraction<CacheType>) {
        const subcommand = interaction.options.getSubcommand();
        const user = interaction.options.getUser("user")!;

        if (!config.allowedModerators)
            config.allowedModerators = [];

        if (subcommand === "add") {
            if (!config.allowedModerators.includes(user.id)) {
                config.allowedModerators.push(user.id);

                setConfig(config);

                await interaction.reply({ content: `User ${user.tag} has been added as a moderator.` });
                await sendEmbed(interaction, "Moderator Addition", user);
            }
            else
                await interaction.reply({ content: `User ${user.tag} is already a moderator.` });
        }
        else if (subcommand === "remove") {
            const index = config.allowedModerators.indexOf(user.id);

            if (index > -1) {
                config.allowedModerators.splice(index, 1);

                setConfig(config);

                await interaction.reply({ content: `User ${user.tag} has been removed as a moderator.` });

                await sendEmbed(interaction, "Moderator Removal", user);
            }
            else
                await interaction.reply({ content: `User ${user.tag} is not a moderator.` });
        }
    }
};
