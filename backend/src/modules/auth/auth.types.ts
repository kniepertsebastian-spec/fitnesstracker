import type { User } from "@prisma/client";
import type { UserDto } from "@fitnesstracker/shared";

export function toUserDto(user: User): UserDto {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    firstName: user.firstName,
    lastName: user.lastName,
  };
}
