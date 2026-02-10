const request = require("supertest")
const express = require("express")

jest.mock("@prisma/client", () => {
  const mPrisma = {
    racha: {
      updateMany: jest.fn(),
    },
  }

  return {
    PrismaClient: jest.fn(() => mPrisma),
  }
})

const { PrismaClient } = require("@prisma/client")
const router = require("../routes/cron.js")

const prisma = new PrismaClient()

describe("Cron routes", () => {
  let app

  beforeAll(() => {
    process.env.CRON_SECRET = "super-secret-cron"
  })

  beforeEach(() => {
    app = express()
    app.use(express.json())
    app.use("/cron", router)
    jest.clearAllMocks()
  })

  describe("GET /cron", () => {
    it("deberia responder que el endpoint está funcionando", async () => {
      const res = await request(app).get("/cron")

      expect(res.status).toBe(200)
      expect(res.body).toEqual({
        message: "Cron endpoint is working",
      })
    })
  })

  describe("POST /cron/update-rachas", () => {
    it("deberia rechazar la request si no hay token", async () => {
      const res = await request(app).post("/cron/update-rachas")

      expect(res.status).toBe(401)
      expect(res.body.error).toBe("Unauthorized")
    })

    it("deberia rechazar la request si el token es inválido", async () => {
      const res = await request(app)
        .post("/cron/update-rachas")
        .set("Authorization", "Bearer wrong-token")

      expect(res.status).toBe(401)
      expect(res.body.error).toBe("Unauthorized")
    })

    it("deberia actualizar rachas correctamente con token válido", async () => {
      prisma.racha.updateMany.mockResolvedValue({ count: 5 })

      const res = await request(app)
        .post("/cron/update-rachas")
        .set("Authorization", "Bearer super-secret-cron")

      expect(res.status).toBe(200)
      expect(res.body).toEqual({
        message: "Rachas actualizadas correctamente",
      })

      expect(prisma.racha.updateMany).toHaveBeenCalledTimes(2)

      expect(prisma.racha.updateMany).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          where: {
            ultimaFecha: expect.any(Object),
          },
          data: {
            isInactive: true,
          },
        }),
      )

      expect(prisma.racha.updateMany).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          where: {
            ultimaFecha: expect.any(Object),
          },
          data: {
            rachaActual: 0,
            isInactive: true,
          },
        }),
      )
    })

    it("deberia manejar errores internos", async () => {
      prisma.racha.updateMany.mockRejectedValueOnce(new Error("DB exploded"))

      const res = await request(app)
        .post("/cron/update-rachas")
        .set("Authorization", "Bearer super-secret-cron")

      expect(res.status).toBe(500)
      expect(res.body.error).toBe("Error actualizando rachas")
    })
  })
})
