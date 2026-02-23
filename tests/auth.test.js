const request = require("supertest")
const express = require("express")
const authRouter = require("../routes/auth")
const { PrismaClient } = require("@prisma/client")

// Mock Prisma
jest.mock("@prisma/client", () => {
  const mPrisma = {
    usuario: {
      findFirst: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
  }
  return { PrismaClient: jest.fn(() => mPrisma) }
})

// App setup
const app = express()
app.use(express.json())
app.use("/auth", authRouter)

const prisma = new PrismaClient()

describe("Auth Routes", () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.clearAllMocks()
    jest.resetModules()
    process.env = { ...originalEnv }
    process.env.FIREBASE_API_KEY = "dummy_firebase_key"
    process.env.GOOGLE_CLIENT_ID = "dummy_google_id"
    process.env.GOOGLE_CLIENT_SECRET = "dummy_google_secret"
    
    // Mock global fetch
    global.fetch = jest.fn()
  })

  afterAll(() => {
    process.env = originalEnv
  })

  describe("POST /auth/login", () => {
    it("should return 400 if email or password is missing", async () => {
      const res = await request(app).post("/auth/login").send({})
      expect(res.status).toBe(400)
      expect(res.body.error).toBe("Missing email or password")
    })

    it("should return 500 if FIREBASE_API_KEY is missing", async () => {
      delete process.env.FIREBASE_API_KEY
      const res = await request(app)
        .post("/auth/login")
        .send({ email: "test@test.com", password: "pass" })
      expect(res.status).toBe(500)
      expect(res.body.error).toContain("FIREBASE_API_KEY missing")
    })

    it("should login successfully and update existing user", async () => {
      // Mock Firebase response
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          idToken: "token123",
          refreshToken: "refresh123",
          expiresIn: "3600",
          localId: "uid123",
          displayName: "Test User",
        }),
      })

      // Mock Prisma finds existing user
      prisma.usuario.findFirst.mockResolvedValue({
        id: "uid123",
        nombre: "Old Name",
        email: "test@test.com",
      })
      prisma.usuario.update.mockResolvedValue({
        id: "uid123",
        nombre: "Test User",
        email: "test@test.com",
      })

      const res = await request(app)
        .post("/auth/login")
        .send({ email: "test@test.com", password: "pass" })

      expect(res.status).toBe(200)
      expect(prisma.usuario.update).toHaveBeenCalled()
      expect(res.body.usuario.nombre).toBe("Test User")
    })

    it("should login successfully and create new user", async () => {
      // Mock Firebase response
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          idToken: "token123",
          refreshToken: "refresh123",
          expiresIn: "3600",
          localId: "uidNew",
          displayName: "New User",
        }),
      })

      // Mock Prisma does not find user
      prisma.usuario.findFirst.mockResolvedValue(null)
      prisma.usuario.create.mockResolvedValue({
        id: "uidNew",
        nombre: "New User",
        email: "new@test.com",
      })

      const res = await request(app)
        .post("/auth/login")
        .send({ email: "new@test.com", password: "pass" })

      expect(res.status).toBe(200)
      expect(prisma.usuario.create).toHaveBeenCalled()
    })

    it("should handle Firebase authentication failures", async () => {
        global.fetch.mockResolvedValue({
            ok: false,
            json: async () => ({
                error: { message: "INVALID_PASSWORD" }
            })
        })

        const res = await request(app)
            .post("/auth/login")
            .send({ email: "test@test.com", password: "wrong" })
        
        expect(res.status).toBe(401)
        expect(res.body.error).toBe("INVALID_PASSWORD")
    })
  })

  describe("POST /auth/refresh", () => {
      it("should return 400 if refreshToken is missing", async () => {
          const res = await request(app).post("/auth/refresh").send({})
          expect(res.status).toBe(400)
          expect(res.body.error).toContain("Missing refreshToken")
      })

      it("should refresh firebase token", async () => {
          global.fetch.mockResolvedValue({
              ok: true,
              json: async () => ({
                  access_token: "newAccess",
                  expires_in: "3600"
              })
          })
          
          const res = await request(app)
            .post("/auth/refresh")
            .send({ provider: "firebase", refreshToken: "oldRefresh" })
        
          expect(res.status).toBe(200)
          expect(res.body.access_token).toBe("newAccess")
          expect(global.fetch).toHaveBeenCalledWith(
              expect.stringContaining("googleapis.com/v1/token"),
              expect.anything()
          )
      })

      it("should refresh google token", async () => {
        global.fetch.mockResolvedValue({
            ok: true,
            json: async () => ({
                access_token: "newAccessGoogle",
                expires_in: "3600"
            })
        })
        
        const res = await request(app)
          .post("/auth/refresh")
          .send({ provider: "google", refreshToken: "oldRefresh" })
      
        expect(res.status).toBe(200)
        expect(res.body.access_token).toBe("newAccessGoogle")
        expect(global.fetch).toHaveBeenCalledWith(
            expect.stringContaining("oauth2.googleapis.com/token"),
            expect.anything()
        )
    })
  })

  describe("GET /auth/oauth/google", () => {
      it("should redirect to google consent screen", async () => {
          const res = await request(app).get("/auth/oauth/google?redirect_uri=http://localhost:3000")
          expect(res.status).toBe(302)
          expect(res.header.location).toContain("accounts.google.com")
          expect(res.header.location).toContain("client_id=dummy_google_id")
      })
  })
})
