"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { Id } from "@convex/_generated/dataModel";
import { useState, useRef, useCallback, useEffect } from "react";

type Task = {
  _id: Id<"tasks">;
  _creationTime: number;
  title: string;
  description?: string;
  notes?: string;
  status: "backlog" | "queued" | "done";
  priority?: number;
  completedAt?: number;
  createdAt: number;
};

type MobileTab = "queue" | "backlog" | "done";

function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

function formatAge(createdAt: number, now: number): string {
  const diff = now - createdAt;
  const mins = Math.floor(diff / 60_000);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  const weeks = Math.floor(days / 7);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  if (hrs < 24) return `${hrs}h ${mins % 60}m`;
  if (days < 7) return `${days}d ${hrs % 24}h`;
  if (days < 30) return `${weeks}w ${days % 7}d`;
  const months = Math.floor(days / 30);
  return `${months}mo ${days % 30}d`;
}

function ageColor(createdAt: number, now: number): string {
  const days = (now - createdAt) / 86_400_000;
  if (days < 1) return "text-leaf-400";
  if (days < 3) return "text-earth-400";
  if (days < 7) return "text-gold-400";
  if (days < 14) return "text-gold-500";
  return "text-berry-400";
}

function useAuth() {
  const [password, setPassword] = useState<string | null>(null);
  const [isAuthed, setIsAuthed] = useState(false);
  const [checking, setChecking] = useState(true);
  const verify = useMutation(api.tasks.verifyPassword);

  useEffect(() => {
    const stored = localStorage.getItem("farm-tasks-pw");
    if (stored) {
      setPassword(stored);
      verify({ password: stored })
        .then(() => setIsAuthed(true))
        .catch(() => {
          localStorage.removeItem("farm-tasks-pw");
          setPassword(null);
        })
        .finally(() => setChecking(false));
    } else {
      setChecking(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const login = async (pw: string) => {
    await verify({ password: pw });
    localStorage.setItem("farm-tasks-pw", pw);
    setPassword(pw);
    setIsAuthed(true);
  };

  const logout = () => {
    localStorage.removeItem("farm-tasks-pw");
    setPassword(null);
    setIsAuthed(false);
  };

  return { password: password ?? "", isAuthed, checking, login, logout };
}

// ── Shared task row for queue items ──
function QueueTaskRow({
  task,
  index,
  total,
  isAuthed,
  password,
  now,
  expandedId,
  editingId,
  editTitle,
  editNotes,
  onToggleExpand,
  onStartEdit,
  onEditTitleChange,
  onSaveTitle,
  onCancelEdit,
  onEditNotesChange,
  onSaveNotes,
  onMarkDone,
  onMoveUp,
  onMoveDown,
  onMoveToBacklog,
  onRemove,
}: {
  task: Task;
  index: number;
  total: number;
  isAuthed: boolean;
  password: string;
  now: number;
  expandedId: Id<"tasks"> | null;
  editingId: Id<"tasks"> | null;
  editTitle: string;
  editNotes: string;
  onToggleExpand: (t: Task) => void;
  onStartEdit: (t: Task) => void;
  onEditTitleChange: (v: string) => void;
  onSaveTitle: () => void;
  onCancelEdit: () => void;
  onEditNotesChange: (v: string) => void;
  onSaveNotes: (id: Id<"tasks">, notes: string) => void;
  onMarkDone: (id: Id<"tasks">) => void;
  onMoveUp: (i: number) => void;
  onMoveDown: (i: number) => void;
  onMoveToBacklog: (id: Id<"tasks">) => void;
  onRemove: (id: Id<"tasks">) => void;
}) {
  const isExpanded = expandedId === task._id;
  const isEditing = editingId === task._id;
  const isFirst = index === 0;

  return (
    <div>
      <div
        className={`group flex items-center gap-2 px-3 py-2.5 transition-all cursor-pointer ${
          isFirst
            ? "pixel-border-gold bg-earth-800"
            : "pixel-border bg-earth-900 hover:bg-earth-800"
        }`}
        onClick={() => onToggleExpand(task)}
      >
        <span
          className={`font-[family-name:var(--font-pixel)] text-[8px] w-5 text-center shrink-0 leading-relaxed ${
            isFirst ? "text-gold-400" : "text-earth-600"
          }`}
        >
          {index + 1}
        </span>

        {isAuthed && (
          <button
            onClick={(e) => { e.stopPropagation(); onMarkDone(task._id); }}
            className={`w-5 h-5 md:w-4 md:h-4 shrink-0 border-2 transition-colors ${
              isFirst
                ? "border-gold-500 hover:bg-leaf-500 hover:border-leaf-500"
                : "border-earth-600 hover:bg-leaf-600 hover:border-leaf-600"
            }`}
            title="Ship it!"
          />
        )}

        {isEditing ? (
          <input
            type="text"
            value={editTitle}
            onChange={(e) => onEditTitleChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onSaveTitle();
              if (e.key === "Escape") onCancelEdit();
            }}
            onBlur={onSaveTitle}
            onClick={(e) => e.stopPropagation()}
            autoFocus
            className="flex-1 min-w-0 pixel-inset bg-earth-900 px-2 py-0.5 text-sm text-earth-200 focus:outline-none"
          />
        ) : (
          <span
            className={`flex-1 text-sm truncate min-w-0 ${
              isFirst ? "text-earth-100" : "text-earth-300"
            }`}
            onDoubleClick={(e) => { e.stopPropagation(); onStartEdit(task); }}
          >
            {task.title}
            {task.notes && (
              <span className="text-earth-600 text-[10px] ml-1 hidden sm:inline">[notes]</span>
            )}
          </span>
        )}

        <span
          className={`font-[family-name:var(--font-pixel)] text-[7px] shrink-0 leading-relaxed ${ageColor(task.createdAt, now)}`}
        >
          {formatAge(task.createdAt, now)}
        </span>

        <span className={`text-earth-600 text-xs shrink-0 transition-transform ${isExpanded ? "rotate-90" : ""}`}>
          &#9654;
        </span>

        {isAuthed && (
          <div
            className="flex items-center gap-1 shrink-0 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
            onClick={(e) => e.stopPropagation()}
          >
            <button onClick={() => onMoveUp(index)} disabled={isFirst}
              className="text-earth-500 hover:text-gold-400 disabled:opacity-20 p-1 text-xs">&#9650;</button>
            <button onClick={() => onMoveDown(index)} disabled={index === total - 1}
              className="text-earth-500 hover:text-gold-400 disabled:opacity-20 p-1 text-xs">&#9660;</button>
            <button onClick={() => onMoveToBacklog(task._id)}
              className="text-[10px] text-earth-600 hover:text-earth-400 px-1 hidden sm:inline">stash</button>
            <button onClick={() => onRemove(task._id)}
              className="text-[10px] text-earth-600 hover:text-berry-400 p-1">&#10005;</button>
          </div>
        )}
      </div>

      {isExpanded && (
        <NotesPanel
          task={task}
          isAuthed={isAuthed}
          editNotes={editNotes}
          onEditNotesChange={onEditNotesChange}
          onSaveNotes={onSaveNotes}
          onClose={() => onToggleExpand(task)}
        />
      )}
    </div>
  );
}

// ── Shared notes panel ──
function NotesPanel({
  task,
  isAuthed,
  editNotes,
  onEditNotesChange,
  onSaveNotes,
  onClose,
}: {
  task: Task;
  isAuthed: boolean;
  editNotes: string;
  onEditNotesChange: (v: string) => void;
  onSaveNotes: (id: Id<"tasks">, notes: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="pixel-inset bg-earth-950 mx-1 sm:mx-2 mt-0 p-3">
      <label className="font-[family-name:var(--font-pixel)] text-[7px] text-earth-500 block mb-2 leading-relaxed">
        Notes:
      </label>
      {isAuthed ? (
        <>
          <textarea
            value={editNotes}
            onChange={(e) => onEditNotesChange(e.target.value)}
            onBlur={() => onSaveNotes(task._id, editNotes)}
            placeholder="Write notes here..."
            rows={3}
            className="w-full bg-earth-900 text-sm text-earth-200 placeholder:text-earth-700 p-2 pixel-inset focus:outline-none resize-y"
          />
          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={() => { onSaveNotes(task._id, editNotes); onClose(); }}
              className="pixel-border bg-earth-800 px-2 py-0.5 font-[family-name:var(--font-pixel)] text-[7px] text-leaf-400 hover:text-leaf-300 leading-relaxed"
            >
              Save
            </button>
            <span className="text-[10px] text-earth-700 hidden sm:inline">(auto-saves on blur)</span>
          </div>
        </>
      ) : (
        <p className="text-sm text-earth-500 whitespace-pre-wrap">{task.notes || "No notes."}</p>
      )}
    </div>
  );
}

// ── Main ──
export default function Home() {
  const allTasks = useQuery(api.tasks.list, {});
  const createTask = useMutation(api.tasks.create);
  const markDone = useMutation(api.tasks.markDone);
  const moveToQueue = useMutation(api.tasks.moveToQueue);
  const moveToBacklog = useMutation(api.tasks.moveToBacklog);
  const reorder = useMutation(api.tasks.reorder);
  const removeTask = useMutation(api.tasks.remove);
  const updateTask = useMutation(api.tasks.update);

  const { password, isAuthed, checking, login, logout } = useAuth();
  const now = useNow();
  const [mobileTab, setMobileTab] = useState<MobileTab>("queue");
  const [newTitle, setNewTitle] = useState("");
  const [expandedId, setExpandedId] = useState<Id<"tasks"> | null>(null);
  const [editingId, setEditingId] = useState<Id<"tasks"> | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [loginInput, setLoginInput] = useState("");
  const [loginError, setLoginError] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const doneTasks = (allTasks ?? [])
    .filter((t) => t.status === "done")
    .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0));

  const queuedTasks = (allTasks ?? [])
    .filter((t) => t.status === "queued")
    .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));

  const backlogTasks = (allTasks ?? [])
    .filter((t) => t.status === "backlog")
    .sort((a, b) => b.createdAt - a.createdAt);

  const handleCreate = async () => {
    if (!isAuthed) return;
    const title = newTitle.trim();
    if (!title) return;
    await createTask({ password, title, status: "backlog" });
    setNewTitle("");
    inputRef.current?.focus();
  };

  const handleMoveUp = useCallback(
    async (index: number) => {
      if (!isAuthed || index === 0) return;
      const ids = queuedTasks.map((t) => t._id);
      [ids[index - 1], ids[index]] = [ids[index], ids[index - 1]];
      await reorder({ password, taskIds: ids });
    },
    [queuedTasks, reorder, password, isAuthed]
  );

  const handleMoveDown = useCallback(
    async (index: number) => {
      if (!isAuthed || index === queuedTasks.length - 1) return;
      const ids = queuedTasks.map((t) => t._id);
      [ids[index], ids[index + 1]] = [ids[index + 1], ids[index]];
      await reorder({ password, taskIds: ids });
    },
    [queuedTasks, reorder, password, isAuthed]
  );

  const toggleExpand = (task: Task) => {
    if (expandedId === task._id) {
      setExpandedId(null);
      setEditingId(null);
    } else {
      setExpandedId(task._id);
      setEditNotes(task.notes ?? "");
    }
  };

  const startEditTitle = (task: Task) => {
    if (!isAuthed) return;
    setEditingId(task._id);
    setEditTitle(task.title);
  };

  const saveTitle = async () => {
    if (editingId && editTitle.trim() && isAuthed) {
      await updateTask({ password, id: editingId, title: editTitle.trim() });
    }
    setEditingId(null);
  };

  const saveNotes = async (taskId: Id<"tasks">, notes: string) => {
    if (!isAuthed) return;
    await updateTask({ password, id: taskId, notes });
  };

  const handleLogin = async () => {
    setLoginError(false);
    try {
      await login(loginInput);
      setShowLoginModal(false);
      setLoginInput("");
    } catch {
      setLoginError(true);
    }
  };

  if (!allTasks || checking) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="font-[family-name:var(--font-pixel)] text-xs text-earth-400 animate-pulse">
          Loading farm...
        </p>
      </div>
    );
  }

  const month = new Date().getMonth();
  const season =
    month >= 2 && month <= 4 ? "Spring"
    : month >= 5 && month <= 7 ? "Summer"
    : month >= 8 && month <= 10 ? "Fall"
    : "Winter";
  const dayOfWeek = new Date().toLocaleDateString("en-US", { weekday: "short" });
  const dayNum = new Date().getDate();

  // Shared props for queue task rows
  const queueRowProps = {
    isAuthed, password, now, expandedId, editingId, editTitle, editNotes,
    onToggleExpand: toggleExpand,
    onStartEdit: startEditTitle,
    onEditTitleChange: setEditTitle,
    onSaveTitle: saveTitle,
    onCancelEdit: () => setEditingId(null),
    onEditNotesChange: setEditNotes,
    onSaveNotes: saveNotes,
    onMarkDone: (id: Id<"tasks">) => markDone({ password, id }),
    onMoveUp: handleMoveUp,
    onMoveDown: handleMoveDown,
    onMoveToBacklog: (id: Id<"tasks">) => moveToBacklog({ password, id }),
    onRemove: (id: Id<"tasks">) => removeTask({ password, id }),
  };

  // ── Backlog row (used in both mobile and desktop) ──
  const renderBacklogTask = (task: Task) => (
    <div key={task._id}>
      <div
        className="group flex items-center gap-2 px-2 py-2 sm:py-1.5 hover:bg-earth-900 rounded transition-colors cursor-pointer"
        onClick={() => toggleExpand(task)}
      >
        {isAuthed && (
          <button
            onClick={(e) => { e.stopPropagation(); moveToQueue({ password, id: task._id }); }}
            className="shrink-0 pixel-border bg-earth-800 text-[8px] font-[family-name:var(--font-pixel)] px-1.5 py-0.5 text-sky-400 hover:text-gold-300 hover:bg-earth-700 transition-colors leading-relaxed"
          >
            Plant
          </button>
        )}

        {editingId === task._id ? (
          <input
            type="text" value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") saveTitle(); if (e.key === "Escape") setEditingId(null); }}
            onBlur={saveTitle}
            onClick={(e) => e.stopPropagation()}
            autoFocus
            className="flex-1 min-w-0 pixel-inset bg-earth-900 px-2 py-0.5 text-sm text-earth-200 focus:outline-none"
          />
        ) : (
          <span
            className="flex-1 text-sm text-earth-400 truncate min-w-0"
            onDoubleClick={(e) => { e.stopPropagation(); startEditTitle(task); }}
          >
            {task.title}
          </span>
        )}

        <span className={`font-[family-name:var(--font-pixel)] text-[7px] shrink-0 leading-relaxed ${ageColor(task.createdAt, now)}`}>
          {formatAge(task.createdAt, now)}
        </span>

        {isAuthed && (
          <div className="flex items-center gap-1 shrink-0 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
            onClick={(e) => e.stopPropagation()}>
            <button onClick={() => markDone({ password, id: task._id })}
              className="text-[10px] text-earth-600 hover:text-leaf-400 p-1">done</button>
            <button onClick={() => removeTask({ password, id: task._id })}
              className="text-[10px] text-earth-600 hover:text-berry-400 p-1">&#10005;</button>
          </div>
        )}
      </div>

      {expandedId === task._id && (
        <NotesPanel task={task} isAuthed={isAuthed} editNotes={editNotes}
          onEditNotesChange={setEditNotes} onSaveNotes={saveNotes}
          onClose={() => toggleExpand(task)} />
      )}
    </div>
  );

  // ── Done row ──
  const renderDoneTask = (task: Task) => (
    <div key={task._id}
      className="group flex items-start gap-2 px-2 py-2 sm:py-1.5 rounded hover:bg-earth-900 transition-colors">
      <span className="text-leaf-600 text-xs mt-0.5 shrink-0">&#10003;</span>
      <div className="flex-1 min-w-0">
        <span className="text-xs text-earth-600 line-through block truncate">{task.title}</span>
        <span className="text-[10px] text-earth-700">
          {task.completedAt ? new Date(task.completedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""}
        </span>
      </div>
      {isAuthed && (
        <button onClick={() => moveToQueue({ password, id: task._id })}
          className="md:opacity-0 md:group-hover:opacity-100 text-[10px] text-earth-600 hover:text-gold-400 transition-all shrink-0 p-1">
          undo
        </button>
      )}
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col bg-earth-950">
      {/* Login modal */}
      {showLoginModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="pixel-border-gold bg-earth-900 p-5 sm:p-6 w-full max-w-80">
            <h3 className="font-[family-name:var(--font-pixel)] text-[10px] text-gold-300 mb-4 leading-relaxed">
              Enter Farm Key
            </h3>
            <input
              type="password" value={loginInput}
              onChange={(e) => { setLoginInput(e.target.value); setLoginError(false); }}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              placeholder="Password..." autoFocus
              className="w-full pixel-inset bg-earth-950 px-3 py-2.5 text-base sm:text-sm text-earth-200 placeholder:text-earth-600 focus:outline-none"
            />
            {loginError && (
              <p className="font-[family-name:var(--font-pixel)] text-[7px] text-berry-400 mt-2 leading-relaxed">
                Wrong key. Try again.
              </p>
            )}
            <div className="flex gap-2 mt-4">
              <button onClick={handleLogin}
                className="pixel-border bg-earth-800 px-4 py-1.5 font-[family-name:var(--font-pixel)] text-[8px] text-leaf-400 hover:text-leaf-300 leading-relaxed">
                Unlock
              </button>
              <button onClick={() => { setShowLoginModal(false); setLoginInput(""); setLoginError(false); }}
                className="px-4 py-1.5 font-[family-name:var(--font-pixel)] text-[8px] text-earth-600 hover:text-earth-400 leading-relaxed">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <header className="bg-earth-900 px-3 sm:px-4 py-2 sm:py-3 flex flex-wrap items-center gap-2 sm:gap-4 border-b-4 border-earth-700">
        <div className="pixel-border-gold bg-earth-800 px-3 sm:px-4 py-1.5 sm:py-2">
          <h1 className="font-[family-name:var(--font-pixel)] text-[9px] sm:text-[10px] text-gold-300 leading-relaxed">
            Farm Tasks
          </h1>
        </div>
        <div className="font-[family-name:var(--font-pixel)] text-[7px] sm:text-[8px] text-earth-400 leading-relaxed">
          <span className="text-leaf-400">{season}</span>{" "}
          <span className="text-earth-300">{dayNum}</span>{" "}
          <span className="text-earth-500">({dayOfWeek})</span>
        </div>
        <div className="font-[family-name:var(--font-pixel)] text-[7px] sm:text-[8px] text-earth-600 ml-auto leading-relaxed">
          {queuedTasks.length}Q &middot; {backlogTasks.length}B &middot; {doneTasks.length}D
        </div>

        {/* Auth button — always visible */}
        {isAuthed ? (
          <button onClick={logout}
            className="pixel-border bg-earth-800 px-2 py-1 font-[family-name:var(--font-pixel)] text-[7px] text-leaf-400 hover:text-earth-400 leading-relaxed">
            Farmer
          </button>
        ) : (
          <button onClick={() => setShowLoginModal(true)}
            className="pixel-border bg-earth-800 px-2 py-1 font-[family-name:var(--font-pixel)] text-[7px] text-earth-600 hover:text-gold-300 leading-relaxed">
            Visitor
          </button>
        )}

        {/* Add task input — full width on mobile when authed */}
        {isAuthed && (
          <div className="flex gap-2 w-full sm:w-auto sm:ml-0">
            <input
              ref={inputRef} type="text" placeholder="New task..."
              value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              className="pixel-inset bg-earth-900 px-3 py-2 sm:py-1.5 text-base sm:text-sm text-earth-200 placeholder:text-earth-600 focus:outline-none flex-1 sm:w-56"
            />
            <button onClick={handleCreate} disabled={!newTitle.trim()}
              className="pixel-border bg-earth-800 px-3 py-1 font-[family-name:var(--font-pixel)] text-[8px] text-earth-300 hover:bg-earth-700 hover:text-gold-300 disabled:opacity-30 transition-colors leading-relaxed shrink-0">
              + Add
            </button>
          </div>
        )}
      </header>

      {/* Read-only banner */}
      {!isAuthed && (
        <div className="bg-earth-900/80 border-b-2 border-earth-800 px-4 py-2 text-center">
          <span className="font-[family-name:var(--font-pixel)] text-[7px] text-earth-500 leading-relaxed">
            Viewing mode &mdash;{" "}
            <button onClick={() => setShowLoginModal(true)} className="text-gold-400 hover:text-gold-300 underline">
              enter farm key
            </button>{" "}
            to edit
          </span>
        </div>
      )}

      {/* ══════════ DESKTOP: Three columns (hidden on mobile) ══════════ */}
      <div className="hidden md:flex flex-1 overflow-hidden">
        {/* Left: Done */}
        <aside className="w-72 flex flex-col bg-earth-950 border-r-4 border-earth-800 shrink-0">
          <div className="bg-earth-900 px-3 py-2 border-b-2 border-earth-800">
            <h2 className="font-[family-name:var(--font-pixel)] text-[8px] text-leaf-400 leading-relaxed">
              Shipped <span className="text-earth-600">({doneTasks.length})</span>
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {doneTasks.length === 0 && <p className="text-xs text-earth-700 text-center py-6">Nothing shipped yet...</p>}
            {doneTasks.map(renderDoneTask)}
          </div>
        </aside>

        {/* Center: Queue */}
        <section className="flex-1 flex flex-col overflow-hidden">
          <div className="bg-earth-800 px-4 py-3 border-b-4 border-earth-700">
            <h2 className="font-[family-name:var(--font-pixel)] text-[10px] text-gold-300 leading-relaxed">
              Today&apos;s Orders
            </h2>
            <p className="text-[10px] text-earth-500 mt-1">Priority queue &mdash; top = do first</p>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-1">
            {queuedTasks.length === 0 && (
              <div className="text-center py-12">
                <p className="font-[family-name:var(--font-pixel)] text-[8px] text-earth-600 leading-loose">No orders today.</p>
                <p className="text-xs text-earth-700 mt-2">Move items from the backlog &rarr;</p>
              </div>
            )}
            {queuedTasks.map((task, index) => (
              <QueueTaskRow key={task._id} task={task} index={index} total={queuedTasks.length} {...queueRowProps} />
            ))}
          </div>
        </section>

        {/* Right: Backlog */}
        <aside className="w-80 flex flex-col bg-earth-950 border-l-4 border-earth-800 shrink-0">
          <div className="bg-earth-900 px-3 py-2 border-b-2 border-earth-800">
            <h2 className="font-[family-name:var(--font-pixel)] text-[8px] text-sky-400 leading-relaxed">
              Seed Bag <span className="text-earth-600">({backlogTasks.length})</span>
            </h2>
            <p className="text-[10px] text-earth-600 mt-0.5">Unprioritized tasks</p>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {backlogTasks.length === 0 && (
              <p className="text-xs text-earth-700 text-center py-6">
                {isAuthed ? "Add tasks above \u2014 they land here first" : "No backlog items"}
              </p>
            )}
            {backlogTasks.map(renderBacklogTask)}
          </div>
        </aside>
      </div>

      {/* ══════════ MOBILE: Single column with tab content (hidden on desktop) ══════════ */}
      <div className="flex md:hidden flex-1 flex-col overflow-hidden">
        {/* Content area */}
        <div className="flex-1 overflow-y-auto">
          {mobileTab === "queue" && (
            <div className="p-2 space-y-1">
              <div className="bg-earth-800 px-3 py-2 mb-2 border-b-2 border-earth-700">
                <h2 className="font-[family-name:var(--font-pixel)] text-[9px] text-gold-300 leading-relaxed">
                  Today&apos;s Orders
                </h2>
              </div>
              {queuedTasks.length === 0 && (
                <p className="text-xs text-earth-600 text-center py-8">No orders. Plant seeds from the backlog.</p>
              )}
              {queuedTasks.map((task, index) => (
                <QueueTaskRow key={task._id} task={task} index={index} total={queuedTasks.length} {...queueRowProps} />
              ))}
            </div>
          )}

          {mobileTab === "backlog" && (
            <div className="p-2 space-y-1">
              <div className="bg-earth-900 px-3 py-2 mb-2 border-b-2 border-earth-800">
                <h2 className="font-[family-name:var(--font-pixel)] text-[9px] text-sky-400 leading-relaxed">
                  Seed Bag
                </h2>
              </div>
              {backlogTasks.length === 0 && (
                <p className="text-xs text-earth-700 text-center py-8">
                  {isAuthed ? "Add tasks above" : "No backlog items"}
                </p>
              )}
              {backlogTasks.map(renderBacklogTask)}
            </div>
          )}

          {mobileTab === "done" && (
            <div className="p-2 space-y-1">
              <div className="bg-earth-900 px-3 py-2 mb-2 border-b-2 border-earth-800">
                <h2 className="font-[family-name:var(--font-pixel)] text-[9px] text-leaf-400 leading-relaxed">
                  Shipped
                </h2>
              </div>
              {doneTasks.length === 0 && (
                <p className="text-xs text-earth-700 text-center py-8">Nothing shipped yet...</p>
              )}
              {doneTasks.map(renderDoneTask)}
            </div>
          )}
        </div>

        {/* Mobile bottom tab bar */}
        <nav className="bg-earth-900 border-t-4 border-earth-700 flex">
          {([
            { id: "queue" as MobileTab, label: "Orders", count: queuedTasks.length, color: "text-gold-400" },
            { id: "backlog" as MobileTab, label: "Seeds", count: backlogTasks.length, color: "text-sky-400" },
            { id: "done" as MobileTab, label: "Shipped", count: doneTasks.length, color: "text-leaf-400" },
          ]).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setMobileTab(tab.id)}
              className={`flex-1 py-3 text-center transition-colors ${
                mobileTab === tab.id ? "bg-earth-800" : ""
              }`}
            >
              <span className={`font-[family-name:var(--font-pixel)] text-[8px] leading-relaxed block ${
                mobileTab === tab.id ? tab.color : "text-earth-600"
              }`}>
                {tab.label}
              </span>
              <span className={`font-[family-name:var(--font-pixel)] text-[7px] leading-relaxed ${
                mobileTab === tab.id ? "text-earth-400" : "text-earth-700"
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </nav>
      </div>

      {/* Desktop bottom bar (hidden on mobile — mobile has its own tab bar) */}
      <footer className="hidden md:flex bg-earth-900 border-t-4 border-earth-700 px-4 py-2 items-center justify-between">
        <div className="font-[family-name:var(--font-pixel)] text-[7px] text-earth-600 leading-relaxed">
          {isAuthed
            ? "double-click to rename \u00b7 click row to expand notes \u00b7 \u25b2\u25bc to reorder"
            : "read-only mode \u00b7 click row to view notes"}
        </div>
        <div className="font-[family-name:var(--font-pixel)] text-[7px] text-earth-700 leading-relaxed">
          {isAuthed ? "Farmer" : "Visitor"}
        </div>
      </footer>
    </div>
  );
}
