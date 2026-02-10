const request = require("supertest")
const express = require("express")

jest.mock("@prisma/client", () => {
  const mPrisma = {
    gasto: {
      findMany: jest.fn(),
      aggregate: jest.fn(),
    },
    ingreso: {
      findMany: jest.fn(),
      aggregate: jest.fn(),
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

const { PrismaClient } = require("@prisma/client")
const router = require("../routes/balance/balance.js")
const prisma = new PrismaClient()

describe("Movimientos routes", () => {
  let app

  beforeEach(() => {
    app = express()
    app.use(express.json())
    app.use("/movimientos", router)
    jest.clearAllMocks()
  })

  describe("GET /movimientos/agrupado", () => {
    it("deberia agrupar ingresos y gastos por mes correctamente", async () => {
      prisma.gasto.findMany.mockResolvedValue([
        {
          id: 1,
          usuarioId: "user-123",
          gasto: 100,
          fecha: new Date("2024-01-10"),
          montoAnterior: null,
          categoriaId: 1,
        },
      ])

      prisma.ingreso.findMany.mockResolvedValue([
        {
          id: 2,
          usuarioId: "user-123",
          ingreso: 500,
          fecha: new Date("2024-01-15"),
          montoAnterior: null,
        },
      ])

      const res = await request(app).get("/movimientos/agrupado")

      expect(res.status).toBe(200)
      expect(res.body).toHaveLength(1)

      const period = res.body[0]
      expect(period.period).toBe("2024-01")
      expect(period.totalIngresos).toBe(500)
      expect(period.totalEgresos).toBe(100)
      expect(period.items).toHaveLength(2)
    })

    it("deberia respetar el orden descendente", async () => {
      prisma.gasto.findMany.mockResolvedValue([
        {
          id: 1,
          usuarioId: "user-123",
          gasto: 50,
          fecha: new Date("2024-01-01"),
          montoAnterior: null,
          categoriaId: 1,
        },
        {
          id: 2,
          usuarioId: "user-123",
          gasto: 75,
          fecha: new Date("2024-02-01"),
          montoAnterior: null,
          categoriaId: 1,
        },
      ])

      prisma.ingreso.findMany.mockResolvedValue([])

      const res = await request(app)
        .get("/movimientos/agrupado")
        .query({ order: "desc" })

      expect(res.status).toBe(200)
      expect(res.body[0].period).toBe("2024-02")
      expect(res.body[1].period).toBe("2024-01")
    })

    it("deberia devolver 400 si el userId es inválido", async () => {
      const validateToken = require("../middleware/validateToken.js")
      validateToken.mockImplementationOnce((req, _res, next) => {
        req.user = { user_id: null }
        next()
      })

      const res = await request(app).get("/movimientos/agrupado")

      expect(res.status).toBe(400)
      expect(res.body.error).toBe("Missing or invalid userId")
    })

    it("deberia manejar errores internos", async () => {
      prisma.gasto.findMany.mockRejectedValue(new Error("DB error"))

      const res = await request(app).get("/movimientos/agrupado")

      expect(res.status).toBe(500)
      expect(res.body.error).toBe("Internal server error")
    })
  })

  describe("GET /movimientos/:userId", () => {
    it("deberia calcular correctamente el balance", async () => {
      prisma.gasto.aggregate.mockResolvedValue({
        _sum: { gasto: 200 },
      })

      prisma.ingreso.aggregate.mockResolvedValue({
        _sum: { ingreso: 500 },
      })

      const res = await request(app).get("/movimientos/user-123")

      expect(res.status).toBe(200)
      expect(res.body).toEqual({
        balance: 300,
        sumaIngresos: 500,
        sumaGastos: 200,
      })
    })

    it("deberia manejar valores nulos", async () => {
      prisma.gasto.aggregate.mockResolvedValue({
        _sum: { gasto: null },
      })

      prisma.ingreso.aggregate.mockResolvedValue({
        _sum: { ingreso: null },
      })

      const res = await request(app).get("/movimientos/user-123")

      expect(res.status).toBe(200)
      expect(res.body).toEqual({
        balance: 0,
        sumaIngresos: 0,
        sumaGastos: 0,
      })
    })

    it("deberia manejar errores de prisma", async () => {
      prisma.gasto.aggregate.mockRejectedValue(new Error("Aggregate failed"))

      const res = await request(app).get("/movimientos/user-123")

      expect(res.status).toBe(400)
      expect(res.body.error).toBe("Aggregate failed")
    })
  })
})
