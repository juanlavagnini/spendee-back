const request = require("supertest")
const express = require("express")

jest.mock("@prisma/client", () => {
  const mPrisma = {
    piggy: {
      upsert: jest.fn(),
      updateMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    objetivoUsuario: {
      update: jest.fn(),
      delete: jest.fn(),
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  }

  return {
    PrismaClient: jest.fn(() => mPrisma),
  }
})

jest.mock("../middleware/validateToken", () =>
  jest.fn((req, _res, next) => {
    req.user = { sub: "user-123" }
    next()
  }),
)

jest.mock("../helpers/getRandomObjectives", () => jest.fn())

const getRandomObjectives = require("../helpers/getRandomObjectives")
const piggyRouter = require("../piggy/routes") // ajustá el path si hace falta
const { PrismaClient } = require("@prisma/client")

const prisma = new PrismaClient()

const app = express()
app.use(express.json())
app.use("/piggy", piggyRouter)

describe("Piggy routes", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("GET /piggy", () => {
    it("deberia crear un piggy si no existe", async () => {
      getRandomObjectives.mockResolvedValue([{ id: 1 }, { id: 2 }, { id: 3 }])

      prisma.piggy.upsert.mockResolvedValue({
        id: 10,
        usuarioId: "user-123",
        objetivos: [],
      })

      const res = await request(app).get("/piggy")

      expect(res.status).toBe(200)
      expect(prisma.piggy.upsert).toHaveBeenCalled()
      expect(getRandomObjectives).toHaveBeenCalledWith(3)
    })

    it("devuelve 400 en caso de error", async () => {
      prisma.piggy.upsert.mockRejectedValue(new Error("DB error"))

      const res = await request(app).get("/piggy")

      expect(res.status).toBe(400)
      expect(res.body.error).toBe("DB error")
    })
  })

  describe("PUT /piggy/updatePiggy", () => {
    it("deberia actualizar el nombre del piggy", async () => {
      prisma.piggy.updateMany.mockResolvedValue({ count: 1 })

      const res = await request(app)
        .put("/piggy/updatePiggy")
        .send({ nombre: "Mi chanchito" })

      expect(res.status).toBe(200)
      expect(prisma.piggy.updateMany).toHaveBeenCalledWith({
        where: { usuarioId: "user-123" },
        data: { nombre: "Mi chanchito" },
      })
    })
  })

  describe("GET /piggy/checkObjective", () => {
    it("deberia devolver 400 si falta la acción", async () => {
      const res = await request(app).get("/piggy/checkObjective")

      expect(res.status).toBe(400)
    })

    it("deberia devolver updated false si ningún objetivo coincide con la acción", async () => {
      prisma.piggy.findUnique.mockResolvedValue({
        id: 1,
        xp: 0,
        objetivos: [
          {
            id: 5,
            progreso: 0,
            objetivo: { accion: "SAVE", maxProgreso: 3 },
          },
        ],
      })

      const res = await request(app)
        .get("/piggy/checkObjective")
        .query({ action: "SPEND" })

      expect(res.status).toBe(200)
      expect(res.body.updated).toBe(false)
    })

    it("deberia actualizar el progreso del objetivo y completarlo", async () => {
      prisma.piggy.findUnique.mockResolvedValue({
        id: 1,
        xp: 0,
        objetivos: [
          {
            id: 10,
            progreso: 2,
            objetivoId: 7,
            objetivo: {
              accion: "SAVE",
              maxProgreso: 3,
            },
          },
        ],
      })

      getRandomObjectives.mockResolvedValue([{ id: 99 }])
      prisma.$transaction.mockResolvedValue()

      const res = await request(app)
        .get("/piggy/checkObjective")
        .query({ action: "SAVE" })

      expect(res.status).toBe(200)
      expect(prisma.$transaction).toHaveBeenCalled()
      expect(res.body.updated).toBe(true)
    })
  })

  describe("PUT /piggy/updateAvatar", () => {
    it("deberia actualizar el avatarId", async () => {
      prisma.piggy.update.mockResolvedValue({
        id: 1,
        avatarId: 3,
      })

      const res = await request(app)
        .put("/piggy/updateAvatar")
        .send({ avatarId: 3 })

      expect(res.status).toBe(200)
      expect(prisma.piggy.update).toHaveBeenCalledWith({
        where: { usuarioId: "user-123" },
        data: { avatarId: 3 },
      })
    })
  })
})
