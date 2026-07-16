import "dotenv/config"

import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "../generated/prisma/client"

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
})

const prisma = new PrismaClient({
  adapter,
})

const categories = [
  {
    code: "TRAVEL",
    name: "Travelling Allowance",
    description: "Allowance for work-related travel.",
    isTaxableDefault: true,
    includedInGratuityDefault: false,
  },
  {
    code: "PHONE",
    name: "Phone Allowance",
    description: "Allowance for mobile or telephone expenses.",
    isTaxableDefault: true,
    includedInGratuityDefault: false,
  },
  {
    code: "PROF",
    name: "Professional Allowance",
    description:
      "Allowance for professional duties, membership or development.",
    isTaxableDefault: true,
    includedInGratuityDefault: false,
  },
  {
    code: "HOUSING",
    name: "Housing Allowance",
    description: "Allowance for accommodation or housing costs.",
    isTaxableDefault: true,
    includedInGratuityDefault: false,
  },
  {
    code: "DUTY",
    name: "Duty Allowance",
    description: "Allowance for additional or special duties.",
    isTaxableDefault: true,
    includedInGratuityDefault: false,
  },
  {
    code: "ENT",
    name: "Entertainment Allowance",
    description: "Allowance for approved business entertainment.",
    isTaxableDefault: true,
    includedInGratuityDefault: false,
  },
]

async function main() {
  const organization = await prisma.organization.findFirst({
    orderBy: {
      createdAt: "asc",
    },
    select: {
      id: true,
    },
  })

  if (!organization) {
    throw new Error("No organization is configured.")
  }

  for (const category of categories) {
    await prisma.allowanceCategory.upsert({
      where: {
        organizationId_name: {
          organizationId: organization.id,
          name: category.name,
        },
      },
      update: {
        code: category.code,
        description: category.description,
        isTaxableDefault: category.isTaxableDefault,
        includedInGratuityDefault:
          category.includedInGratuityDefault,
        isActive: true,
      },
      create: {
        organizationId: organization.id,
        ...category,
      },
    })
  }

  console.log(
    `Seeded ${categories.length} allowance categories.`,
  )
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
