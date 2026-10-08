import { describe, expect, it } from "vitest";
import {
  AuthorizationError,
  hasAnyRole,
  hasRole,
  isSelf,
  requireRole,
  requireSelfOrRole,
  type SessionUser,
} from "@/lib/permissions";

function makeUser(overrides: Partial<SessionUser> = {}): SessionUser {
  return {
    id: "user-1",
    name: "Test User",
    email: "test@example.com",
    roles: ["PATIENT"],
    isActive: true,
    ...overrides,
  };
}

describe("hasRole / hasAnyRole", () => {
  it("returns true when the user holds the role", () => {
    expect(hasRole(makeUser({ roles: ["DOCTOR"] }), "DOCTOR")).toBe(true);
  });

  it("returns false when the user does not hold the role", () => {
    expect(hasRole(makeUser({ roles: ["PATIENT"] }), "DOCTOR")).toBe(false);
  });

  it("supports multi-role users (e.g. a doctor who also supervises)", () => {
    const user = makeUser({ roles: ["DOCTOR", "STUDENT"] });
    expect(hasAnyRole(user, ["STUDENT", "NURSE"])).toBe(true);
  });
});

describe("requireRole", () => {
  it("does not throw when the user holds one of the required roles", () => {
    expect(() =>
      requireRole(
        makeUser({ roles: ["HOSPITAL_ADMIN"] }),
        "HOSPITAL_ADMIN",
        "SYSTEM_ADMIN",
      ),
    ).not.toThrow();
  });

  it("throws AuthorizationError when the user holds none of the required roles", () => {
    expect(() =>
      requireRole(
        makeUser({ roles: ["PATIENT"] }),
        "HOSPITAL_ADMIN",
        "SYSTEM_ADMIN",
      ),
    ).toThrow(AuthorizationError);
  });
});

describe("isSelf / requireSelfOrRole", () => {
  it("isSelf is true only for the user's own id", () => {
    const user = makeUser({ id: "user-1" });
    expect(isSelf(user, "user-1")).toBe(true);
    expect(isSelf(user, "user-2")).toBe(false);
  });

  it("allows acting on your own record with no special role", () => {
    const user = makeUser({ id: "user-1", roles: ["PATIENT"] });
    expect(() =>
      requireSelfOrRole(user, "user-1", "HOSPITAL_ADMIN"),
    ).not.toThrow();
  });

  it("allows an elevated role to act on someone else's record", () => {
    const admin = makeUser({ id: "admin-1", roles: ["HOSPITAL_ADMIN"] });
    expect(() =>
      requireSelfOrRole(admin, "user-2", "HOSPITAL_ADMIN"),
    ).not.toThrow();
  });

  it("rejects acting on someone else's record without the role", () => {
    const user = makeUser({ id: "user-1", roles: ["PATIENT"] });
    expect(() =>
      requireSelfOrRole(user, "user-2", "HOSPITAL_ADMIN"),
    ).toThrow(AuthorizationError);
  });
});
