import { CacheType, ChatInputCommandInteraction, EmbedBuilder, GuildMember, MessageFlags, PermissionFlagsBits, SlashCommandBuilder, User } from "discord.js";
import { getChannels, getConfig, setConfig } from "../../config.js";
import { Command } from "./command.js";
import { capitalize, getColor } from "../../utils.js";

export enum PermissionBit {
    NONE = 0,
    SUPER_ADMIN = 1 << 0, // Allows managing admins
    ADMIN = 1 << 1,
    MODERATOR = 1 << 2,
    BKT_UPDATER = 1 << 3,
    PROFILE_MODERATOR = 1 << 4, // Restricts the clear command
}

export function isAllowedInteraction(
    interaction: ChatInputCommandInteraction<CacheType>,
    command: Command
): [boolean, string | null] {
    const config = getConfig();

    if (command.permissions == PermissionBit.NONE)
        return [true, null];

    const userPermissions = config.userPermissions[interaction.member?.user.id ?? ""];

    if (command.permissions & userPermissions)
        return [true, null];

    const required = permissionBitsToList(command.permissions);
    const has = permissionBitsToList(userPermissions);
    return [false, `Command requires one of: ${required.join(", ")}.\nUser has: ${has.join(", ")}.`];
}

export function permissionBitsToList(permissionBits: number): string[] {
    if (!permissionBits)
        return ["NONE"];

    // Subtract one for the NONE field
    const bitsLength = Object.keys(PermissionBit)
        .filter(k => typeof k === "string").length - 1;

    const ret: string[] = [];

    for (let i = 0; i < bitsLength; i++) {
        if (permissionBits & 1)
            ret.push(PermissionBit[1 << i]);

        permissionBits >>= 1;
    }

    return ret;
}

export function makeRoleCommand(
    commandName: string,
    roleName: string,
    roleBit: PermissionBit,
    restrictBit: PermissionBit,
): Command {
    return {
        permissions: restrictBit,
        data: new SlashCommandBuilder()
            .setName(commandName)
            .setDescription(`Manage ${roleName}s`)
            .addSubcommand(subcommand => subcommand.setName("list")
                .setDescription(`List ${roleName}s`))
            .addSubcommand(subcommand => subcommand.setName("add")
                .setDescription(`Add a(n) ${roleName}`)
                .addUserOption(option => option.setName("user")
                    .setDescription(`The user to add as a(n) ${roleName}`)
                    .setRequired(true)))
            .addSubcommand(subcommand => subcommand.setName("remove")
                .setDescription(`Remove a(n) ${roleName}`)
                .addUserOption(option => option.setName("user")
                    .setDescription(`The user to remove as a(n) ${roleName}`)
                    .setRequired(true)))
            .setDefaultMemberPermissions(
                PermissionFlagsBits.Administrator
            ) as SlashCommandBuilder,
        exec: async function(interaction: ChatInputCommandInteraction<CacheType>): Promise<void> {
            const subcommand = interaction.options.getSubcommand();

            switch(subcommand) {
            case "list":
                await listRole(interaction, roleName, roleBit);
                break;
            case "add":
                await addRole(interaction, roleName, roleBit);
                break;
            case "remove":
                await removeRole(interaction, roleName, roleBit);
                break;
            }
        }
    };
}

async function listRole(
    interaction: ChatInputCommandInteraction<CacheType>,
    roleName: string,
    bit: PermissionBit
): Promise<void> {
    const config = getConfig();
    const uids = Object.keys(config.userPermissions);

    let content = uids
        .filter(uid => config.userPermissions[uid] & bit)
        .map((uid) => `<@${uid}>`)
        .join("\n");

    if (content.length == 0)
        content = `No ${roleName}s are set!`;

    await interaction.reply({
        content: content,
        flags: MessageFlags.Ephemeral
    });
}

export async function sendEmbed(
    interaction: ChatInputCommandInteraction<CacheType>,
    action: string,
    updatedUser: User
): Promise<void> {
    const channels = getChannels();
    const member = interaction.member as GuildMember | null;

    const embed = new EmbedBuilder()
        .setColor(getColor())
        .setTitle(`${capitalize(action)} performed by ${member?.displayName ?? "Unknown"}`)
        .addFields(
            { name: "Server", value: interaction.guild!.name },
            { name: "Moderator", value: `<@${member?.id ?? "Unknown"}>` },
            { name: "Updated User", value: `<@${updatedUser.id}>` },
        )
        .setTimestamp();

    await channels.logs.send({ embeds: [embed] });
}

async function addRole(
    interaction: ChatInputCommandInteraction<CacheType>,
    roleName: string,
    bit: PermissionBit
): Promise<void> {
    const user = interaction.options.getUser("user", true);
    const config = getConfig();
    const userBits = config.userPermissions[user.id] ?? 0;

    if (userBits & bit) {
        await interaction.reply({ content: `User ${user.tag} is already a(n) ${roleName}.` });
        return;
    }

    config.userPermissions[user.id] = userBits | bit;
    await setConfig(config);

    await interaction.reply({ content: `User ${user.tag} has been added as a(n) ${roleName}` });
    await sendEmbed(interaction, `${roleName} Addition`, user);
}

async function removeRole(
    interaction: ChatInputCommandInteraction<CacheType>,
    roleName: string,
    bit: PermissionBit
): Promise<void> {
    const user = interaction.options.getUser("user", true);
    const config = getConfig();
    const userBits = config.userPermissions[user.id] ?? 0;

    if (!(userBits & bit)) {
        await interaction.reply({ content: `User ${user.tag} is not a(n) ${roleName}.` });
        return;
    }

    config.userPermissions[user.id] = userBits & ~bit;
    await setConfig(config);

    await interaction.reply({ content: `User ${user.tag} has been removed as a(n) ${roleName}` });
    await sendEmbed(interaction, `${roleName} Removal`, user);
}
