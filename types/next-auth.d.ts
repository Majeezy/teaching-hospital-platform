import { RoleName } from "@prisma/client";

declare module "next-auth" {
  interface User {
    id: string;
    roles: RoleName[];
    isActive: boolean;
  }

  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      roles: RoleName[];
      isActive: boolean;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    roles: RoleName[];
    isActive: boolean;
  }
}
