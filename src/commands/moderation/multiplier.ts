import { _fetch as fetch } from "#src/fetch.js";
import { Command } from "#src/commands/shared/command.js";
import { CacheType, ChatInputCommandInteraction, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { getConfig } from "#src/config.js";
import { PermissionBit } from "#src/commands/shared/roles.js";

const config = getConfig();
const leaderboardUrl = config.leaderboardAPIBase;

interface Multiplier {
    id: number;
    channel: string;
    value: number;
    startTime: string;
    endTime: string;
}

interface MultiplierResponse {
    success: boolean;
    message: string;
    multiplier?: Multiplier;
}

interface MultiplierListResponse {
    success: boolean;
    count: number;
    multipliers: Multiplier[];
}

interface MultiplierDeleteResponse {
    success: boolean;
    message: string;
}

function fmtRange(multiplier: Multiplier): string {
    const start = Math.floor(new Date(multiplier.startTime).getTime() / 1000);
    const end = Math.floor(new Date(multiplier.endTime).getTime() / 1000);
    return `<t:${start}:F> to <t:${end}:F>`;
}

function fmtMultiplier(multiplier: Multiplier): string {
    return `#${multiplier.id} [${multiplier.channel}] ${multiplier.value}x: ${fmtRange(multiplier)}`;
}

function parseDateInput(value: string): Date | null {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

async function set(interaction: ChatInputCommandInteraction<CacheType>): Promise<void> {
    const channel = interaction.options.getString("channel", true);
    const value = interaction.options.getNumber("value", true);
    const startInput = interaction.options.getString("start", true);
    const endInput = interaction.options.getString("end", true);

    const start = parseDateInput(startInput);
    if (!start) {
        await interaction.reply({ content: `Could not parse start time "${startInput}". Use an ISO 8601 date-time, e.g. 2026-08-23T18:00:00Z.` });
        return;
    }

    const end = parseDateInput(endInput);
    if (!end) {
        await interaction.reply({ content: `Could not parse end time "${endInput}". Use an ISO 8601 date-time, e.g. 2026-08-23T18:00:00Z.` });
        return;
    }

    await interaction.deferReply();

    const response = await fetch(`${leaderboardUrl}/api/moderation/multiplier`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${config.wfcSecret}`,
        },
        body: JSON.stringify({
            channel: channel,
            value: value,
            startTime: start.toISOString(),
            endTime: end.toISOString(),
        }),
    });

    if (response.status >= 500) {
        await interaction.editReply({ content: `Failed to set multiplier: server error ${response.status}` });
        return;
    }

    const result: MultiplierResponse = await response.json();
    if (!result.success) {
        await interaction.editReply({ content: `Failed to set multiplier: ${result.message}` });
        return;
    }

    await interaction.editReply({ content: `Scheduled multiplier ${fmtMultiplier(result.multiplier!)}` });
}

async function list(interaction: ChatInputCommandInteraction<CacheType>): Promise<void> {
    const channel = interaction.options.getString("channel");

    await interaction.deferReply();

    const query = channel ? `?channel=${channel}` : "";
    const response = await fetch(`${leaderboardUrl}/api/moderation/multiplier${query}`, {
        headers: { "Authorization": `Bearer ${config.wfcSecret}` },
    });

    if (!response.ok) {
        await interaction.editReply({ content: `Failed to list multipliers: error ${response.status}` });
        return;
    }

    const result: MultiplierListResponse = await response.json();
    if (result.count == 0) {
        await interaction.editReply({ content: "No scheduled multipliers." });
        return;
    }

    await interaction.editReply({ content: result.multipliers.map(fmtMultiplier).join("\n") });
}

async function update(interaction: ChatInputCommandInteraction<CacheType>): Promise<void> {
    const id = interaction.options.getInteger("id", true);
    const value = interaction.options.getNumber("value", true);
    const startInput = interaction.options.getString("start", true);
    const endInput = interaction.options.getString("end", true);

    const start = parseDateInput(startInput);
    if (!start) {
        await interaction.reply({ content: `Could not parse start time "${startInput}". Use an ISO 8601 date-time, e.g. 2026-08-23T18:00:00Z.` });
        return;
    }

    const end = parseDateInput(endInput);
    if (!end) {
        await interaction.reply({ content: `Could not parse end time "${endInput}". Use an ISO 8601 date-time, e.g. 2026-08-23T18:00:00Z.` });
        return;
    }

    await interaction.deferReply();

    const response = await fetch(`${leaderboardUrl}/api/moderation/multiplier/${id}`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${config.wfcSecret}`,
        },
        body: JSON.stringify({
            value: value,
            startTime: start.toISOString(),
            endTime: end.toISOString(),
        }),
    });

    if (response.status >= 500) {
        await interaction.editReply({ content: `Failed to update multiplier #${id}: server error ${response.status}` });
        return;
    }

    const result: MultiplierResponse = await response.json();
    if (!result.success) {
        await interaction.editReply({ content: `Failed to update multiplier #${id}: ${result.message}` });
        return;
    }

    await interaction.editReply({ content: `Updated multiplier ${fmtMultiplier(result.multiplier!)}` });
}

