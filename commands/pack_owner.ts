import { CacheType, ChatInputCommandInteraction, EmbedBuilder, GuildMember, PermissionFlagsBits, SlashCommandBuilder, TextChannel, User } from "discord.js";
import config from "../config.json" with { type: "json" };
import { PackIDStr, packIDToName, PackOpts } from "./hash.js";
import { client } from "../index.js";
import fs from "fs";
import path from "path";
import { getColor } from "../utils.js";

async function sendEmbed(moderator: GuildMember | null, action: string, packID: number, user: User) {
    const embed = new EmbedBuilder()
        .setColor(getColor())
        .setTitle(`${action.charAt(0).toUpperCase() + action.slice(1)}ed owner for ${packIDToName(packID)}`)
        .addFields(
            { name: "Moderator", value: `<@${moderator?.id ?? "Unknown"}>` },
            { name: "Updated User", value: `<@${user.id}>` },
        );

    await (client.channels.cache.get(config["logs-channel"]) as TextChannel | null)?.send({ embeds: [embed] });
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
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

    exec: async function(interaction: ChatInputCommandInteraction<CacheType>) {
        const user = interaction.options.getUser("user")!; // User is required for Register and Deregister. Will not be null
        const packID = interaction.options.getInteger("packid")!; // Same as above
        const packIDStr = packID?.toString(16) as PackIDStr;
        const subcommand = interaction.options.getSubcommand();
        const configPath = path.join(import.meta.dirname, "../config.json");

        if (subcommand == "register") {
            if (!config[packIDStr])
                config[packIDStr] = [] as never;

            if (Array.isArray(config[packIDStr])) {
                if (config[packIDStr].findIndex(id => id == user.id) > -1) {
                    await interaction.reply({
                        content: `User ${user.username}, ${user.id} is already registered to pack ${packIDToName(packID)}`
                    });
                    return;
                }

                config[packIDStr].push(user.id as never);

                fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
                await interaction.reply(
                    { content: `Registered user ${user.username}, ${user.id} to pack ${packIDToName(packID)}` }
                );
                await sendEmbed(interaction.member as GuildMember | null, subcommand, packID, user);
                return;
            }

            await interaction.reply(
                { content: `Failed to register user ${user.username}, ${user.id} to pack ${packIDToName(packID)}. config[packIDStr] is not an array!` }
            );
        }
        else if (subcommand == "deregister") {
            if (config[packIDStr] && Array.isArray(config[packIDStr])) {
                const idx = config[packIDStr].findIndex(id => id == user.id);

                if (idx != -1)
                    config[packIDStr].splice(idx, 1);
            }

            fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
            await interaction.reply({
                content: `Deregistered user ${user.username}, ${user.id} from pack ${packIDToName(packID)}`
            });
            await sendEmbed(interaction.member as GuildMember | null, subcommand, packID, user);
        }
        else if (subcommand == "list") {
            let content = "Pack Owners:\n";
            let some = false;

            for (const opt of PackOpts) {
                const idStr = opt.value.toString(16) as PackIDStr;
                const users = config[idStr];

                if (!users || !Array.isArray(users))
                    continue;

                content += `${opt.name}: 0x0${idStr}\n`;

                if (users.length > 0)
                    some = true;

                for (const uid of users) {
                    const user = await interaction.guild?.members.fetch(uid);
                    content += `${user?.user.username ?? "Unkown Username"}, ${uid}\n`;
                }
            }

            if (!some)
                content += "None";

            await interaction.reply({ content: content });
        }
    }
};
