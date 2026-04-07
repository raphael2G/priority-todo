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
  if (days < 1) return "text-leaf-400";       // fresh — green
  if (days < 3) return "text-earth-400";      // fine
  if (days < 7) return "text-gold-400";       // getting stale — gold
  if (days < 14) return "text-gold-500";      // warning
  return "text-berry-400";                     // old — red/berry
}

export default function Home() {
  const allTasks = useQuery(api.tasks.list, {});
  const createTask = useMutation(api.tasks.create);
  const markDone = useMutation(api.tasks.markDone);
  const moveToQueue = useMutation(api.tasks.moveToQueue);
  const moveToBacklog = useMutation(api.tasks.moveToBacklog);
  const reorder = useMutation(api.tasks.reorder);
  const removeTask = useMutation(api.tasks.remove);
  const updateTask = useMutation(api.tasks.update);

  const now = useNow();
  const [newTitle, setNewTitle] = useState("");
  const [expandedId, setExpandedId] = useState<Id<"tasks"> | null>(null);
  const [editingId, setEditingId] = useState<Id<"tasks"> | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editNotes, setEditNotes] = useState("");
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
    const title = newTitle.trim();
    if (!title) return;
    await createTask({ title, status: "backlog" });
    setNewTitle("");
    inputRef.current?.focus();
  };

  const handleMoveUp = useCallback(
    async (index: number) => {
      if (index === 0) return;
      const ids = queuedTasks.map((t) => t._id);
      [ids[index - 1], ids[index]] = [ids[index], ids[index - 1]];
      await reorder({ taskIds: ids });
    },
    [queuedTasks, reorder]
  );

  const handleMoveDown = useCallback(
    async (index: number) => {
      if (index === queuedTasks.length - 1) return;
      const ids = queuedTasks.map((t) => t._id);
      [ids[index], ids[index + 1]] = [ids[index + 1], ids[index]];
      await reorder({ taskIds: ids });
    },
    [queuedTasks, reorder]
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
    setEditingId(task._id);
    setEditTitle(task.title);
  };

  const saveTitle = async () => {
    if (editingId && editTitle.trim()) {
      await updateTask({ id: editingId, title: editTitle.trim() });
    }
    setEditingId(null);
  };

  const saveNotes = async (taskId: Id<"tasks">, notes: string) => {
    await updateTask({ id: taskId, notes });
  };

  if (!allTasks) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="font-[family-name:var(--font-pixel)] text-xs text-earth-400 animate-pulse">
          Loading farm...
        </p>
      </div>
    );
  }

  // Season based on month
  const month = new Date().getMonth();
  const season =
    month >= 2 && month <= 4
      ? "Spring"
      : month >= 5 && month <= 7
        ? "Summer"
        : month >= 8 && month <= 10
          ? "Fall"
          : "Winter";
  const dayOfWeek = new Date().toLocaleDateString("en-US", { weekday: "long" });
  const dayNum = new Date().getDate();

  return (
    <div className="min-h-screen flex flex-col bg-earth-950">
      {/* Top bar — Stardew-style day/season header */}
      <header className="bg-earth-900 px-4 py-3 flex items-center gap-4 border-b-4 border-earth-700">
        <div className="pixel-border-gold bg-earth-800 px-4 py-2">
          <h1 className="font-[family-name:var(--font-pixel)] text-[10px] text-gold-300 leading-relaxed">
            Farm Tasks
          </h1>
        </div>
        <div className="font-[family-name:var(--font-pixel)] text-[8px] text-earth-400 leading-relaxed">
          <span className="text-leaf-400">{season}</span>{" "}
          <span className="text-earth-300">{dayNum}</span>{" "}
          <span className="text-earth-500">({dayOfWeek})</span>
        </div>
        <div className="font-[family-name:var(--font-pixel)] text-[8px] text-earth-600 ml-auto leading-relaxed">
          {queuedTasks.length}Q &middot; {backlogTasks.length}B &middot;{" "}
          {doneTasks.length}D
        </div>

        {/* Add task input */}
        <div className="flex gap-2 ml-4">
          <input
            ref={inputRef}
            type="text"
            placeholder="New task..."
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            className="pixel-inset bg-earth-900 px-3 py-1.5 text-sm text-earth-200 placeholder:text-earth-600 focus:outline-none w-56"
          />
          <button
            onClick={handleCreate}
            disabled={!newTitle.trim()}
            className="pixel-border bg-earth-800 px-3 py-1 font-[family-name:var(--font-pixel)] text-[8px] text-earth-300 hover:bg-earth-700 hover:text-gold-300 disabled:opacity-30 transition-colors leading-relaxed"
          >
            + Add
          </button>
        </div>
      </header>

      {/* Three columns */}
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT: Shipping Bin (Done) */}
        <aside className="w-72 flex flex-col bg-earth-950 border-r-4 border-earth-800 shrink-0">
          <div className="bg-earth-900 px-3 py-2 border-b-2 border-earth-800">
            <h2 className="font-[family-name:var(--font-pixel)] text-[8px] text-leaf-400 leading-relaxed">
              Shipped
              <span className="text-earth-600 ml-2">({doneTasks.length})</span>
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {doneTasks.length === 0 && (
              <p className="text-xs text-earth-700 text-center py-6">
                Nothing shipped yet...
              </p>
            )}
            {doneTasks.map((task) => (
              <div
                key={task._id}
                className="group flex items-start gap-2 px-2 py-1.5 rounded hover:bg-earth-900 transition-colors"
              >
                <span className="text-leaf-600 text-xs mt-0.5 shrink-0">
                  &#10003;
                </span>
                <div className="flex-1 min-w-0">
                  <span className="text-xs text-earth-600 line-through block truncate">
                    {task.title}
                  </span>
                  <span className="text-[10px] text-earth-700">
                    {task.completedAt
                      ? new Date(task.completedAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })
                      : ""}
                  </span>
                </div>
                <button
                  onClick={() => moveToQueue({ id: task._id })}
                  className="opacity-0 group-hover:opacity-100 text-[10px] text-earth-600 hover:text-gold-400 transition-all shrink-0"
                >
                  undo
                </button>
              </div>
            ))}
          </div>
        </aside>

        {/* CENTER: Priority Queue (the farm board) */}
        <section className="flex-1 flex flex-col overflow-hidden">
          <div className="bg-earth-800 px-4 py-3 border-b-4 border-earth-700">
            <h2 className="font-[family-name:var(--font-pixel)] text-[10px] text-gold-300 leading-relaxed">
              Today&apos;s Orders
            </h2>
            <p className="text-[10px] text-earth-500 mt-1">
              Your priority queue &mdash; top task = do first
            </p>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-1">
            {queuedTasks.length === 0 && (
              <div className="text-center py-12">
                <p className="font-[family-name:var(--font-pixel)] text-[8px] text-earth-600 leading-loose">
                  No orders today.
                </p>
                <p className="text-xs text-earth-700 mt-2">
                  Move items from the backlog &rarr;
                </p>
              </div>
            )}
            {queuedTasks.map((task, index) => (
              <div key={task._id}>
                <div
                  className={`group flex items-center gap-2 px-3 py-2 transition-all cursor-pointer ${
                    index === 0
                      ? "pixel-border-gold bg-earth-800"
                      : "pixel-border bg-earth-900 hover:bg-earth-800"
                  }`}
                  onClick={() => toggleExpand(task)}
                >
                  {/* Priority badge */}
                  <span
                    className={`font-[family-name:var(--font-pixel)] text-[8px] w-6 text-center shrink-0 leading-relaxed ${
                      index === 0 ? "text-gold-400" : "text-earth-600"
                    }`}
                  >
                    {index + 1}
                  </span>

                  {/* Checkbox */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      markDone({ id: task._id });
                    }}
                    className={`w-4 h-4 shrink-0 border-2 transition-colors ${
                      index === 0
                        ? "border-gold-500 hover:bg-leaf-500 hover:border-leaf-500"
                        : "border-earth-600 hover:bg-leaf-600 hover:border-leaf-600"
                    }`}
                    title="Ship it!"
                  />

                  {/* Title */}
                  {editingId === task._id ? (
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveTitle();
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      onBlur={saveTitle}
                      onClick={(e) => e.stopPropagation()}
                      autoFocus
                      className="flex-1 pixel-inset bg-earth-900 px-2 py-0.5 text-sm text-earth-200 focus:outline-none"
                    />
                  ) : (
                    <span
                      className={`flex-1 text-sm truncate ${
                        index === 0 ? "text-earth-100" : "text-earth-300"
                      }`}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        startEditTitle(task);
                      }}
                    >
                      {task.title}
                      {task.notes && (
                        <span className="text-earth-600 text-[10px] ml-2">
                          [notes]
                        </span>
                      )}
                    </span>
                  )}

                  {/* Age timer */}
                  <span
                    className={`font-[family-name:var(--font-pixel)] text-[7px] shrink-0 leading-relaxed ${ageColor(task.createdAt, now)}`}
                    title={`Created ${new Date(task.createdAt).toLocaleDateString()}`}
                  >
                    {formatAge(task.createdAt, now)}
                  </span>

                  {/* Expand indicator */}
                  <span
                    className={`text-earth-600 text-xs shrink-0 transition-transform ${
                      expandedId === task._id ? "rotate-90" : ""
                    }`}
                  >
                    &#9654;
                  </span>

                  {/* Action buttons */}
                  <div
                    className="opacity-0 group-hover:opacity-100 flex items-center gap-1 shrink-0 transition-opacity"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => handleMoveUp(index)}
                      disabled={index === 0}
                      className="text-earth-500 hover:text-gold-400 disabled:opacity-20 px-0.5 text-xs"
                    >
                      &#9650;
                    </button>
                    <button
                      onClick={() => handleMoveDown(index)}
                      disabled={index === queuedTasks.length - 1}
                      className="text-earth-500 hover:text-gold-400 disabled:opacity-20 px-0.5 text-xs"
                    >
                      &#9660;
                    </button>
                    <button
                      onClick={() => moveToBacklog({ id: task._id })}
                      className="text-[10px] text-earth-600 hover:text-earth-400 px-1"
                    >
                      stash
                    </button>
                    <button
                      onClick={() => removeTask({ id: task._id })}
                      className="text-[10px] text-earth-600 hover:text-berry-400 px-0.5"
                    >
                      &#10005;
                    </button>
                  </div>
                </div>

                {/* Expanded notes panel */}
                {expandedId === task._id && (
                  <div className="pixel-inset bg-earth-950 mx-2 mt-0 p-3">
                    <label className="font-[family-name:var(--font-pixel)] text-[7px] text-earth-500 block mb-2 leading-relaxed">
                      Notes:
                    </label>
                    <textarea
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      onBlur={() => saveNotes(task._id, editNotes)}
                      placeholder="Write notes here..."
                      rows={3}
                      className="w-full bg-earth-900 text-sm text-earth-200 placeholder:text-earth-700 p-2 pixel-inset focus:outline-none resize-y"
                    />
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        onClick={() => {
                          saveNotes(task._id, editNotes);
                          setExpandedId(null);
                        }}
                        className="pixel-border bg-earth-800 px-2 py-0.5 font-[family-name:var(--font-pixel)] text-[7px] text-leaf-400 hover:text-leaf-300 leading-relaxed"
                      >
                        Save
                      </button>
                      <span className="text-[10px] text-earth-700">
                        (auto-saves on blur)
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* RIGHT: Backlog (the seed bag) */}
        <aside className="w-80 flex flex-col bg-earth-950 border-l-4 border-earth-800 shrink-0">
          <div className="bg-earth-900 px-3 py-2 border-b-2 border-earth-800">
            <h2 className="font-[family-name:var(--font-pixel)] text-[8px] text-sky-400 leading-relaxed">
              Seed Bag
              <span className="text-earth-600 ml-2">
                ({backlogTasks.length})
              </span>
            </h2>
            <p className="text-[10px] text-earth-600 mt-0.5">
              Unprioritized tasks
            </p>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {backlogTasks.length === 0 && (
              <p className="text-xs text-earth-700 text-center py-6">
                Add tasks above &mdash; they land here first
              </p>
            )}
            {backlogTasks.map((task) => (
              <div key={task._id}>
                <div
                  className="group flex items-center gap-2 px-2 py-1.5 hover:bg-earth-900 rounded transition-colors cursor-pointer"
                  onClick={() => toggleExpand(task)}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      moveToQueue({ id: task._id });
                    }}
                    className="shrink-0 pixel-border bg-earth-800 text-[8px] font-[family-name:var(--font-pixel)] px-1.5 py-0.5 text-sky-400 hover:text-gold-300 hover:bg-earth-700 transition-colors leading-relaxed"
                    title="Plant this task in the queue"
                  >
                    Plant
                  </button>

                  {editingId === task._id ? (
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveTitle();
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      onBlur={saveTitle}
                      onClick={(e) => e.stopPropagation()}
                      autoFocus
                      className="flex-1 pixel-inset bg-earth-900 px-2 py-0.5 text-sm text-earth-200 focus:outline-none"
                    />
                  ) : (
                    <span
                      className="flex-1 text-sm text-earth-400 truncate"
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        startEditTitle(task);
                      }}
                    >
                      {task.title}
                      {task.notes && (
                        <span className="text-earth-700 text-[10px] ml-1">
                          [notes]
                        </span>
                      )}
                    </span>
                  )}

                  {/* Age timer */}
                  <span
                    className={`font-[family-name:var(--font-pixel)] text-[7px] shrink-0 leading-relaxed ${ageColor(task.createdAt, now)}`}
                    title={`Created ${new Date(task.createdAt).toLocaleDateString()}`}
                  >
                    {formatAge(task.createdAt, now)}
                  </span>

                  <div
                    className="opacity-0 group-hover:opacity-100 flex items-center gap-1 shrink-0 transition-opacity"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => markDone({ id: task._id })}
                      className="text-[10px] text-earth-600 hover:text-leaf-400"
                    >
                      done
                    </button>
                    <button
                      onClick={() => removeTask({ id: task._id })}
                      className="text-[10px] text-earth-600 hover:text-berry-400"
                    >
                      &#10005;
                    </button>
                  </div>
                </div>

                {/* Expanded notes panel */}
                {expandedId === task._id && (
                  <div className="pixel-inset bg-earth-950 mx-2 mt-1 mb-1 p-3">
                    <label className="font-[family-name:var(--font-pixel)] text-[7px] text-earth-500 block mb-2 leading-relaxed">
                      Notes:
                    </label>
                    <textarea
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      onBlur={() => saveNotes(task._id, editNotes)}
                      placeholder="Write notes here..."
                      rows={3}
                      className="w-full bg-earth-900 text-sm text-earth-200 placeholder:text-earth-700 p-2 pixel-inset focus:outline-none resize-y"
                    />
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        onClick={() => {
                          saveNotes(task._id, editNotes);
                          setExpandedId(null);
                        }}
                        className="pixel-border bg-earth-800 px-2 py-0.5 font-[family-name:var(--font-pixel)] text-[7px] text-leaf-400 hover:text-leaf-300 leading-relaxed"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </aside>
      </div>

      {/* Bottom bar — like the toolbar in Stardew */}
      <footer className="bg-earth-900 border-t-4 border-earth-700 px-4 py-2 flex items-center justify-between">
        <div className="font-[family-name:var(--font-pixel)] text-[7px] text-earth-600 leading-relaxed">
          double-click to rename &middot; click row to expand notes &middot;
          &#9650;&#9660; to reorder
        </div>
        <div className="font-[family-name:var(--font-pixel)] text-[7px] text-earth-700 leading-relaxed">
          v1.0
        </div>
      </footer>
    </div>
  );
}
