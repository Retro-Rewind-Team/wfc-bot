import { makeRoleCommand, PermissionBit } from "../shared/roles.js";

export default makeRoleCommand(
    "bkt_updater",
    "BKT Updater",
    PermissionBit.BKT_UPDATER,
    PermissionBit.ADMIN,
);
