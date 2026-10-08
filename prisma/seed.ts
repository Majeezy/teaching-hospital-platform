import { prisma } from "../lib/prisma";

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

  console.log("Seeded roles, departments, and competency catalog.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
