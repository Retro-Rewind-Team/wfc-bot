import { Command } from "#src/commands/shared/command.js";
import { makeRoleCommand, PermissionBit } from "../shared/roles.js";

export const command: Command = makeRoleCommand(
    "admin",
    "Admin",
    PermissionBit.ADMIN,
    PermissionBit.SUPER_ADMIN,
);
