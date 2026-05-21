import { useState, type FormEvent } from "react";
import type { JoinedRoom } from "./types";

type JoinRoomFormProps = {
  onJoinRoom: (room: JoinedRoom) => void;
};

export function JoinRoomForm({ onJoinRoom }: JoinRoomFormProps) {
  const [roomId, setRoomId] = useState("");
  const [name, setName] = useState("");

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextRoomId = roomId.trim();
    const nextName = name.trim();

    if (!nextRoomId || !nextName) {
      return;
    }

    onJoinRoom({ roomId: nextRoomId, name: nextName });
  };

  return (
    <form className="flex gap-2" onSubmit={handleSubmit}>
      <input
        className="border px-2 py-1"
        onChange={(event) => setRoomId(event.target.value)}
        placeholder="Room ID"
        type="text"
        value={roomId}
      />
      <input
        className="border px-2 py-1"
        onChange={(event) => setName(event.target.value)}
        placeholder="Display name"
        type="text"
        value={name}
      />
      <button className="border px-2 py-1" type="submit">
        Join
      </button>
    </form>
  );
}
