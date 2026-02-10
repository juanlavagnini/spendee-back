const { PrismaClient } = require("@prisma/client")
const { seedPiggy } = require("../piggy/seed.js")

const prisma = new PrismaClient()

const defaultCategories = [
  {
    usuarioId: "0",
    nombre: "Transporte",
    icono: "bus",
    color: "#FF5733",
    descripcion: "Transporte público y privado",
  },
  {
    usuarioId: "0",
    nombre: "Comida",
    icono: "utensils",
    color: "#33C3FF",
    descripcion: "Alimentos y restaurantes",
  },
  {
    usuarioId: "0",
    nombre: "Hogar",
    icono: "home",
    color: "#8E44AD",
    descripcion: "Gastos del hogar y servicios",
  },
  {
    usuarioId: "0",
    nombre: "Salud",
    icono: "heart",
    color: "#E74C3C",
    descripcion: "Medicinas y consultas",
  },
  {
    usuarioId: "0",
    nombre: "Entretenimiento",
    icono: "gamepad",
    color: "#F1C40F",
    descripcion: "Cine, ocio y suscripciones",
  },
  {
    usuarioId: "0",
    nombre: "Educación",
    icono: "book",
    color: "#2ECC71",
    descripcion: "Cursos, libros y formación",
  },
  {
    usuarioId: "0",
    nombre: "Otros",
    icono: "ellipsis-h",
    color: "#95A5A6",
    descripcion: "Gastos varios",
  },
]

async function main() {
  for (const cat of defaultCategories) {
    const exists = await prisma.categorias.findFirst({
      where: { nombre: cat.nombre },
    })
    if (!exists) {
      await prisma.categorias.create({ data: cat })
      console.log("Inserted", cat.nombre)
    } else {
      console.log("Already exists", cat.nombre)
    }
  }

  console.log("--- Starting Piggy Seed ---")
  try {
     await seedPiggy()
  } catch (error) {
     console.error("Error seeding piggy:", error)
  }
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
