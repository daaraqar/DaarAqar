export interface InquiryLastMessage {
  senderId: string | null;
  senderRole?: string;
  createdAt: string;
}

export interface InquiryResponseState {
  waitingForAdvertiser: boolean;
  waitingSince: string | null;
  responseOverdue: boolean;
}

export function getInquiryResponseState(
  inquiry: {
    status: string;
    seekerId: string;
    createdAt: string;
    latestMessage?: InquiryLastMessage | null;
  },
  now = Date.now()
): InquiryResponseState {
  const terminalStatus = ["deal_closed", "closed", "spam"].includes(inquiry.status);
  const latestSenderIsSeeker = Boolean(
    inquiry.latestMessage &&
    (inquiry.latestMessage.senderId === inquiry.seekerId ||
      ["buyer", "seeker"].includes(inquiry.latestMessage.senderRole || ""))
  );
  const waitingForAdvertiser = terminalStatus
    ? false
    : latestSenderIsSeeker || (!inquiry.latestMessage && inquiry.status === "new");
  const waitingSince = waitingForAdvertiser
    ? inquiry.latestMessage?.createdAt || inquiry.createdAt
    : null;
  const waitingSinceTime = waitingSince ? new Date(waitingSince).getTime() : Number.NaN;

  return {
    waitingForAdvertiser,
    waitingSince,
    responseOverdue: Number.isFinite(waitingSinceTime) && now - waitingSinceTime >= 24 * 60 * 60 * 1000,
  };
}
