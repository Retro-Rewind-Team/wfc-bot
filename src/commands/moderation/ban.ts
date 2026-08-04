import { _fetch as fetch } from "#src/fetch.js";
import { Command } from "#src/commands/shared/command.js";
import { CacheType, ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { makeWFCRequest, pidToFc, resolveModRestrictPermission, resolvePidFromString, sendEmbedLog, validateID } from "#src/utils.js";
import { getConfig } from "#src/config.js";
import { PermissionBit } from "#src/commands/shared/roles.js";
import { plural as p } from "#src/utils.js";

const config = getConfig();

export const command: Command = {
    permissions: PermissionBit.MODERATOR | PermissionBit.MINI_MODERATOR,

    data: new SlashCommandBuilder()
        .setName("ban")
        .setDescription("Ban a user")
        .addStringOption(option => option.setName("id")
            .setDescription("friend code or pid to ban")
            .setRequired(true))
        .addStringOption(option => option.setName("reason")
            .setDescription("ban reason")
            .setRequired(true))
        .addStringOption(option => option.setName("hidden-reason")
            .setDescription("ban reason only visible to moderators"))
        .addNumberOption(option => option.setName("days")
            .setDescription("ban days length"))
        .addNumberOption(option => option.setName("hours")
            .setDescription("ban hours length"))
        .addNumberOption(option => option.setName("minutes")
            .setDescription("ban minutes length"))
        .addBooleanOption(option => option.setName("tos")
            .setDescription("tos violation (ban from entire service), default true"))
        .addBooleanOption(option => option.setName("hide-mii")
            .setDescription("hide mii and mii name in logs"))
        .addBooleanOption(option => option.setName("hide-public")
            .setDescription("hide public log message"))
        .setDefaultMemberPermissions(resolveModRestrictPermission()),

    exec: async function(interaction: ChatInputCommandInteraction<CacheType>): Promise<void> {
        let id = interaction.options.getString("id", true);
        id = id.trim();

        const [valid, err] = validateID(id);
        if (!valid) {
            await interaction.reply({ content: `Error banning friend code or pid "${id}": ${err}` });
            return;
        }

        const pid = resolvePidFromString(id);
        const reason = interaction.options.getString("reason", true);
        const reasonHidden = interaction.options.getString("hidden-reason");
        let days = interaction.options.getNumber("days") ?? 0;
        const hours = interaction.options.getNumber("hours") ?? 0;
        const minutes = interaction.options.getNumber("minutes") ?? 0;
        const tos = interaction.options.getBoolean("tos") ?? true;
        const hideMii = interaction.options.getBoolean("hide-mii") ?? false;
        const hidePublic = interaction.options.getBoolean("hide-public") ?? false;
        const moderator = interaction.user.id;

        let perm = false;
        if (hours + minutes + days == 0) {
            // Perm ban lol
            // A normal person lives about 31000 days
            days = 100000;
            perm = true;
        }

        const fc = pidToFc(pid);
        const [success, res] = await makeWFCRequest("/ban", "POST", {
            secret: config.wfcSecret,
            pid: pid,
            days: days,
            hours: hours,
            minutes: minutes,
            tos: tos,
            reason: reason,
            reason_hidden: reasonHidden ?? "",
            moderator: moderator
        });

        if (!success) {
            await interaction.reply({ content: `Failed to ban friend code "${fc}": error ${res.Error ?? "no error message provided"}` });

            return;
        }

        const leaderboardUrl = `http://${config.leaderboardServer}:${config.leaderboardPort}`;
        try {
            const leaderboardResponse = await fetch(`${leaderboardUrl}/api/moderation/ban`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${config.wfcSecret}`
                },
                body: JSON.stringify({
                    pid: pid.toString(),
                    days: days,
                    hours: hours,
                    minutes: minutes,
                    tos: tos,
                    reason: reason,
                    reason_hidden: reasonHidden ?? "",
                    moderator: moderator
                })
            });

            if (leaderboardResponse.ok)
                console.log(`Successfully removed player ${pid} from leaderboard database`);
            else {
                const errorText = await leaderboardResponse.text();
                console.error(`Failed to remove player ${pid} from leaderboard: ${leaderboardResponse.status}`);
                console.error(`Error details: ${errorText}`);
            }
        }
        catch (error) {
            console.error(`Error calling leaderboard API for player ${pid}:`, error);
        }

        await sendEmbedLog(interaction, res.User, {
            action: "ban",
            extraFields: [
                { name: "Reason", value: reason },
                { name: "Hidden Reason", value: reasonHidden ?? "None", hidden: true },
                {
                    name: "Ban Length",
                    value: perm
                        ? "Permanent"
                        : `${days} ${p(days, "day")}, ${hours} ${p(hours, "hour")}, ${minutes} ${p(minutes, "minute")}`
                },
            ],
            hideMii: hideMii,
            noPublicEmbed: hidePublic,
            verbose: false,
            // We already show the ban info ourselves above.
            showBanInfo: false,
        });
    }
};
