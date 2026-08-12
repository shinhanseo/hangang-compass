export type ExperienceTag =
  | "picnic"
  | "nature"
  | "culture"
  | "fountain"
  | "sports"
  | "cycling"
  | "water_leisure"
  | "family"
  | "events";

export interface ParkExperience {
  parkId: string;
  summary: string;
  highlights: string[];
  cautions: string[];
  signatureTags: ExperienceTag[];
  sourceUrl: string;
  verifiedAt: string;
  verificationStatus: "official_web_confirmed";
}
