const PARTICIPANT_COLORS = [
  "#2563eb",
  "#16a34a",
  "#dc2626",
  "#9333ea",
  "#ea580c",
];

export const getParticipantColor = (name: string) => {
  const index = Array.from(name).reduce(
    (total, char) => total + char.charCodeAt(0),
    0,
  );

  return PARTICIPANT_COLORS[index % PARTICIPANT_COLORS.length];
};
