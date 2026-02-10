const request = require("supertest")
const express = require("express")

jest.mock("@prisma/client", () => {
  const mPrisma = {
    categorias: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
      update: jest.fn(),
    },
    gasto: {
      groupBy: jest.fn(),
    },
  }

  return {
    PrismaClient: jest.fn(() => mPrisma),
  }
})

jest.mock("../middleware/validateToken.js", () =>
  jest.fn((req, _res, next) => {
    req.user = { user_id: "user-123" }
    next()
  }),
)

const categoriesRouter = require("../routes/category/category")
const { PrismaClient } = require("@prisma/client")

const prisma = new PrismaClient()

const app = express()
app.use(express.json())
app.use("/categories", categoriesRouter)

describe("Categories routes", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("POST /categories/customCategory", () => {
    it("deberia crear una categoria personalizada", async () => {
      prisma.categorias.create.mockResolvedValue({
        id: 1,
        nombre: "Comida",
      })

      const res = await request(app).post("/categories/customCategory").send({
        nombre: "Comida",
        icono: "🍔",
        color: "#ff0000",
        descripcion: "Gastos de comida",
      })

      expect(res.status).toBe(201)
      expect(prisma.categorias.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          usuarioId: "user-123",
          nombre: "Comida",
        }),
      })
    })

    it("deberia retornar 400 en caso de error", async () => {
      prisma.categorias.create.mockRejectedValue(new Error("DB error"))

      const res = await request(app)
        .post("/categories/customCategory")
        .send({ nombre: "Error" })

      expect(res.status).toBe(400)
    })
  })

  describe("GET /categories", () => {
    it("deberia retornar las categorias con los gastos totales", async () => {
      prisma.categorias.findMany.mockResolvedValue([
        {
          id: 1,
          nombre: "Comida",
          icono: "🍔",
          color: "#f00",
          descripcion: "",
          editable: true,
        },
        {
          id: 2,
          nombre: "Transporte",
          icono: "🚌",
          color: "#0f0",
          descripcion: "",
          editable: false,
        },
      ])

      prisma.gasto.groupBy.mockResolvedValue([
        { categoriaId: 1, _sum: { gasto: 300 } },
      ])

      const res = await request(app).get("/categories")

      expect(res.status).toBe(200)
      expect(res.body).toHaveLength(2)
      expect(res.body[0].totalGastos).toBe(300)
      expect(res.body[1].totalGastos).toBe(0)
    })

    it("deberia aplicar el filtro de mes/año cuando se proporciona", async () => {
      prisma.categorias.findMany.mockResolvedValue([])
      prisma.gasto.groupBy.mockResolvedValue([])

      const res = await request(app)
        .get("/categories")
        .query({ month: "5", year: "2024" })

      expect(res.status).toBe(200)
      expect(prisma.gasto.groupBy).toHaveBeenCalled()
    })
  })

  describe("DELETE /categories/delete/:id", () => {
    it("deberia eliminar la categoria si el usuario es el dueño", async () => {
      prisma.categorias.findUnique.mockResolvedValue({
        id: 5,
        usuarioId: "user-123",
      })

      prisma.categorias.delete.mockResolvedValue({ id: 5 })

      const res = await request(app).delete("/categories/delete/5")

      expect(res.status).toBe(200)
      expect(prisma.categorias.delete).toHaveBeenCalledWith({
        where: { id: 5 },
      })
    })

    it("deberia retornar 404 si la categoria no existe", async () => {
      prisma.categorias.findUnique.mockResolvedValue(null)

      const res = await request(app).delete("/categories/delete/999")

      expect(res.status).toBe(404)
    })

    it("deberia retornar 403 si la categoria pertenece a otro usuario", async () => {
      prisma.categorias.findUnique.mockResolvedValue({
        id: 8,
        usuarioId: "other-user",
      })

      const res = await request(app).delete("/categories/delete/8")

      expect(res.status).toBe(403)
    })
  })

  describe("PUT /categories/modify/:id", () => {
    it("deberia actualizar la categoria si el usuario es el dueño", async () => {
      prisma.categorias.findUnique.mockResolvedValue({
        id: 3,
        usuarioId: "user-123",
        nombre: "Viejo",
        descripcion: "desc",
        icono: "❌",
        color: "#000",
      })

      prisma.categorias.update.mockResolvedValue({
        id: 3,
        nombre: "Nuevo",
      })

      const res = await request(app).put("/categories/modify/3").send({
        categoria: "Nuevo",
        color: "#fff",
      })

      expect(res.status).toBe(200)
      expect(prisma.categorias.update).toHaveBeenCalled()
    })

    it("deberia retornar 500 si la categoria no se encuentra", async () => {
      prisma.categorias.findUnique.mockResolvedValue(null)

      const res = await request(app).put("/categories/modify/123")

      expect(res.status).toBe(500)
    })

    it("deberia retornar 403 si la categoria pertenece a otro usuario", async () => {
      prisma.categorias.findUnique.mockResolvedValue({
        id: 4,
        usuarioId: "other-user",
      })

      const res = await request(app)
        .put("/categories/modify/4")
        .send({ categoria: "Hack" })

      expect(res.status).toBe(403)
    })
  })
})
