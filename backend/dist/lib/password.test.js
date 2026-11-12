import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password.js";
describe("password hashing", () => {
    it("verifies the right password and rejects a wrong one", async () => {
        const hash = await hashPassword("correct horse battery staple");
        expect(hash).toMatch(/^\$2[aby]\$12\$/);
        expect(await verifyPassword("correct horse battery staple", hash)).toBe(true);
        expect(await verifyPassword("Correct horse battery staple", hash)).toBe(false);
    });
    it("still verifies a hash in the classic $2a$ format (known vector from the crypt_blowfish test suite)", async () => {
        // Hashes stored by earlier bcrypt versions must keep working after an upgrade of the library.
        const knownVector = "$2a$05$CCCCCCCCCCCCCCCCCCCCC.E5YPO9kmyuRGyh0XouQYb4YMJKvyOeW";
        expect(await verifyPassword("U*U", knownVector)).toBe(true);
        expect(await verifyPassword("U*V", knownVector)).toBe(false);
    });
});
//# sourceMappingURL=password.test.js.map