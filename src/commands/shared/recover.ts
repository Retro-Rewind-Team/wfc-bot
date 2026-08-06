import { _fetch as fetch } from "#src/fetch.js";
import { CacheType, ChatInputCommandInteraction, MessageFlags } from "discord.js";
import { pidToFc, resolvePidFromString, validateID } from "#src/utils.js";
import { decodeDWCPlayerID, recoverRksys } from "#src/commands/shared/rksys.js";
import { fetchPinfo } from "#src/commands/shared/pinfo.js";

export async function recover(
    interaction: ChatInputCommandInteraction<CacheType>,
    requireLinkedProfile: boolean,
): Promise<void> {
    const rksysAttachment = interaction.options.getAttachment("rksys", true);
    const license = interaction.options.getInteger("license", true);
    const id = interaction.options.getString("id", true).trim();

    const [valid, validationError] = validateID(id);
    if (!valid) {
        await interaction.reply({
            content: `Error recovering friend code or pid "${id}": ${validationError}`,
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    const pid = resolvePidFromString(id);
    if (pid == 0) {
        await interaction.reply({
            content: "Error recovering friend code or pid: the player ID must be non-zero.",
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const rksysResponse = await fetch(rksysAttachment.url);

    if (!rksysResponse.ok) {
        await interaction.reply({
            content: `Error fetching rksys attachment: ${rksysResponse.status}`,
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    const fc = pidToFc(pid);
    const [user, pinfoErr] = await fetchPinfo(pid, true);
    if (pinfoErr) {
        await interaction.editReply({
            content: `Unable to fetch info for fc ${fc}: error ${pinfoErr}`
        });
        return;
    }

    if (requireLinkedProfile && (user.DiscordID != interaction.user.id)) {
        await interaction.editReply({
            content: `Friend code "${fc}" is not linked to your Discord account.`,
        });
        return;
    }

    const [dwcPlayerID, dwcPlayerIDErr] = decodeDWCPlayerID(user.GsbrCode);
    if (dwcPlayerIDErr) {
        await interaction.reply({
            content: `Failed to decode dwc player id: error ${dwcPlayerIDErr}`
        });
        return;
    }

    const input = Buffer.from(await rksysResponse.arrayBuffer());
    const output = recoverRksys(input, license, pid, dwcPlayerID);

    await interaction.editReply({
        content: `Recovered ${pidToFc(pid)} on license ${license} using DWC Player ID ${dwcPlayerID}. The DWC Auth Data and save CRCs were updated without clearing the block.`,
        files: [{
            name: `rksys_recovered_license_${license}.dat`,
            attachment: output,
        }],
    });
}
