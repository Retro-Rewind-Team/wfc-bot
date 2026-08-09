import { Command } from "#src/commands/shared/command.js";
import { CacheType, ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder } from "discord.js";
import { getConfig } from "#src/config.js";
import { makeWFCRequest, resolveModRestrictPermission, resolvePidFromString, validateID } from "#src/utils.js";
import { hasPermissionBits, PermissionBit } from "#src/commands/shared/roles.js";
import { replyUserEmbedList } from "#src/commands/shared/query.js";

const config = getConfig();

export const command: Command = {
    permissions: PermissionBit.MODERATOR | PermissionBit.MINI_MODERATOR,

    data: new SlashCommandBuilder()
        .setName("query")
        .setDescription("Query users")
        .addStringOption(option => option.setName("ip")
            .setDescription("the ip address to search for"))
        .addIntegerOption(option => option.setName("deviceid")
            .setDescription("the device id to search for"))
        .addStringOption(option => option.setName("csnum")
            .setDescription("the serial number to search for"))
        .addIntegerOption(option => option.setName("userid")
            .setDescription("the user id to search for"))
        .addStringOption(option => option.setName("discordid")
            .setDescription("the discord id to search for"))
        .addBooleanOption(option => option.setName("banned")
            .setDescription("whether the user is banned, defaults to either if unset"))
        .addStringOption(option => option.setName("id")
            .setDescription("friend code to retrieve"))
        .addBooleanOption(option => option.setName("verbose")
            .setDescription("display verbose fields"))
        .setDefaultMemberPermissions(resolveModRestrictPermission()),

    exec: async function(interaction: ChatInputCommandInteraction<CacheType>): Promise<void> {
        const ip = interaction.options.getString("ip");
        const deviceID = interaction.options.getInteger("deviceid") ?? 0;
        const csnum = interaction.options.getString("csnum");
        const userID = interaction.options.getInteger("userid") ?? 0;
        const discordID = interaction.options.getString("discordid");
        const banned = interaction.options.getBoolean("banned");
        let id = interaction.options.getString("id") ?? "";
        id = id.trim();
        const verbose = interaction.options.getBoolean("verbose") ?? false;

        let pid = 0;
        if (id != "") {
            const [valid, err] = validateID(id);
            if (!valid) {
                await interaction.reply({
                    content: `Error querying friend code or pid "${id}": ${err}`,
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }

            pid = resolvePidFromString(id);
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        let hasban;
        if (banned == undefined || banned == null)
            hasban = 0;
        else if (!banned)
            hasban = 1;
        else if (banned)
            hasban = 2;

        const [success, res] = await makeWFCRequest("/query", "POST", {
            secret: config.wfcSecret,
            ip: ip,
            deviceID: deviceID,
            csnum: csnum,
            userID: userID,
            discordID: discordID,
            hasban: hasban,
            pid: pid,
        });

        if (!success) {
            await interaction.editReply({
                content: `Failed to query users! ${res.Error ?? "no error message provided"}`,
            });
            return;
        }

        if (!res.Users || res.Users.length == 0) {
            await interaction.editReply({ content: "No users matching the query were found!" });
            return;
        }

        // mini-mods don't get to see pii here.
        const showPII = hasPermissionBits(
            PermissionBit.SUPER_ADMIN | PermissionBit.ADMIN | PermissionBit.MODERATOR,
            interaction.user.id,
        );

        await replyUserEmbedList(interaction, res.Users, {
            priv: true,
            verbose: verbose,
            showBanInfo: true,
            showPII: showPII,
        });
    },
};
