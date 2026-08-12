export interface Participant {
  id: string;
  alias: string;
  role?: "host" | "guest";
  capabilityTokenHash?: string;
  origin: {
    placeId: string;
    placeName: string;
  };
  destination?: {
    placeId: string;
    placeName: string;
  } | null;
}

export interface MeetingPoll {
  round: number;
  status: "open" | "tied" | "completed";
  candidateParkIds: string[];
  candidateLabels: Array<{ parkId: string; parkName: string; recommended: boolean }>;
  votes: Array<{ participantId: string; parkId: string }>;
  winnerParkId: string | null;
  resolution: "vote" | "random" | null;
}

export type TravelPattern = "shared_origin" | "individual_round_trip";

export interface Meeting {
  id: string;
  createdAt: string;
  meetingAt: string;
  travelPattern: TravelPattern;
  sharedOrigin: {
    placeId: string;
    placeName: string;
  } | null;
  inviteTokenHashes: string[];
  hostTokenHashes: string[];
  participants: Participant[];
  confirmedParkId: string | null;
  poll?: MeetingPoll | null;
}