async function remove(interaction: ChatInputCommandInteraction<CacheType>): Promise<void> {
    const id = interaction.options.getInteger("id", true);

    await interaction.deferReply();

    const response = await fetch(`${leaderboardUrl}/api/moderation/multiplier/${id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${config.wfcSecret}` },
    });

    if (response.status >= 500) {
        await interaction.editReply({ content: `Failed to remove multiplier #${id}: server error ${response.status}` });
        return;
    }

    const result: MultiplierDeleteResponse = await response.json();
    if (!result.success) {
        await interaction.editReply({ content: `Failed to remove multiplier #${id}: ${result.message}` });
        return;
    }

    await interaction.editReply({ content: `Removed multiplier #${id}` });
}

export const command: Command = {
    permissions: PermissionBit.ADMIN,

    data: new SlashCommandBuilder()
        .setName("multiplier")
        .setDescription("Manage scheduled VR multipliers")
        .addSubcommand(subcommand => subcommand.setName("set")
            .setDescription("Schedule a new multiplier")
            .addStringOption(option => option.setName("channel")
                .setDescription("the channel to schedule this multiplier on")
                .setRequired(true)
                .addChoices(
                    { name: "Stable", value: "stable" },
                    { name: "Beta", value: "beta" },
                ))
            .addNumberOption(option => option.setName("value")
                .setDescription("the multiplier value, e.g. 2.0 for 2x (1.0 = no multiplier)")
                .setMinValue(0)
                .setRequired(true))
            .addStringOption(option => option.setName("start")
                .setDescription("start time, ISO 8601, e.g. 2026-08-23T18:00:00Z")
                .setRequired(true))
            .addStringOption(option => option.setName("end")
                .setDescription("end time, ISO 8601, e.g. 2026-08-23T18:00:00Z")
                .setRequired(true)))
        .addSubcommand(subcommand => subcommand.setName("list")
            .setDescription("List scheduled multipliers")
            .addStringOption(option => option.setName("channel")
                .setDescription("restrict to a single channel")
                .addChoices(
                    { name: "Stable", value: "stable" },
                    { name: "Beta", value: "beta" },
                )))
        .addSubcommand(subcommand => subcommand.setName("update")
            .setDescription("Update a scheduled multiplier's value or time range")
            .addIntegerOption(option => option.setName("id")
                .setDescription("the multiplier id, from /multiplier list")
                .setRequired(true))
            .addNumberOption(option => option.setName("value")
                .setDescription("the multiplier value, e.g. 2.0 for 2x (1.0 = no multiplier)")
                .setMinValue(0)
                .setRequired(true))
            .addStringOption(option => option.setName("start")
                .setDescription("start time, ISO 8601, e.g. 2026-08-23T18:00:00Z")
                .setRequired(true))
            .addStringOption(option => option.setName("end")
                .setDescription("end time, ISO 8601, e.g. 2026-08-23T18:00:00Z")
                .setRequired(true)))
        .addSubcommand(subcommand => subcommand.setName("remove")
            .setDescription("Remove a scheduled multiplier")
            .addIntegerOption(option => option.setName("id")
                .setDescription("the multiplier id, from /multiplier list")
                .setRequired(true)))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    exec: async function(interaction: ChatInputCommandInteraction<CacheType>): Promise<void> {
        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
        case "set":
            await set(interaction);
            break;
        case "list":
            await list(interaction);
            break;
        case "update":
            await update(interaction);
            break;
        case "remove":
            await remove(interaction);
            break;
        }
    },
};
