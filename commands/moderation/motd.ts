import { CacheType, ChatInputCommandInteraction, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { getConfig } from "../../config.js";
import { makeWFCRequest } from "../../utils.js";
import { loadState, State } from "../../state.js";
import { getStatusText } from "../shared/server_status.js";

const config = getConfig();
const state: State = await loadState();

export default {
    modOnly: false,
    adminOnly: true,

    data: new SlashCommandBuilder()
        .setName("motd")
        .setDescription("Get or set the current message of the day.")
        .addStringOption(option => option.setName("message")
            .setDescription("message of the day to set"))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    exec: async function(interaction: ChatInputCommandInteraction<CacheType>) {
        let motd = interaction.options.getString("message");

        if (motd) {
            motd = motd.replace(/\\n/g, "\n");
            // Send the server a modified motd with the server status appended
            let realMotd = motd;

            if (state.status && state.status.color && state.status.message)
                realMotd = `${motd}\n${getStatusText(state.status)}`;

            const [success, res] = await makeWFCRequest("/motd", "POST", { secret: config.wfcSecret, motd: realMotd });
            if (!success) {
                await interaction.reply({ content: `Failed to set message of the day, error: ${res.Error ?? "no error message provided"}` });
                return;
            }

            await interaction.reply({ content: `Set message of the day to:\n${realMotd}` });
            // Serialize the original motd
            state.motd = motd;
            state.save();
        }
        else {
            const [success, res] = await makeWFCRequest("/motd", "GET");

            if (success) {
                await interaction.reply({ content: `Current message of the day is:\n${res.Motd}` });
                state.motd = res.Motd;
                state.save();
            }
            else
                await interaction.reply({ content: `Failed to fetch current message of the day, error: ${res.Error ?? "no error message provided"}` });
        }
    }
};
