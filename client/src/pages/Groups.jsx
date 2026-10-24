import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { createGroup, joinGroup, listGroups } from "../services/api";

function Groups() {
  const navigate = useNavigate();
  const [groups, setGroups] = useState([]);
  const [name, setName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const loadGroups = async () => {
    const response = await listGroups();
    setGroups(response.data);
  };

  useEffect(() => {
    const run = async () => {
      try {
        await loadGroups();
      } catch {
        setError("Could not load groups");
      } finally {
        setLoading(false);
      }
    };

    run();
  }, []);

  const handleCreate = async (event) => {
    event.preventDefault();
    setError("");

    try {
      const response = await createGroup({ name });
      setName("");
      navigate(`/groups/${response.data._id}`);
    } catch (err) {
      setError(err.response?.data?.message || "Could not create group");
    }
  };

  const handleJoin = async (event) => {
    event.preventDefault();
    setError("");

    try {
      const response = await joinGroup({ inviteCode });
      setInviteCode("");
      navigate(`/groups/${response.data._id}`);
    } catch (err) {
      setError(err.response?.data?.message || "Could not join group");
    }
  };

  return (
    <div>
      <Navbar />
      <main className="page">
        <div className="page-head">
          <div>
            <p className="eyebrow">Your groups</p>
            <h1>Where the money lives</h1>
          </div>
        </div>

        {error && <p className="error">{error}</p>}

        <div className="two-col">
          <form className="paper-card" onSubmit={handleCreate}>
            <h2>New group</h2>
            <label>
              Name
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Goa trip, Flat 4B, Hackathon"
                required
              />
            </label>
            <button type="submit" className="btn-primary">
              Create group
            </button>
          </form>

          <form className="paper-card" onSubmit={handleJoin}>
            <h2>Join with a code</h2>
            <label>
              Invite code
              <input
                type="text"
                value={inviteCode}
                onChange={(event) => setInviteCode(event.target.value.toUpperCase())}
                placeholder="A1B2C3"
                required
              />
            </label>
            <button type="submit" className="btn-secondary">
              Join group
            </button>
          </form>
        </div>

        {loading ? (
          <p className="muted">Loading groups...</p>
        ) : groups.length === 0 ? (
          <p className="muted">No groups yet. Create one or join with a code.</p>
        ) : (
          <ul className="group-list">
            {groups.map((group) => (
              <li key={group._id}>
                <Link to={`/groups/${group._id}`} className="group-row">
                  <div>
                    <strong>{group.name}</strong>
                    <p>{group.members.length} people · code {group.inviteCode}</p>
                  </div>
                  <span>Open →</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

export default Groups;
