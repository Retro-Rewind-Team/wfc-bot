import { CacheType, ChatInputCommandInteraction, EmbedBuilder, GuildMember, PermissionFlagsBits, SlashCommandBuilder, TextChannel, User } from "discord.js";
import { client } from "../index.js";
import config from "../config.json" with { type: "json" };
import fs from "fs";
import path from "path";
import { getColor } from "../utils.js";

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

    await (client.channels.cache.get(config["logs-channel"]) as TextChannel | null)?.send({ embeds: [embed] });
}

export default {
    modOnly: false,
    adminOnly: true,

    data: new SlashCommandBuilder()
        .setName("mod")
        .setDescription("Manage moderators")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand
                .setName("add")
                .setDescription("Add a moderator")
                .addUserOption(option =>
                    option.setName("user")
                        .setDescription("The user to add as a moderator")
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName("remove")
                .setDescription("Remove a moderator")
                .addUserOption(option =>
                    option.setName("user")
                        .setDescription("The user to remove as a moderator")
                        .setRequired(true))),

    exec: async function(interaction: ChatInputCommandInteraction<CacheType>) {
        const subcommand = interaction.options.getSubcommand();
        const user = interaction.options.getUser("user")!;
        const configPath = path.join(import.meta.dirname, "../config.json");

        if (!config["allowed-moderators"])
            config["allowed-moderators"] = [];

        if (subcommand === "add") {
            if (!config["allowed-moderators"].includes(user.id)) {
                config["allowed-moderators"].push(user.id);
                fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
                await interaction.reply({ content: `User ${user.tag} has been added as a moderator.` });

                await sendEmbed(interaction, "Moderator Addition", user);
            } else
                await interaction.reply({ content: `User ${user.tag} is already a moderator.` });
        } else if (subcommand === "remove") {
            const index = config["allowed-moderators"].indexOf(user.id);
            if (index > -1) {
                config["allowed-moderators"].splice(index, 1);
                fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
                await interaction.reply({ content: `User ${user.tag} has been removed as a moderator.` });

                await sendEmbed(interaction, "Moderator Removal", user);
            } else
                await interaction.reply({ content: `User ${user.tag} is not a moderator.` });
        }
    }
};
