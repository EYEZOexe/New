export function shouldDeleteMirroredSignalRow(args: {
  lastMirroredAt: number;
  deletedAt?: number;
  cutoffMs: number;
}): boolean {
  if (typeof args.deletedAt === "number") {
    return args.deletedAt <= args.cutoffMs;
  }

  return false;
}
