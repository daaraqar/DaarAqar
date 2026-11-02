import { ChatMessage } from "../db/types";

export interface DisplayMessage extends ChatMessage {
  isPending?: boolean;
  sendStatus?: "sending" | "sent" | "failed";
  sendError?: string;
  clientTempId?: string;
  asAdminNote?: boolean;
  asInternalNote?: boolean;
}

export const MAX_REALTIME_RECONNECT_ATTEMPTS = 5;

export function computeReconnectDelayMs(
  attempt: number,
  baseMs = 2000,
  maxMs = 30000
): number {
  const safeAttempt = Math.max(1, Math.min(attempt, 10));
  return Math.min(maxMs, baseMs * Math.pow(2, safeAttempt - 1));
}

/**
 * Deterministic message deduplication, optimistic/pending reconciliation,
 * conversation-boundary isolation, and ascending timestamp sorting with ID tie-breaking.
 */
export function mergeMessages(
  current: DisplayMessage[],
  incoming: (ChatMessage | DisplayMessage)[],
  targetInquiryId?: string
): DisplayMessage[] {
  const map = new Map<string, DisplayMessage>();

  current.forEach((msg) => {
    if (!msg || !msg.id || msg.id.endsWith("-initial")) return;
    if (
      targetInquiryId &&
      msg.inquiryId &&
      msg.inquiryId !== targetInquiryId
    ) {
      return;
    }
    map.set(msg.id, msg);
  });

  incoming.forEach((rawMsg) => {
    const msg = rawMsg as DisplayMessage;
    if (!msg || !msg.id || msg.id.endsWith("-initial")) return;
    if (
      targetInquiryId &&
      msg.inquiryId &&
      msg.inquiryId !== targetInquiryId
    ) {
      return;
    }

    const isIncomingTemp = msg.id.startsWith("temp-");
    let matchingKeyToReplace: string | null = null;

    map.forEach((val, key) => {
      if (matchingKeyToReplace) return;

      // 1. Exact clientTempId correlation (from POST response or retry)
      if (
        !isIncomingTemp &&
        msg.clientTempId &&
        (key === msg.clientTempId || val.clientTempId === msg.clientTempId)
      ) {
        matchingKeyToReplace = key;
        return;
      }

      const sameContent =
        String(val.content || "").trim() === String(msg.content || "").trim();
      if (!sameContent) return;

      const timeDiff = Math.abs(
        new Date(val.createdAt || 0).getTime() -
          new Date(msg.createdAt || 0).getTime()
      );

      // 2. Replace optimistic pending/sending/failed message when canonical DB message arrives
      if (
        !isIncomingTemp &&
        (val.isPending ||
          val.sendStatus === "sending" ||
          val.sendStatus === "failed" ||
          key.startsWith("temp-")) &&
        timeDiff < 60000
      ) {
        matchingKeyToReplace = key;
        return;
      }

      // 3. Replace non-UUID local message ID if canonical message with same role/content arrives within 20s
      if (
        !isIncomingTemp &&
        key !== msg.id &&
        key.startsWith("msg-") &&
        val.senderRole === msg.senderRole &&
        timeDiff < 20000
      ) {
        matchingKeyToReplace = key;
      }
    });

    if (matchingKeyToReplace) {
      const prev = map.get(matchingKeyToReplace);
      map.delete(matchingKeyToReplace);
      map.set(msg.id, {
        ...prev,
        ...msg,
        isRead: Boolean(prev?.isRead || msg.isRead),
        isPending: false,
        sendStatus: "sent",
        sendError: undefined,
      });
    } else {
      const existing = map.get(msg.id);
      if (existing) {
        map.set(msg.id, {
          ...existing,
          ...msg,
          isRead: Boolean(existing.isRead || msg.isRead),
          isPending: Boolean(msg.isPending && existing.isPending),
          sendStatus:
            msg.sendStatus ||
            (existing.sendStatus === "sent" ? "sent" : msg.isPending ? "sending" : "sent"),
          sendError: msg.sendError,
        });
      } else {
        map.set(msg.id, {
          ...msg,
          isRead: Boolean(msg.isRead),
          isPending: Boolean(msg.isPending),
          sendStatus:
            msg.sendStatus || (msg.isPending ? "sending" : "sent"),
        });
      }
    }
  });

  return Array.from(map.values()).sort((a, b) => {
    const timeA = new Date(a.createdAt || (a as any).created_at || 0).getTime();
    const timeB = new Date(b.createdAt || (b as any).created_at || 0).getTime();
    if (timeA !== timeB) {
      return timeA - timeB;
    }
    return String(a.id || "").localeCompare(String(b.id || ""));
  });
}

/**
 * Retains an optimistic message in the UI on send failure and marks it as failed
 * so the user never loses their message text and can explicitly retry without duplication.
 */
export function markOptimisticMessageFailed(
  current: DisplayMessage[],
  tempId: string,
  errorMessage: string
): DisplayMessage[] {
  return current.map((msg) =>
    msg.id === tempId || msg.clientTempId === tempId
      ? {
          ...msg,
          isPending: false,
          sendStatus: "failed",
          sendError: errorMessage,
        }
      : msg
  );
}

/**
 * Transitions a previously failed optimistic message back to sending state for idempotent retry.
 */
export function markOptimisticMessageSending(
  current: DisplayMessage[],
  tempId: string
): DisplayMessage[] {
  return current.map((msg) =>
    msg.id === tempId || msg.clientTempId === tempId
      ? {
          ...msg,
          isPending: true,
          sendStatus: "sending",
          sendError: undefined,
        }
      : msg
  );
}
