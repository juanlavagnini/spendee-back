const request = require("supertest")
const express = require("express")

jest.mock("@prisma/client", () => {
  const mPrisma = {
    categorias: {
      findFirst: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
    },
    gasto: {
      create: jest.fn(),
      findMany: jest.fn(),
      aggregate: jest.fn(),
    },
    ingreso: {
      create: jest.fn(),
      findMany: jest.fn(),
      aggregate: jest.fn(),
    },
  }

  return {
    PrismaClient: jest.fn(() => mPrisma),
  }
})

jest.mock("../middleware/validateToken", () =>
  jest.fn((req, _res, next) => {
    req.user = { user_id: "user-test-123" }
    next()
  }),
)

const { PrismaClient } = require("@prisma/client")
const financeRouter = require("../routes/api.js")

const prisma = new PrismaClient()

const app = express()
app.use(express.json())
app.use("/", financeRouter)

describe("API routes", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("POST /gasto", () => {
    it("deberia crear gasto con categoría existente", async () => {
      prisma.categorias.findFirst.mockResolvedValue({ id: 1 })
      prisma.gasto.aggregate.mockResolvedValueOnce({ _sum: { gasto: 50 } })
      prisma.ingreso.aggregate.mockResolvedValueOnce({ _sum: { ingreso: 200 } })
      prisma.gasto.create.mockResolvedValue({ id: 10 })

      const res = await request(app)
        .post("/gasto")
        .send({ gasto: 20, categoryName: "Comida" })

      expect(res.status).toBe(201)
      expect(prisma.gasto.create).toHaveBeenCalled()
    })

    it("deberia crear categoría si no existe", async () => {
      prisma.categorias.findFirst.mockResolvedValue(null)
      prisma.categorias.create.mockResolvedValue({ id: 2 })
      prisma.gasto.aggregate.mockResolvedValueOnce({ _sum: { gasto: 0 } })
      prisma.ingreso.aggregate.mockResolvedValueOnce({ _sum: { ingreso: 100 } })
      prisma.gasto.create.mockResolvedValue({})

      const res = await request(app)
        .post("/gasto")
        .send({ gasto: 10, categoryName: "Nueva" })

      expect(res.status).toBe(201)
      expect(prisma.categorias.create).toHaveBeenCalled()
    })

    it("deberia rechazar gasto inválido", async () => {
      const res = await request(app)
        .post("/gasto")
        .send({ gasto: "abc", categoryName: "Comida" })

      expect(res.status).toBe(400)
    })
  })

  /**
   * GET /gastos
   */
  describe("GET /gastos", () => {
    it("deberia devolver gastos filtrados por categoría", async () => {
      prisma.categorias.findFirst.mockResolvedValue({ id: 1 })
      prisma.gasto.findMany.mockResolvedValue([{ id: 1 }, { id: 2 }])

      const res = await request(app)
        .get("/gastos")
        .query({ categoryName: "Comida" })

      expect(res.status).toBe(200)
      expect(res.body.length).toBe(2)
    })

    it("deberia devolver error si la categoría no existe", async () => {
      prisma.categorias.findFirst.mockResolvedValue(null)

      const res = await request(app)
        .get("/gastos")
        .query({ categoryName: "Fantasma" })

      expect(res.status).toBe(400)
    })
  })

  describe("POST /ingreso", () => {
    it("deberia crear ingreso con montoAnterior correcto", async () => {
      prisma.gasto.aggregate.mockResolvedValueOnce({ _sum: { gasto: 30 } })
      prisma.ingreso.aggregate.mockResolvedValueOnce({ _sum: { ingreso: 100 } })
      prisma.ingreso.create.mockResolvedValue({ id: 5 })

      const res = await request(app).post("/ingreso").send({ ingreso: 50 })

      expect(res.status).toBe(201)
      expect(prisma.ingreso.create).toHaveBeenCalled()
    })
  })

  describe("GET /ingresos", () => {
    it("deberia devolver lista de ingresos", async () => {
      prisma.ingreso.findMany.mockResolvedValue([{ id: 1 }, { id: 2 }])

      const res = await request(app).get("/ingresos")

      expect(res.status).toBe(200)
      expect(res.body.length).toBe(2)
    })
  })

  describe("GET /balance", () => {
    it("deberia devolver balance agrupado por mes", async () => {
      prisma.gasto.findMany.mockResolvedValue([
        { gasto: 50, fecha: new Date("2024-01-10") },
      ])
      prisma.ingreso.findMany.mockResolvedValue([
        { ingreso: 100, fecha: new Date("2024-01-05") },
      ])

      const res = await request(app).get("/balance")

      expect(res.status).toBe(200)
      expect(res.body[0].totalIngresos).toBe(100)
      expect(res.body[0].totalEgresos).toBe(50)
    })
  })

  describe("GET /categories", () => {
    it("deberia devolver categorías del usuario y globales", async () => {
      prisma.categorias.findMany.mockResolvedValue([
        { id: 1, usuarioId: "0" },
        { id: 2, usuarioId: "user-test-123" },
      ])

      const res = await request(app).get("/categories")

      expect(res.status).toBe(200)
      expect(res.body.length).toBe(2)
    })
  })
})
