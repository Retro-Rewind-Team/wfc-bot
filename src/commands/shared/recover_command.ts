import { CacheType, ChatInputCommandInteraction, MessageFlags } from "discord.js";
import { getConfig } from "../../config.js";
import { makeWFCRequest, pidToFc, resolvePidFromString, validateID } from "../../utils.js";
import { decodeDwcPlayerId, recoverRksys } from "./rksys_recover.js";

const config = getConfig();

interface QueryUser {
    ProfileId: number;
    DiscordID: string;
}

interface QueryResponse {
    Users?: QueryUser[];
    Error?: string;
}

interface PinfoUser {
    GsbrCode?: string;
}

interface PinfoResponse {
    User?: PinfoUser;
    user?: PinfoUser;
    Error?: string;
}

export async function executeRecover(
    interaction: ChatInputCommandInteraction<CacheType>,
    requireLinkedProfile: boolean,
): Promise<void> {
    const attachment = interaction.options.getAttachment("file", true);
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

    const profileId = resolvePidFromString(id);
    if (profileId == 0) {
        await interaction.reply({
            content: "Error recovering friend code or pid: the player ID must be non-zero.",
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    if (requireLinkedProfile) {
        let linked: boolean;
        try {
            linked = await isLinkedToRequester(interaction, profileId);
        }
        catch (error) {
            await interaction.editReply({
                content: `Unable to verify the linked friend code "${pidToFc(profileId)}": ${errorMessage(error)}`,
            });
            return;
        }

        if (!linked) {
            await interaction.editReply({
                content: `Friend code "${pidToFc(profileId)}" is not linked to your Discord account.`,
            });
            return;
        }
    }

    let dwcPlayerId: number;
    try {
        dwcPlayerId = await getDwcPlayerId(profileId);
    }
    catch (error) {
        await interaction.editReply({
            content: `Unable to resolve the DWC Player ID for friend code "${pidToFc(profileId)}": ${errorMessage(error)}`,
        });
        return;
    }

    try {
        const fileResponse = await fetch(attachment.url);
        if (!fileResponse.ok) {
            await interaction.editReply({
                content: `Error fetching rksys.dat attachment: ${fileResponse.status} ${fileResponse.statusText}`,
            });
            return;
        }

        const input = Buffer.from(await fileResponse.arrayBuffer());
        const output = recoverRksys(input, license, profileId, dwcPlayerId);

        await interaction.editReply({
            content: `Recovered ${pidToFc(profileId)} on license ${license} using DWC Player ID ${dwcPlayerId}. The DWC Auth Data and save CRCs were updated without clearing the block.`,
            files: [{
                attachment: output,
                name: `rksys_recovered_license_${license}.dat`,
            }],
        });
    }
    catch (error) {
        await interaction.editReply({ content: `Failed to recover rksys.dat: ${errorMessage(error)}` });
    }
}

async function getDwcPlayerId(profileId: number): Promise<number> {
    const [success, response] = await makeWFCRequest("/pinfo", "POST", {
        secret: config.wfcSecret,
        pid: profileId,
    }) as [boolean, PinfoResponse];

    if (!success)
        throw new Error(response?.Error ?? "the server returned an error");

    const gsbrCode = (response.User ?? response.user)?.GsbrCode;
    if (!gsbrCode)
        throw new Error("the profile has no gsbr code");

    return decodeDwcPlayerId(gsbrCode);
}

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : `unexpected error: ${error}`;
}

async function isLinkedToRequester(
    interaction: ChatInputCommandInteraction<CacheType>,
    profileId: number,
): Promise<boolean> {
    const [success, response] = await makeWFCRequest("/query", "POST", {
        secret: config.wfcSecret,
        discordID: interaction.user.id,
        pid: profileId,
    }) as [boolean, QueryResponse];

    if (!success)
        throw new Error(response?.Error ?? "the server returned an error");

    return response.Users?.some(user => user.ProfileId == profileId && user.DiscordID == interaction.user.id) ?? false;
}
