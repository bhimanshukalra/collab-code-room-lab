import type { Participant } from "./types";

type ParticipantsListProps = {
  participants: Participant[];
};

export function ParticipantsList({ participants }: ParticipantsListProps) {
  if (participants.length === 0) {
    return <p>No participants yet.</p>;
  }

  return (
    <ul className="flex flex-col gap-1">
      {participants.map((participant) => (
        <li key={participant.id}>
          <span>{participant.name}</span>
          <span className="text-gray-500"> ({participant.id.slice(0, 6)})</span>
        </li>
      ))}
    </ul>
  );
}
