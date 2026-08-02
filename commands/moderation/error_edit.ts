import { CacheType, ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder } from "discord.js";
import { PermissionBit } from "../shared/roles.js";
import { getWiiLinkErrorAddendum, getWiiLinkErrorDef, setWiiLinkErrorAddendum } from "../shared/error.js";
import { capitalize } from "../../utils.js";

export default {
    permissions: PermissionBit.MODERATOR,

    data: new SlashCommandBuilder()
        .setName("error_edit")
        .setDescription("Manage error comments for the error command")
        .addSubcommandGroup(sg => sg.setName("comment")
            .setDescription("Manage error comments")
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
                    .setRequired(true))))
        .addSubcommandGroup(sg => sg.setName("override")
            .setDescription("Manage error overrides, which replace wiimmfi error info")
            .addSubcommand(subcommand => subcommand.setName("set")
                .setDescription("Set an override for an error code")
                .addIntegerOption(option => option.setName("ecode")
                    .setDescription("the error code to modify")
                    .setRequired(true))
                .addStringOption(option => option.setName("type")
                    .setDescription("type to override (class, section, group, etc)")
                    .setRequired(true))
                .addStringOption(option => option.setName("text")
                    .setDescription("override text to display, set to 'skip' to remove the message entirely")
                    .setRequired(true)))
            .addSubcommand(subcommand => subcommand.setName("remove")
                .setDescription("Remove a comment from an error code")
                .addIntegerOption(option => option.setName("ecode")
                    .setDescription("the error code to modify")
                    .setRequired(true))
                .addStringOption(option => option.setName("type")
                    .setDescription("type of override (class, section, group, etc) to remove")
                    .setRequired(true)))
            .addSubcommand(subcommand => subcommand.setName("list")
                .setDescription("List overrides for an error code")
                .addIntegerOption(option => option.setName("ecode")
                    .setDescription("the error code to list overrides of")
                    .setRequired(true)))),

    exec: async function(interaction: ChatInputCommandInteraction<CacheType>): Promise<void> {
        const subcommandGroup = interaction.options.getSubcommandGroup(true);
        const subcommand = interaction.options.getSubcommand();

        switch (subcommandGroup) {
        case "comment": {
            switch (subcommand) {
            case "add":
                await commentAdd(interaction);
                break;
            case "remove":
                await commentRemove(interaction);
                break;
            }
            break;
        }
        case "override": {
            switch (subcommand) {
            case "set":
                await overrideAdd(interaction);
                break;
            case "remove":
                await overrideRemove(interaction);
                break;
            case "list":
                await overrideList(interaction);
                break;
            }
            break;
        }
        }
    }
};

async function commentAdd(interaction: ChatInputCommandInteraction<CacheType>): Promise<void> {
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

    const addendum = getWiiLinkErrorAddendum(ecode);
    addendum.comments.push(comment);

    await setWiiLinkErrorAddendum(ecode, addendum);

    const wiiLinkErrorDef = getWiiLinkErrorDef(ecode);
    const commentsStr = addendum.comments.map((comment, idx) => `Comment ${idx + 1}: ${comment}\n`).join("\n");

    await interaction.reply({
        content: `Appended comment to error ${ecode}: ${wiiLinkErrorDef.name}\n\n${commentsStr}`
    });
}

async function commentRemove(interaction: ChatInputCommandInteraction<CacheType>): Promise<void> {
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

    const addendum = getWiiLinkErrorAddendum(ecode);
    const comments = addendum.comments;

    if (idx < 0 || idx >= comments.length) {
        await interaction.reply({
            content: `Index is out of bounds. Number of comments: (${comments.length})`,
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    const removed = comments.splice(idx);

    await setWiiLinkErrorAddendum(ecode, addendum);

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

async function overrideAdd(interaction: ChatInputCommandInteraction<CacheType>): Promise<void> {
    const ecode = interaction.options.getInteger("ecode", true);
    const length = ecode.toString().length;
    const type = interaction.options.getString("type", true).toLowerCase();
    const ctype = capitalize(type);
    const text = interaction.options.getString("text", true);

    if (length < 5 || length > 6) {
        await interaction.reply({
            content: "Error Codes must be between 5 and 6 digits.",
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    const addendum = getWiiLinkErrorAddendum(ecode);
    const oldText = addendum.overrides[type];
    addendum.overrides[type] = text;

    await setWiiLinkErrorAddendum(ecode, addendum);

    const content = oldText
        ? `Changed override for error ${ecode}, type ${ctype}:\nFrom: ${oldText}\nTo: ${text}`
        : `Added overrde for error ${ecode}, type ${ctype}: ${text}`;

    await interaction.reply({ content: content });
}

async function overrideRemove(interaction: ChatInputCommandInteraction<CacheType>): Promise<void> {
    const ecode = interaction.options.getInteger("ecode", true);
    const length = ecode.toString().length;
    const type = interaction.options.getString("type", true).toLowerCase();
    const ctype = capitalize(type);

    if (length < 5 || length > 6) {
        await interaction.reply({
            content: "Error Codes must be between 5 and 6 digits.",
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    const addendum = getWiiLinkErrorAddendum(ecode);
    const text = addendum.overrides[type];

    if (!text) {
        await interaction.reply({
            content: `There is no override for error ${ecode} type ${ctype}.`,
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    delete addendum.overrides[type];

    await setWiiLinkErrorAddendum(ecode, addendum);

    await interaction.reply({
        content: `Removed override for error ${ecode}, type ${ctype}: ${text}`,
    });
}

async function overrideList(interaction: ChatInputCommandInteraction<CacheType>): Promise<void> {
    const ecode = interaction.options.getInteger("ecode", true);
    const length = ecode.toString().length;

    if (length < 5 || length > 6) {
        await interaction.reply({
            content: "Error Codes must be between 5 and 6 digits.",
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    const addendum = getWiiLinkErrorAddendum(ecode);
    const keys = Object.keys(addendum.overrides);
    const content = keys.length == 0
        ? `No overrides for error ${ecode}`
        : keys.map(k => `${capitalize(k)}: ${addendum.overrides[k]}`)
            .join("\n");

    await interaction.reply({ content: content });
}
