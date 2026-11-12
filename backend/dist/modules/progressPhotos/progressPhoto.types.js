export function toProgressPhotoDto(photo) {
    return {
        id: photo.id,
        takenAt: photo.takenAt.toISOString(),
    };
}
//# sourceMappingURL=progressPhoto.types.js.map