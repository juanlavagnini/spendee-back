const request = require("supertest")
const express = require("express")

jest.mock("@prisma/client", () => {
  const mPrisma = {
    oAuthCode: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    refreshToken: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  }

  return {
    PrismaClient: jest.fn(() => mPrisma),
  }
})

jest.mock("../middleware/validateToken", () =>
  jest.fn((req, res, next) => {
    req.user = { user_id: "user-test-123" }
    next()
  }),
)

jest.mock("../helpers/code", () => ({
  generateCode: jest.fn(() => "CODE123"),
  hashCode: jest.fn(() => "HASHED_CODE"),
}))

jest.mock("../helpers/refresh", () => ({
  generateRefreshToken: jest.fn(() => "REFRESH123"),
  hashRefreshToken: jest.fn(() => "HASHED_REFRESH"),
}))

jest.mock("jsonwebtoken", () => ({
  sign: jest.fn(() => "ACCESS_TOKEN"),
}))

jest.mock("fs", () => ({
  readFileSync: jest.fn(() => "PRIVATE_KEY"),
}))

const { PrismaClient } = require("@prisma/client")
const oauthRouter = require("../oauth/routes.js")

const prisma = new PrismaClient()

const app = express()
app.use(express.json())
app.use("/oauth", oauthRouter)

describe("OAuth routes", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("POST /oauth/code", () => {
    it("deberia generar un código OAuth y devuelve redirect", async () => {
      prisma.oAuthCode.create.mockResolvedValue({})

      const res = await request(app).post("/oauth/code")

      expect(res.status).toBe(200)
      expect(prisma.oAuthCode.create).toHaveBeenCalled()
      expect(res.body.redirect).toContain("code=CODE123")
    })

    it("deberia devolver 400 si no hay userId", async () => {
      require("../middleware/validateToken").mockImplementationOnce(
        (req, res, next) => {
          req.user = {}
          next()
        },
      )

      const res = await request(app).post("/oauth/code")

      expect(res.status).toBe(400)
    })
  })

  describe("POST /oauth/token", () => {
    it("deberia intercambiar código válido por access y refresh token", async () => {
      prisma.oAuthCode.findFirst.mockResolvedValue({
        id: 1,
        userId: "user-test-123",
        used: false,
        expiresAt: new Date(Date.now() + 10000),
      })

      prisma.oAuthCode.update.mockResolvedValue({})
      prisma.refreshToken.create.mockResolvedValue({})

      const res = await request(app)
        .post("/oauth/token")
        .send({ code: "CODE123" })

      expect(res.status).toBe(200)
      expect(res.body.access_token).toBe("ACCESS_TOKEN")
      expect(res.body.refresh_token).toBe("REFRESH123")
    })

    it("deberia rechazar código inexistente", async () => {
      prisma.oAuthCode.findFirst.mockResolvedValue(null)

      const res = await request(app)
        .post("/oauth/token")
        .send({ code: "INVALID" })

      expect(res.status).toBe(400)
    })

    it("deberia rechazar código usado", async () => {
      prisma.oAuthCode.findFirst.mockResolvedValue({
        used: true,
      })

      const res = await request(app)
        .post("/oauth/token")
        .send({ code: "CODE123" })

      expect(res.status).toBe(400)
    })

    it("deberia rechazar código expirado", async () => {
      prisma.oAuthCode.findFirst.mockResolvedValue({
        used: false,
        expiresAt: new Date(Date.now() - 1000),
      })

      const res = await request(app)
        .post("/oauth/token")
        .send({ code: "CODE123" })

      expect(res.status).toBe(400)
    })
  })

  describe("POST /oauth/refresh", () => {
    it("deberia renovar access y refresh token válidos", async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 1,
        userId: "user-test-123",
        revoked: false,
        expiresAt: new Date(Date.now() + 10000),
      })

      prisma.refreshToken.update.mockResolvedValue({})
      prisma.refreshToken.create.mockResolvedValue({})

      const res = await request(app)
        .post("/oauth/refresh")
        .send({ refresh_token: "REFRESH123" })

      expect(res.status).toBe(200)
      expect(res.body.access_token).toBe("ACCESS_TOKEN")
      expect(res.body.refresh_token).toBe("REFRESH123")
    })

    it("deberia rechazar refresh token inválido", async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(null)

      const res = await request(app)
        .post("/oauth/refresh")
        .send({ refresh_token: "INVALID" })

      expect(res.status).toBe(400)
    })

    it("deberia rechazar refresh token expirado", async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        expiresAt: new Date(Date.now() - 1000),
      })

      const res = await request(app)
        .post("/oauth/refresh")
        .send({ refresh_token: "REFRESH123" })

      expect(res.status).toBe(400)
    })

    it("deberia devolver 400 si falta refresh_token", async () => {
      const res = await request(app).post("/oauth/refresh").send({})
      expect(res.status).toBe(400)
    })
  })
})
