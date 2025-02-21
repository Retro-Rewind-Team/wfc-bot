const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const config = require("../config.json");
const fs = require("fs");
const path = require("path");

module.exports = {
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

    exec: async function (interaction) {
        const subcommand = interaction.options.getSubcommand();
        const user = interaction.options.getUser("user");
        const configPath = path.join(__dirname, "../config.json");

        if (subcommand === "add") {
            if (!config["allowed-moderators"].includes(user.id)) {
                config["allowed-moderators"].push(user.id);
                fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
                await interaction.reply({ content: `User ${user.tag} has been added as a moderator.` });
            } else {
                await interaction.reply({ content: `User ${user.tag} is already a moderator.` });
            }
        } else if (subcommand === "remove") {
            const index = config["allowed-moderators"].indexOf(user.id);
            if (index > -1) {
                config["allowed-moderators"].splice(index, 1);
                fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
                await interaction.reply({ content: `User ${user.tag} has been removed as a moderator.` });
            } else {
                await interaction.reply({ content: `User ${user.tag} is not a moderator.` });
            }
        }
    }
};