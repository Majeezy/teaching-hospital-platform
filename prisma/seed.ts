import { prisma } from "../lib/prisma";
import { hashPassword } from "../lib/password";

// Fictional, documented in README -- not a real credential. Admins provision
// every other staff/student account, so one has to exist to bootstrap that.
const DEMO_ADMIN = {
  email: "admin@teachinghospital.test",
  password: "DemoAdmin123!",
  name: "Demo Hospital Admin",
};

const ROLES = [
  "SYSTEM_ADMIN",
  "HOSPITAL_ADMIN",
  "DOCTOR",
  "NURSE",
  "STUDENT",
  "PATIENT",
] as const;

const DEPARTMENTS = [
  "General Medicine",
  "Cardiology",
  "Pediatrics",
  "Emergency",
  "Surgery",
  "Radiology",
  "Dermatology",
  "Neurology",
];

const COMPETENCIES = [
  {
    name: "Communication",
    description:
      "Clear, empathetic communication with patients and colleagues.",
  },
  {
    name: "Patient History Taking",
    description: "Structured, thorough collection of patient history.",
  },
  {
    name: "Clinical Observation",
    description:
      "Accurate observation and interpretation of clinical presentations.",
  },
  {
    name: "Professional Conduct",
    description:
      "Professionalism, ethics, and reliability in a clinical setting.",
  },
];

async function main() {
  for (const name of ROLES) {
    await prisma.role.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  for (const name of DEPARTMENTS) {
    await prisma.department.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  for (const competency of COMPETENCIES) {
    await prisma.competency.upsert({
      where: { name: competency.name },
      update: {},
      create: competency,
    });
  }

  const adminRole = await prisma.role.findUniqueOrThrow({
    where: { name: "HOSPITAL_ADMIN" },
  });

  const passwordHash = await hashPassword(DEMO_ADMIN.password);
  await prisma.user.upsert({
    where: { email: DEMO_ADMIN.email },
    update: {},
    create: {
      name: DEMO_ADMIN.name,
      email: DEMO_ADMIN.email,
      passwordHash,
      roles: { create: { roleId: adminRole.id } },
    },
  });

  console.log(
    "Seeded roles, departments, competency catalog, and demo admin account.",
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
