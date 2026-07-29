import { CacheType, ChatInputCommandInteraction, EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { getConfig, setConfig } from "../../config.js";
import { packIDToName, PackOpts } from "../shared/pack.js";
import { fmtHex, getColor } from "../../utils.js";
import { PermissionBit, sendEmbed } from "../shared/roles.js";

const config = getConfig();

export default {
    permissions: PermissionBit.ADMIN,

    data: new SlashCommandBuilder()
        .setName("pack_owner")
        .setDescription("Manage pack owners")
        .addSubcommand(subcommand => subcommand.setName("list")
            .setDescription("List pack owners"))
        .addSubcommand(subcommand => subcommand.setName("add")
            .setDescription("Add pack owner")
            .addIntegerOption(option => option.setName("packid")
                .setDescription("Pack to update")
                .setChoices(PackOpts)
                .setRequired(true))
            .addUserOption(option => option.setName("user")
                .setDescription("The user to modify")
                .setRequired(true)))
        .addSubcommand(subcommand => subcommand.setName("remove")
            .setDescription("Remove pack owner")
            .addIntegerOption(option => option.setName("packid")
                .setDescription("Pack to update")
                .setChoices(PackOpts)
                .setRequired(true))
            .addUserOption(option => option.setName("user")
                .setDescription("The user to modify")
                .setRequired(true)))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    exec: async function(interaction: ChatInputCommandInteraction<CacheType>): Promise<void> {
        const user = interaction.options.getUser("user")!; // User is required for add and remove. Will not be null
        const packID = interaction.options.getInteger("packid")!; // Same as above
        const packIDStr = packID?.toString(16);
        const subcommand = interaction.options.getSubcommand();

        if (subcommand == "add") {
            if (!config.packOwners[packIDStr])
                config.packOwners[packIDStr] = [];

            if (Array.isArray(config.packOwners[packIDStr])) {
                if (config.packOwners[packIDStr].findIndex(id => id == user.id) > -1) {
                    await interaction.reply({
                        content: `User ${user.username}, ${user.id} is already added to pack ${packIDToName(packID)}`
                    });
                    return;
                }

                config.packOwners[packIDStr].push(user.id);

                await setConfig(config);

                await interaction.reply({
                    content: `Added user ${user.username}, ${user.id} to pack ${packIDToName(packID)}`
                });
                await sendEmbed(interaction, `${packIDToName(packID)} Owner Addition`, user);
                return;
            }

            await interaction.reply({
                content: `Failed to add user ${user.username}, ${user.id} to pack ${packIDToName(packID)}. config[packIDStr] is not an array!`
            });
        }
        else if (subcommand == "remove") {
            if (config.packOwners[packIDStr] && Array.isArray(config.packOwners[packIDStr])) {
                const idx = config.packOwners[packIDStr].findIndex(id => id == user.id);

                if (idx != -1)
                    config.packOwners[packIDStr].splice(idx, 1);
            }

            await setConfig(config);

            await interaction.reply({
                content: `Removed user ${user.username}, ${user.id} from pack ${packIDToName(packID)}`
            });
            await sendEmbed(interaction, `${packIDToName(packID)} Owner Removal`, user);
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
