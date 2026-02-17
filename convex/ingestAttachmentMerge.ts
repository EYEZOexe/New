export type SignalAttachmentRef = {
  attachmentId?: string;
  url: string;
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
    return { attachments: args.incomingAttachments, preservedExisting: false };
  }

  const existingAttachments = Array.isArray(args.existingAttachments)
    ? args.existingAttachments
    : [];

  if (existingAttachments.length > 0) {
    return { attachments: existingAttachments, preservedExisting: true };
  }

  return { attachments: args.incomingAttachments, preservedExisting: false };
}
