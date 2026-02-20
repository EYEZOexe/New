type SignalAttachmentRef = {
  attachmentId?: string;
  url: string;
  name?: string;
  contentType?: string;
  size?: number;
};

export function resolveContentForExistingSignalPatch(args: {
  eventType: "create" | "update" | "delete";
  incomingContent: string;
  incomingAttachments: SignalAttachmentRef[];
  existingContent: string;
}): { content: string; preservedExisting: boolean } {
  if (
    args.eventType === "update" &&
    args.incomingContent.length === 0 &&
    args.incomingAttachments.length > 0 &&
    args.existingContent.length > 0
  ) {
    return {
      content: args.existingContent,
      preservedExisting: true,
    };
  }

  return {
    content: args.incomingContent,
    preservedExisting: false,
  };
}
