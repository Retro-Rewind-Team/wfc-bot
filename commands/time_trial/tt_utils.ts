import { AutocompleteInteraction } from "discord.js";
import { getConfig } from "../../config.js";

const config = getConfig();

export interface Track {
    id: number;
    name: string;
    trackSlot: string;
    courseId: number;
    category: string;
    laps: number;
    supportsGlitch: boolean;
}

export interface TTProfile {
    id: number;
    displayName: string;
    totalSubmissions: number;
    currentWorldRecords: number;
    countryCode: number;
    countryAlpha2: string;
    countryName: string;
}

export interface Country {
    numericCode: number;
    alpha2: string;
    name: string;
}

let tracksCache: Track[] | null = null;
let tracksCacheTime: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export async function fetchTracks(): Promise<Track[]> {
    const now = Date.now();
    if (tracksCache && (now - tracksCacheTime) < CACHE_DURATION)
        return tracksCache;


    const leaderboardUrl = `http://${config.leaderboardServer}:${config.leaderboardPort}`;
    const response = await fetch(`${leaderboardUrl}/api/timetrial/tracks`, {
        method: "GET",
        headers: { "Authorization": `Bearer ${config.wfcSecret}` }
    });

    if (response.ok) {
        const tracks = await response.json() as Track[];
        tracksCache = tracks || [];
        tracksCacheTime = now;
        return tracksCache || [];
    }
    else {
        console.error(`Failed to fetch tracks: ${response.status}`);
        return [];
    }
}

export async function fetchProfiles(): Promise<TTProfile[]> {
    const leaderboardUrl = `http://${config.leaderboardServer}:${config.leaderboardPort}`;
    const response = await fetch(`${leaderboardUrl}/api/moderation/timetrial/profiles`, {
        method: "GET",
        headers: { "Authorization": `Bearer ${config.wfcSecret}` }
    });

    if (response.ok) {
        const data = await response.json() as { profiles: TTProfile[] };
        return data.profiles || [];
    }
    else {
        console.error(`Failed to fetch profiles: ${response.status}`);
        return [];
    }
}

export async function fetchCountries(): Promise<Country[]> {
    const leaderboardUrl = `http://${config.leaderboardServer}:${config.leaderboardPort}`;
    const response = await fetch(`${leaderboardUrl}/api/moderation/countries`, {
        method: "GET",
        headers: { "Authorization": `Bearer ${config.wfcSecret}` }
    });

    if (response.ok) {
        const data = await response.json() as { countries: Country[] };
        return data.countries || [];
    }
    else {
        console.error(`Failed to fetch countries: ${response.status}`);
        return [];
    }
}

export async function handleTrackAutocomplete(interaction: AutocompleteInteraction): Promise<void> {
    const focusedValue = interaction.options.getFocused().toLowerCase();
    const tracks = await fetchTracks();

    const filtered = tracks
        .filter(track => track.name.toLowerCase().includes(focusedValue))
        .slice(0, 25)
        .map(track => ({
            name: track.name,
            value: track.id.toString()
        }));

    await interaction.respond(filtered);
}

export async function handleProfileAutocomplete(interaction: AutocompleteInteraction): Promise<void> {
    const focusedValue = interaction.options.getFocused().toLowerCase();
    const profiles = await fetchProfiles();

    const filtered = profiles
        .filter(profile => profile.displayName.toLowerCase().includes(focusedValue))
        .slice(0, 25)
        .map(profile => ({
            name: `${profile.displayName} (${profile.totalSubmissions} submissions, ${profile.currentWorldRecords} WRs)`,
            value: profile.id.toString()
        }));

    await interaction.respond(filtered);
}

export async function handleCountryAutocomplete(interaction: AutocompleteInteraction): Promise<void> {
    const focusedValue = interaction.options.getFocused().toLowerCase();
    const countries = await fetchCountries();

    const filtered = countries
        .filter(country =>
            country.name.toLowerCase().includes(focusedValue) ||
            country.alpha2.toLowerCase().includes(focusedValue)
        )
        .slice(0, 25)
        .map(country => ({
            name: `${country.name} (${country.alpha2})`,
            value: country.numericCode.toString()
        }));

    await interaction.respond(filtered);
}
