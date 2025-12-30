import { CacheType, ChatInputCommandInteraction, EmbedBuilder, GuildMember, PermissionFlagsBits, SlashCommandBuilder, User } from "discord.js";
import { getChannels, getConfig, setConfig } from "../config.js";
import { packIDToName, PackOpts } from "./hash.js";
import { fmtHex, getColor } from "../utils.js";

const config = getConfig();
const channels = getChannels();

async function sendEmbed(moderator: GuildMember | null, action: string, packID: number, user: User) {
    const embed = new EmbedBuilder()
        .setColor(getColor())
        .setTitle(`${action.charAt(0).toUpperCase() + action.slice(1)}ed owner for ${packIDToName(packID)}`)
        .addFields(
            { name: "Moderator", value: `<@${moderator?.id ?? "Unknown"}>` },
            { name: "Updated User", value: `<@${user.id}>` },
        )
        .setTimestamp();

    await channels.logs.send({ embeds: [embed] });
}

export default {
    modOnly: false,
    adminOnly: true,

    data: new SlashCommandBuilder()
        .setName("pack_owner")
        .setDescription("Manage pack owners")
        .addSubcommand(subcommand => subcommand.setName("list")
            .setDescription("List pack owners"))
        .addSubcommand(subcommand => subcommand.setName("register")
            .setDescription("Register pack owner")
            .addIntegerOption(option => option.setName("packid")
                .setDescription("Pack to update")
                .setChoices(PackOpts)
                .setRequired(true))
            .addUserOption(option => option.setName("user")
                .setDescription("The user to modify")
                .setRequired(true)))
        .addSubcommand(subcommand => subcommand.setName("deregister")
            .setDescription("Deregister pack owner")
            .addIntegerOption(option => option.setName("packid")
                .setDescription("Pack to update")
                .setChoices(PackOpts)
                .setRequired(true))
            .addUserOption(option => option.setName("user")
                .setDescription("The user to modify")
                .setRequired(true)))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    exec: async function(interaction: ChatInputCommandInteraction<CacheType>) {
        const user = interaction.options.getUser("user")!; // User is required for Register and Deregister. Will not be null
        const packID = interaction.options.getInteger("packid")!; // Same as above
        const packIDStr = packID?.toString(16);
        const subcommand = interaction.options.getSubcommand();

        if (subcommand == "register") {
            if (!config.packOwners[packIDStr])
                config.packOwners[packIDStr] = [];

            if (Array.isArray(config.packOwners[packIDStr])) {
                if (config.packOwners[packIDStr].findIndex(id => id == user.id) > -1) {
                    await interaction.reply({
                        content: `User ${user.username}, ${user.id} is already registered to pack ${packIDToName(packID)}`
                    });
                    return;
                }

                config.packOwners[packIDStr].push(user.id);

                setConfig(config);

                await interaction.reply({
                    content: `Registered user ${user.username}, ${user.id} to pack ${packIDToName(packID)}`
                });
                await sendEmbed(interaction.member as GuildMember | null, subcommand, packID, user);
                return;
            }

            await interaction.reply({
                content: `Failed to register user ${user.username}, ${user.id} to pack ${packIDToName(packID)}. config[packIDStr] is not an array!`
            });
        }
        else if (subcommand == "deregister") {
            if (config.packOwners[packIDStr] && Array.isArray(config.packOwners[packIDStr])) {
                const idx = config.packOwners[packIDStr].findIndex(id => id == user.id);

                if (idx != -1)
                    config.packOwners[packIDStr].splice(idx, 1);
            }

            setConfig(config);

            await interaction.reply({
                content: `Deregistered user ${user.username}, ${user.id} from pack ${packIDToName(packID)}`
            });
            await sendEmbed(interaction.member as GuildMember | null, subcommand, packID, user);
        }
        else if (subcommand == "list") {
            const embed = new EmbedBuilder()
                .setColor(getColor())
                .setTitle("Pack Owners");

            for (const opt of PackOpts) {
                const idStr = opt.value.toString(16);
                const users = config.packOwners[idStr];
                // Scuffed ass formatting. I don't care
                let value = "None  ";

                if (users && Array.isArray(users)) {
                    value = "";

                    for (const uid of users)
                        value += `<@${uid}>, `;
                }

                embed.addFields({
                    name: `${opt.name}: ${fmtHex(opt.value)}`,
                    value: value.slice(0, value.length - 2),
                });
            }

            await interaction.reply({
                embeds: [embed]
            });
        }
    }
};
