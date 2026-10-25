export type PitchChannel = "email" | "form";

export type PitchFormField = {
  label: string;
  value: string;
};

export type PitchDraft = {
  siteName: string;
  channel: PitchChannel;
  to: string | null;
  subject: string;
  body: string;
  formFields: PitchFormField[];
};
