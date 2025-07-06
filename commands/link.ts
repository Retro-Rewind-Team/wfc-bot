import { CacheType, ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder } from "discord.js";
import { makeRequest, pidToFc, resolvePidFromString, validateId } from "../utils.js";
import { getConfig } from "../config.js";

const config = getConfig();
export const currentlyVerifying: Set<number> = new Set();

export default {
    modOnly: false,
    adminOnly: false,

    data: new SlashCommandBuilder()
        .setName("link")
        .setDescription("Link your discord account to your RWFC profile")
        .addStringOption(option => option.setName("id")
            .setDescription("friend code or pid to link")
            .setRequired(true)),

    exec: async function(interaction: ChatInputCommandInteraction<CacheType>) {
        let id = interaction.options.getString("id", true);
        id = id.trim();

        if (!validateId(id)) {
            await interaction.reply({
                content: `Error linking friend code or pid "${id}": Incorrect format`,
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        const pid = resolvePidFromString(id);
        const fc = pidToFc(pid);
        const discordID = interaction.user.id;

        await interaction.deferReply({
            flags: MessageFlags.Ephemeral,
        });
        if (currentlyVerifying.has(pid)) {
            await interaction.editReply({
                content: `Error linking friend code "${fc}": Already verifying this profile!`
            });
            return;
        }

        if (!await beginLink(interaction, pid, fc, discordID))
            return;

        if (!await waitForLinkSuccess(interaction, pid, fc, discordID))
            await timeoutLink(interaction, pid, fc, discordID);
    }
};

async function beginLink(interaction: ChatInputCommandInteraction<CacheType>, pid: number, fc: string, discordID: string) {
    currentlyVerifying.add(pid);
    const [success, res] = await makeRequest("/api/link", "POST", {
        secret: config.wfcSecret,
        pid: pid,
        discordID: discordID,
        action: "link"
    });

    if (!success) {
        currentlyVerifying.delete(pid);
        await interaction.editReply({
            content: `Failed to link friend code "${fc}": error ${res.Error ?? "no error message provided"}`
        });
    }
    else
        await interaction.editReply({
            content: `Verification started for "${fc}"! Please add "${config.friendbot}" within 10 minutes!`,
        });

    return success;
}

async function waitForLinkSuccess(interaction: ChatInputCommandInteraction<CacheType>, pid: number, fc: string, discordID: string) {
    const timeOut = (Date.now() + 600_000); // 10 minutes
    while (Date.now() < timeOut) {
        await new Promise(resolve => setTimeout(resolve, 30_000)); // Try every 30 seconds
        const [success, res] = await makeRequest("/api/link", "POST", {
            secret: config.wfcSecret,
            pid: pid,
            discordId: discordID,
            action: "check"
        });

        if (success) {
            currentlyVerifying.delete(pid);
            await interaction.editReply({
                content: `Successfully linked friend code "${fc}" to your Discord account!`
            });

            return true;
        }
        else
            console.log(res.Error);
    }

    return false;
}

async function timeoutLink(interaction: ChatInputCommandInteraction<CacheType>, pid: number, fc: string, discordID: string) {
    currentlyVerifying.delete(pid);
    await interaction.editReply({ content: `Profile linking for "${fc}" timed out!` });
    const [success, res] = await makeRequest("/api/link", "POST", {
        secret: config.wfcSecret,
        pid: pid,
        discordId: discordID,
        action: "reset"
    });

    if (success)
        await interaction.followUp({
            content: `Profile linking for "${fc}" cancelled!`
        });
    else
        await interaction.followUp({
            content: `Failed to cancel linking for "${fc}": error ${res.Error ?? "no error message provided"}`
        });
}
