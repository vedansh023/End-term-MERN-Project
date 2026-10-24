import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { createGroup, joinGroup, listGroups } from "../services/api";

function Groups() {
  const navigate = useNavigate();
  const [groups, setGroups] = useState([]);
  const [name, setName] = useState("");
  const [budget, setBudget] = useState("");
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
      const response = await createGroup({ name, budget });
      setName("");
      setBudget("");
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

  const activeGroups = groups.filter((g) => !g.isArchived);
  const archivedGroups = groups.filter((g) => g.isArchived);

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
            <label>
              Trip budget (₹, optional)
              <input
                type="number"
                min="0"
                step="1"
                value={budget}
                onChange={(event) => setBudget(event.target.value)}
                placeholder="e.g. 25000"
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
          <div>
            <h2 style={{ fontSize: 18, marginBottom: 12 }}>Active groups</h2>
            {activeGroups.length === 0 ? (
              <p className="muted" style={{ marginBottom: 20 }}>No active groups.</p>
            ) : (
              <ul className="group-list" style={{ marginBottom: 24 }}>
                {activeGroups.map((group) => (
                  <li key={group._id}>
                    <Link to={`/groups/${group._id}`} className="group-row">
                      <div>
                        <strong>{group.name}</strong>
                        <p>
                          {group.members.length} people · code {group.inviteCode}
                          {group.budget > 0 && ` · Budget ₹${(group.budget / 100).toLocaleString("en-IN")}`}
                        </p>
                      </div>
                      <span>Open →</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}

            {archivedGroups.length > 0 && (
              <div>
                <h2 style={{ fontSize: 18, marginBottom: 12, color: "var(--muted)" }}>
                  Archived groups
                </h2>
                <ul className="group-list">
                  {archivedGroups.map((group) => (
                    <li key={group._id}>
                      <Link
                        to={`/groups/${group._id}`}
                        className="group-row"
                        style={{ opacity: 0.75 }}
                      >
                        <div>
                          <strong>{group.name} (Archived)</strong>
                          <p>{group.members.length} people · code {group.inviteCode}</p>
                        </div>
                        <span>View →</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default Groups;
