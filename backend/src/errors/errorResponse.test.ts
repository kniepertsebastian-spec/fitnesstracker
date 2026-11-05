import { describe, expect, it } from "vitest";
import { toErrorResponse } from "./errorResponse.js";
import { BadRequestError, HttpError } from "./httpErrors.js";

describe("toErrorResponse", () => {
  it("keeps the message of our own errors, also for 5xx", () => {
    expect(toErrorResponse(new BadRequestError("Ungültige Eingabe"))).toEqual({ statusCode: 400, message: "Ungültige Eingabe" });
    expect(toErrorResponse(new HttpError(502, "Gemini nicht erreichbar"))).toEqual({ statusCode: 502, message: "Gemini nicht erreichbar" });
  });

  it("keeps the message of framework client errors (4xx)", () => {
    expect(toErrorResponse({ statusCode: 413, message: "Request body is too large" })).toEqual({
      statusCode: 413,
      message: "Request body is too large",
    });
  });

  it("hides the message of unexpected failures", () => {
    const prismaLike = new Error('Invalid `prisma.user.findUnique()` invocation: column "passwordHash" does not exist');
    expect(toErrorResponse(prismaLike)).toEqual({ statusCode: 500, message: "Internal error" });
    expect(toErrorResponse({ statusCode: 503, message: "connect ECONNREFUSED 10.0.0.5:5432" })).toEqual({
      statusCode: 503,
      message: "Internal error",
    });
  });
});
