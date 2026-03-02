export type SignalAttachmentRef = {
  attachmentId?: string;
  url: string;
  storageId?: string;
  mirrorUrl?: string;
  name?: string;
  contentType?: string;
  size?: number;
};

export function resolveAttachmentsForExistingSignalPatch(args: {
  eventType: "create" | "update" | "delete";
  incomingAttachments: SignalAttachmentRef[];
  existingAttachments:
    | SignalAttachmentRef[]
    | undefined
    | null;
}): {
  attachments: SignalAttachmentRef[] | undefined;
  preservedExisting: boolean;
} {
  if (args.eventType === "delete") {
    if (args.incomingAttachments.length > 0) {
      return { attachments: args.incomingAttachments, preservedExisting: false };
    }
    return { attachments: undefined, preservedExisting: false };
  }

  if (args.incomingAttachments.length > 0) {
    const existingByKey = new Map(
      (Array.isArray(args.existingAttachments) ? args.existingAttachments : [])
        .map((attachment) => {
          const key = attachment.attachmentId?.trim() || attachment.url.trim();
          return key ? [key, attachment] : null;
        })
        .filter((entry): entry is [string, SignalAttachmentRef] => entry !== null),
    );
    const merged = args.incomingAttachments.map((attachment) => {
      const key = attachment.attachmentId?.trim() || attachment.url.trim();
      const existing = key ? existingByKey.get(key) : undefined;
      if (!existing) return attachment;
      return {
        ...attachment,
        ...(attachment.storageId ? {} : existing.storageId ? { storageId: existing.storageId } : {}),
        ...(attachment.mirrorUrl ? {} : existing.mirrorUrl ? { mirrorUrl: existing.mirrorUrl } : {}),
      };
    });
    return { attachments: merged, preservedExisting: false };
  }

  const existingAttachments = Array.isArray(args.existingAttachments)
    ? args.existingAttachments
    : [];

  if (existingAttachments.length > 0) {
    return { attachments: existingAttachments, preservedExisting: true };
  }

  return { attachments: args.incomingAttachments, preservedExisting: false };
}
