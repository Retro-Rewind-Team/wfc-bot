import { CacheType, ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { getChannels, getConfig } from "../config.js";
import { Status, StatusColor } from "./server_status_types.js";
import { loadState, State } from "../state.js";
import { makeRequest } from "../utils.js";

const config = getConfig();
const state: State = await loadState();
const channels = getChannels();

const ColorOpts = [
    { name: "Red", value: StatusColor.RED },
    { name: "Yellow", value: StatusColor.YELLOW },
    { name: "Green", value: StatusColor.GREEN },
];

function getStatusColorEmoji(statusColor: StatusColor): string {
    switch (statusColor) {
    case StatusColor.RED:
        return "🔴";
    case StatusColor.YELLOW:
        return "🟡";
    case StatusColor.GREEN:
        return "🟢";
    }
}

function getStatusColorText(statusColor: StatusColor): string {
    switch (statusColor) {
    case StatusColor.RED:
        return "OFFLINE";
    case StatusColor.YELLOW:
        return "POOR";
    case StatusColor.GREEN:
        return "GOOD";
    }
}

export function getStatusText(status: Status): string {
    return `Server Status: ${getStatusColorText(status.color)} - ${status.message}`;
}

export default {
    modOnly: false,
    adminOnly: true,

    data: new SlashCommandBuilder()
        .setName("server_status")
        .setDescription("Update the Server Status channel and the message of the day.")
        .addNumberOption(option => option.setName("color")
            .setDescription("The status color circle")
            .setChoices(ColorOpts)
            .setRequired(true))
        .addStringOption(option => option.setName("message")
            .setDescription("The status message")
            .setRequired(true)),

    exec: async function(interaction: ChatInputCommandInteraction<CacheType>) {
        const color: StatusColor = interaction.options.getNumber("color", true);
        const message = interaction.options.getString("message", true);

        await interaction.deferReply();

        let motd = getStatusText({ color: color, message: message });
        if (state.motd)
            motd = `${state.motd}\n\n${motd}`;

        const [success, res] = await makeRequest("/api/motd", "POST", { secret: config.wfcSecret, motd: motd});
        if (!success)
            await interaction.followUp({ content: `Failed to set message of the day, error: ${res.Error ?? "no error message provided"}` });
        else
            interaction.followUp({ content: `Set message of the day to:\n${motd}` });

        let channelEditSuccess = false;

        // If we are rate limited, channel edits fail silently. This checks
        // after 5 seconds if it succeeded such that the user can be informed
        // the update failed. Sometimes the update goes through after 5 seconds
        // of delay anyway. This is probably the best we can do.
        setTimeout(async () => {
            if (!channelEditSuccess) {
                await interaction.followUp({
                    content: "Failed to update the server status. Try again in a few minutes."
                });
            }
        }, 5000);

        const channelName = `${getStatusColorEmoji(color)} ${message}`;

        try {
            await channels.status.setName(channelName, "status update");
            channelEditSuccess = true;
        }
        catch (e) {
            await interaction.followUp({ content: `Failed to modify the status channel: ${e}` });
            return;
        }

        state.status = { color: color, message: message };
        state.save();

        await interaction.followUp({
            content: `Successfully updated the server status to "${channelName}"`
        });
    }
};
