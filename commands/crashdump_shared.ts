import { Config, getConfig, setConfig } from "../config.js";
import child_process from "child_process";
import os from "os";
import { exit } from "process";
import { existsSync, writeFileSync } from "fs";
import { haste } from "../utils.js";

let config: Config = null!;
export let pulsarToolsBin: string = null!;

export async function processCrashdump(buf: Buffer): Promise<[code: number | null, stdout: string, stderr: string]> {
    const [code, out, err] = await processCrashdumpInner(buf);

    if (code != 0)
        return [code, out, err];

    // 10 margin of error just in case
    if (out.length + 10 > 2000) {
        const [hcode, hout, herr] = await haste(out);

        return [hcode == 200 ? 0 : hcode, hout, herr];
    }

    return [code, `\`\`\`${out}\`\`\``, err];
}

async function processCrashdumpInner(buf: Buffer): Promise<[code: number | null, stdout: string, stderr: string]> {
    const proc = child_process.spawn(`${process.cwd()}/${pulsarToolsBin}`, ["crash", "--file", "stdin"], {
        cwd: process.cwd(),
        stdio: "pipe"
    });
    proc.stdin.write(buf);
    proc.stdin.end();

    let stdoutAgg = "";
    proc.stdout.on("data", (chunk) => {
        stdoutAgg += chunk.toString();
    });

    let stderrAgg = "";
    proc.stderr.on("data", (chunk) => {
        stderrAgg += chunk.toString();
    });

    return new Promise((resolve, _) =>
        proc.on("close", async (code, _) => {
            resolve([code, stdoutAgg, stderrAgg]);
        })
    );
}

export default {
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

        if (!res.ok)
            throw `Failed to fetch latest version of pulsar-tools! ${res.status}, ${res.statusText}`;

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
};
