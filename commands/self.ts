import { CacheType, ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { getChannels, getConfig } from "../config.js";
import { makeRequest, pidToFc, resolvePidFromString, sendEmbedLog, validateID, WiiLinkUser } from "../utils.js";

const config = getConfig();

export default {
    modOnly: false,
    adminOnly: false,

    data: new SlashCommandBuilder()
        .setName("self")
        .setDescription("Perform a command on yourself or a froom you host")
        .addSubcommand(subcommand => subcommand.setName("kick")
            .setDescription("Kick yourself"))
        .addSubcommand(subcommand => subcommand.setName("froom_kick")
            .setDescription("Kick someone from a froom you host")
            .addStringOption(option => option.setName("id")
                .setDescription("friend code or pid to kick")
                .setRequired(true))),

    exec: async function(interaction: ChatInputCommandInteraction<CacheType>) {
        const discordID = interaction.member?.user.id;

        if (!discordID) {
            await interaction.reply({ content: "Failed to determine interaction user" });
            return;
        }

        const subcommand = interaction.options.getSubcommand(true);

        let pid = 0;
        if (subcommand == "froom_kick") {
            let id = interaction.options.getString("id", true);
            id = id.trim();

            const [valid, err] = validateID(id);
            if (!valid) {
                await interaction.reply({ content: `Error kicking friend code or pid "${id}": ${err}` });
                return;
            }

            pid = resolvePidFromString(id);
        }

        const [success, res] = await makeRequest("/api/self", "POST", {
            secret: config.wfcSecret,
            discordID: discordID,
            command: subcommand,
            pid: pid,
        });

        if (success) {
            await sendEmbedLog(
                interaction,
                "self-kick",
                pidToFc((res.User as WiiLinkUser).ProfileId),
                res.User,
                [],
                false,
                false,
                true,
                getChannels().publicSelfLogs,
            );
        }
        else {
            if (subcommand == "kick") {
                await interaction.reply({
                    content: `Failed to self-kick": error ${res.Error ?? "no error message provided"}`
                });
            }
            else {
                await interaction.reply({
                    content: `Failed to kick friend code "${pidToFc(pid)}": error ${res.Error ?? "no error message provided"}`
                });
            }
        }
    }
};
