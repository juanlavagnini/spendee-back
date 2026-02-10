const request = require("supertest")
const express = require("express")

jest.mock("@prisma/client", () => {
  const mPrisma = {
    ingreso: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    racha: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    $queryRaw: jest.fn(),
  }

  return {
    PrismaClient: jest.fn(() => mPrisma),
  }
})

jest.mock("../middleware/validateToken.js", () =>
  jest.fn((req, res, next) => {
    req.user = { user_id: "user-test-123" }
    next()
  }),
)

const { PrismaClient } = require("@prisma/client")
const ingresoRouter = require("../routes/incomes/incomes.js")

const prisma = new PrismaClient()

const app = express()
app.use(express.json())
app.use("/ingreso", ingresoRouter)

describe("Ingreso routes", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("POST /ingreso", () => {
    it("deberia crear un ingreso y una racha si no existe", async () => {
      prisma.ingreso.create.mockResolvedValue({
        id: 1,
        ingreso: 1000,
        montoAnterior: 500,
      })

      prisma.racha.findUnique.mockResolvedValue(null)
      prisma.racha.create.mockResolvedValue({})

      const res = await request(app)
        .post("/ingreso")
        .send({ ingreso: 1000, montoAnterior: 500 })

      expect(res.status).toBe(201)
      expect(prisma.ingreso.create).toHaveBeenCalled()
      expect(prisma.racha.create).toHaveBeenCalled()
    })

    it("deberia incrementar la racha si el último ingreso fue ayer", async () => {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)

      prisma.ingreso.create.mockResolvedValue({ id: 1 })
      prisma.racha.findUnique.mockResolvedValue({
        rachaActual: 3,
        ultimaFecha: yesterday,
      })

      prisma.racha.update.mockResolvedValue({})

      const res = await request(app)
        .post("/ingreso")
        .send({ ingreso: 500, montoAnterior: 400 })

      expect(res.status).toBe(201)
      expect(prisma.racha.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            rachaActual: 4,
          }),
        }),
      )
    })

    it("deberia reiniciar la racha si esta inactiva", async () => {
      const oldDate = new Date()
      oldDate.setDate(oldDate.getDate() - 5)

      prisma.ingreso.create.mockResolvedValue({ id: 1 })
      prisma.racha.findUnique.mockResolvedValue({
        rachaActual: 10,
        ultimaFecha: oldDate,
      })

      prisma.racha.update.mockResolvedValue({})

      const res = await request(app)
        .post("/ingreso")
        .send({ ingreso: 800, montoAnterior: 700 })

      expect(res.status).toBe(201)
      expect(prisma.racha.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            rachaActual: 1,
          }),
        }),
      )
    })
  })

  describe("GET /ingreso", () => {
    it("deberia devolver ingresos filtrados por mes y año", async () => {
      prisma.ingreso.findMany.mockResolvedValue([{ id: 1, ingreso: 1000 }])

      const res = await request(app)
        .get("/ingreso")
        .query({ month: 5, year: 2024 })

      expect(res.status).toBe(200)
      expect(prisma.ingreso.findMany).toHaveBeenCalled()
      expect(res.body.length).toBe(1)
    })

    it("deberia aplicar orden descendente", async () => {
      prisma.ingreso.findMany.mockResolvedValue([])

      await request(app).get("/ingreso").query({ order: "desc" })

      expect(prisma.ingreso.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { fecha: "desc" },
        }),
      )
    })
  })

  describe("GET /ingreso/grouped", () => {
    it("deberia devolver ingresos agrupados por mes", async () => {
      prisma.$queryRaw.mockResolvedValue([
        {
          month: "2024-05",
          items: [{ id: 1, ingreso: 1000 }],
        },
      ])

      const res = await request(app).get("/ingreso/grouped")

      expect(res.status).toBe(200)
      expect(prisma.$queryRaw).toHaveBeenCalled()
      expect(res.body[0].month).toBe("2024-05")
    })
  })

  describe("GET /ingreso/byId/:id", () => {
    it("deberia devolver un ingreso por id", async () => {
      prisma.ingreso.findUnique.mockResolvedValue({
        id: 1,
        ingreso: 1000,
      })

      const res = await request(app).get("/ingreso/byId/1")

      expect(res.status).toBe(200)
      expect(res.body.id).toBe(1)
    })

    it("deberia devolver 404 si no existe", async () => {
      prisma.ingreso.findUnique.mockResolvedValue(null)

      const res = await request(app).get("/ingreso/byId/999")

      expect(res.status).toBe(404)
    })

    it("deberia devolver 400 si el id no es válido", async () => {
      const res = await request(app).get("/ingreso/byId/abc")
      expect(res.status).toBe(400)
    })
  })
})
