import { makeRoleCommand, PermissionBit } from "../shared/roles.js";

export default makeRoleCommand(
    "admin",
    "Admin",
    PermissionBit.ADMIN,
    PermissionBit.SUPER_ADMIN,
);
