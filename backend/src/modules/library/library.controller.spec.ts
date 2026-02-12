import { LibraryController } from "./library.controller";
import { ROLES_KEY } from "../auth/auth.constants";
import { UserRole } from "@prisma/client";

describe("LibraryController RBAC", () => {
  it("restricts starter pack ingest to admin roles", () => {
    const roles = Reflect.getMetadata(
      ROLES_KEY,
      LibraryController.prototype.ingestStarterPack,
    );
    expect(roles).toEqual([UserRole.admin, UserRole.CLINIC_ADMIN]);
  });
});
