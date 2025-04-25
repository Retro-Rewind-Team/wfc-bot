import { CacheType, ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder } from "discord.js";
import child_process from "child_process";
import { Config, getConfig, setConfig } from "../config.js";
import os from "os";
import { exit } from "process";
import { existsSync, writeFileSync } from "fs";

let config: Config = null!;
let pulsarToolsBin: string = null!;

export default {
    modOnly: false,
    adminOnly: false,

    data: new SlashCommandBuilder()
        .setName("crashdump")
        .setDescription("Print the stacktrace and registers from a crashdump")
        .addAttachmentOption(option => option.setName("file")
            .setDescription("The crash.pul file")
            .setRequired(true)
        ),

    init: async function() {
        config = getConfig();
        switch (os.platform()) {
        case "linux":
            pulsarToolsBin = "pulsar-tools";
            break;
        case "win32":
            pulsarToolsBin = "pulsar-tools.exe";
            break;
        case "darwin":
            pulsarToolsBin = "pulsar-tools-osx";
            break;
        default:
            console.error(`Unknown platform ${os.platform()}!`);
            exit(1);
        }

        const res = await fetch("https://api.github.com/repos/ppebb/pulsar-tools/releases/latest");

        if (!res.ok) {
            console.error(`Failed to fetch latest version of pulsar-tools! ${res.status}, ${res.statusText}`);
            exit(1);
        }

        const json = await res.json();

        if (!config.pulsarToolsTag || json.tag_name != config.pulsarToolsTag || !existsSync(pulsarToolsBin)) {
            console.log(`Downloading ${pulsarToolsBin}, ${json.tag_name}...`);

            const binRes = await fetch(`https://github.com/ppebb/pulsar-tools/releases/download/${json.tag_name}/${pulsarToolsBin}`);

            if (!binRes.ok) {
                console.error(`Failed to download latest version of pulsar-tools! ${res.status}, ${res.statusText}`);
                exit(1);
            }

            writeFileSync(
                pulsarToolsBin,
                Buffer.from(await binRes.arrayBuffer()),
                {
                    flag: "w+",
                    // Executable
                    mode: 755,
                }
            );

            console.log(`Downloaded ${pulsarToolsBin}, ${json.tag_name} successfully!`);

            config.pulsarToolsTag = json.tag_name;
            setConfig(config);
        }
        else
            console.log(`Using pulsar-tools ${json.tag_name}`);
    },

    exec: async function(interaction: ChatInputCommandInteraction<CacheType>) {
        const binaryAttachment = interaction.options.getAttachment("file", true);
        const binaryResponse = await fetch(binaryAttachment.url);

        if (!binaryResponse.ok) {
            await interaction.reply({
                content: `Error fetching payload attachment: ${binaryResponse.status}`,
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        const buffer = Buffer.from(await binaryResponse.arrayBuffer());

        const proc = child_process.spawn(`${process.cwd()}/${pulsarToolsBin}`, ["crash", "--file", "stdin"], {
            cwd: process.cwd(),
            stdio: "pipe"
        });
        proc.stdin.write(buffer);
        proc.stdin.end();

        let stdoutAgg = "";
        proc.stdout.on("data", (chunk) => {
            stdoutAgg += chunk.toString();
        });

        let stderrAgg = "";
        proc.stderr.on("data", (chunk) => {
            stderrAgg += chunk.toString();
        });

        proc.on("close", async (code, _) => {
            if (code == 0) {
                await interaction.reply({
                    content: `\`\`\`${stdoutAgg}\`\`\``,
                });
            }
            else {
                console.error(`Error processing crashdump: ${stderrAgg}`);
                await interaction.reply({
                    content: `\`\`\`${stderrAgg}\`\`\``,
                    flags: MessageFlags.Ephemeral,
                });
            }
        });
    }
};
