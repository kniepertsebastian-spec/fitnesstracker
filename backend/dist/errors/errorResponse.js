import { HttpError } from "./httpErrors.js";
/**
 * What the client may learn about an error. Our own `HttpError`s carry a deliberately worded
 * message (also for 5xx, e.g. "Bildverarbeitung derzeit nicht verfügbar" or an AI provider
 * failure) and Fastify's own client errors (4xx: body too large, malformed JSON, rate limit) are
 * safe too. Anything else that ends up as a 5xx is an unexpected failure: its message can carry
 * internals (Prisma errors name tables, columns and query fragments), so the client only gets a
 * generic text; the details stay in the server log.
 */
export function toErrorResponse(error) {
    const statusCode = error.statusCode ?? 500;
    if (error instanceof HttpError || statusCode < 500) {
        return { statusCode, message: error.message || "Request failed" };
    }
    return { statusCode, message: "Internal error" };
}
//# sourceMappingURL=errorResponse.js.map