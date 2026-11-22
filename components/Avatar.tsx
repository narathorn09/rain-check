import { Mascot } from "./Mascot";

/** น้องฝน profile picture for chat bubbles and the chat header (styled by .avatar). */
export function Avatar() {
  return (
    <div className="avatar" aria-hidden="true">
      <Mascot size={34} still />
    </div>
  );
}
