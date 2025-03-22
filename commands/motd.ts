import { CacheType, ChatInputCommandInteraction, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { getConfig } from "../config.js";
import { makeRequest } from "../utils.js";

const config = getConfig();

export default {
    modOnly: true,
    adminOnly: false,

    data: new SlashCommandBuilder()
        .setName("motd")
        .setDescription("Get or set the current message of the day.")
        .addStringOption(option => option.setName("message")
            .setDescription("message of the day to set"))
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

    exec: async function(interaction: ChatInputCommandInteraction<CacheType>) {
        let motd = interaction.options.getString("message");

        if (motd) {
            motd = motd.replace(/\\n/g, "\n");
            const [success, res] = await makeRequest("/api/motd", "POST", { secret: config.wfcSecret, motd: motd });

            if (success)
                await interaction.reply({ content: `Set message of the day to: "${motd}"` });
            else
                await interaction.reply({ content: `Failed to set message of the day, error: ${res.Error ?? "no error message provided"}` });
        }
        else {
            const [success, res] = await makeRequest("/api/motd", "GET");

            if (success)
                await interaction.reply({ content: `Current message of the day is:\n${res.Motd}` });
            else
                await interaction.reply({ content: `Failed to fetch current message of the day, error: ${res.Error ?? "no error message provided"}` });
        }
    }
};
