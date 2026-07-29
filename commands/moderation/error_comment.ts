import { CacheType, ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder } from "discord.js";
import { PermissionBit } from "../shared/roles.js";
import { getWiiLinkErrorComments, getWiiLinkErrorDef, setWiiLinkErrorComments } from "../shared/error.js";

export default {
    permissions: PermissionBit.MODERATOR,

    data: new SlashCommandBuilder()
        .setName("error_comment")
        .setDescription("Manage error comments for the error command")
        .addSubcommand(subcommand => subcommand.setName("add")
            .setDescription("Add a comment to an error code")
            .addIntegerOption(option => option.setName("ecode")
                .setDescription("the error code to modify")
                .setRequired(true))
            .addStringOption(option => option.setName("comment")
                .setDescription("comment text to display")
                .setRequired(true)))
        .addSubcommand(subcommand => subcommand.setName("remove")
            .setDescription("Remove a comment from an error code")
            .addIntegerOption(option => option.setName("ecode")
                .setDescription("the error code to modify")
                .setRequired(true))
            .addIntegerOption(option => option.setName("index")
                .setDescription("comment index to remove (1-indexed)")
                .setRequired(true))),

    exec: async function(interaction: ChatInputCommandInteraction<CacheType>): Promise<void> {
        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
        case "add":
            await add(interaction);
            break;
        case "remove":
            await remove(interaction);
            break;
        }
    }
};

async function add(interaction: ChatInputCommandInteraction<CacheType>): Promise<void> {
    const ecode = interaction.options.getInteger("ecode", true);
    const length = ecode.toString().length;
    const comment = interaction.options.getString("comment", true);

    if (length < 5 || length > 6) {
        await interaction.reply({
            content: "Error Codes must be between 5 and 6 digits.",
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    if (comment.length == 0) {
        await interaction.reply({
            content: "The comment must not be empty",
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    const comments = getWiiLinkErrorComments(ecode) ?? [];
    comments.push(comment);

    await setWiiLinkErrorComments(ecode, comments);

    const wiiLinkErrorDef = getWiiLinkErrorDef(ecode);
    const commentsStr = comments.map((comment, idx) => `Comment ${idx + 1}: ${comment}\n`).join("\n");

    await interaction.reply({
        content: `Appended comment to error ${ecode}: ${wiiLinkErrorDef.name}\n\n${commentsStr}`
    });
}

async function remove(interaction: ChatInputCommandInteraction<CacheType>): Promise<void> {
    const ecode = interaction.options.getInteger("ecode", true);
    const length = ecode.toString().length;
    const idx = interaction.options.getInteger("index", true) - 1;

    if (length < 5 || length > 6) {
        await interaction.reply({
            content: "Error Codes must be between 5 and 6 digits.",
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    const comments = getWiiLinkErrorComments(ecode) ?? [];

    if (idx < 0 || idx >= comments.length) {
        await interaction.reply({
            content: `Index is out of bounds. Number of comments: (${comments.length})`,
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    const removed = comments.splice(idx);

    await setWiiLinkErrorComments(ecode, comments);

    const wiiLinkErrorDef = getWiiLinkErrorDef(ecode);
    const commentsStr = comments.length > 0
        ? comments.map((comment, idx) => `Comment ${idx + 1}: ${comment}\n`).join("\n")
        : "None";

    const content =
        `Removed comment from error ${ecode}: ${wiiLinkErrorDef.name}\n\n`
        + `Removed:\n${removed}\n\n`
        + `Remaining:\n${commentsStr}`;

    await interaction.reply({ content: content });
}
