import { CacheType, ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { makeRequest, pidToFc, resolvePidFromString, validateId } from "../utils.js";
import { getConfig } from "../config.js";

const config = getConfig();
const currentlyVerifying: Set<number> = new Set();

export default {
    modOnly: false,
    adminOnly: false,

    data: new SlashCommandBuilder()
        .setName("link")
        .setDescription("Link your discord account to your RWFC profile")
        .addStringOption(option => option.setName("id")
            .setDescription("friend code or pid to link")
            .setRequired(true)),
    exec: async function (interaction: ChatInputCommandInteraction<CacheType>) {
        let id = interaction.options.getString("id", true);
        id = id.trim();

        if (!validateId(id)) {
            await interaction.reply({ content: `Error linking friend code or pid "${id}": Incorrect format`, ephemeral: true });
            return;
        }

        const pid = resolvePidFromString(id);
        const fc = pidToFc(pid);
        const discordId = interaction.user.id;

        await interaction.deferReply();
        if (currentlyVerifying.has(pid)) {
            await interaction.editReply({ content: `Error linking friend code "${fc}": Already verifying this profile!` });
            return;
        }
        currentlyVerifying.add(pid);
        const [success, res] = await makeRequest("/api/link", "POST", { secret: config.wfcSecret, pid: pid, discordId: discordId, action: "link" });
        if (!success) {
            currentlyVerifying.delete(pid);
            await interaction.editReply({ content: `Failed to link friend code "${fc}": error ${res.Error ?? "no error message provided"}` });
            return;
        }


        interaction.editReply({
            content: `Verification started for "${fc}"! Please add "${config.friendbot}" within 10 minutes!`,
        });
        const timeOut = (Date.now() + 600_000); // 10 minutes
        while (Date.now() < timeOut) {
            await new Promise(resolve => setTimeout(resolve, 30_000)); // Try every 30 seconds
            const [checkSuccess, checkRes] = await makeRequest("/api/link", "POST", { secret: config.wfcSecret, pid: pid, discordId: discordId, action: "check" });
            if (checkSuccess) {
                currentlyVerifying.delete(pid);
                await interaction.editReply({ content: `Successfully linked friend code "${fc}" to your Discord account!` });
                return;
            } else if (checkRes.Error = "Profile is not in the correct step to link Discord ID") {
                console.log("Profile is not in the correct step to link Discord ID");
            }
        }
        currentlyVerifying.delete(pid);
        await interaction.editReply({ content: `Profile linking for "${fc}" timed out!` });
        const [deleteSuccess, deleteRes] = await makeRequest("/api/link", "POST", { secret: config.wfcSecret, pid: pid, discordId: discordId, action: "unlink" });
        if (deleteSuccess) {
            await interaction.followUp({ content: `Profile linking for "${fc}" cancelled!` });
        } else {
            await interaction.followUp({ content: `Failed to cancel linking for "${fc}": error ${deleteRes.Error ?? "no error message provided"}` });
        }
    }
};