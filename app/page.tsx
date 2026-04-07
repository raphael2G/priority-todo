"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { Id } from "@convex/_generated/dataModel";
import { useState, useRef, useCallback } from "react";

type Task = {
  _id: Id<"tasks">;
  _creationTime: number;
  title: string;
  description?: string;
  status: "backlog" | "queued" | "done";
  priority?: number;
  completedAt?: number;
  createdAt: number;
};

type Tab = "queue" | "backlog";

export default function Home() {
  const allTasks = useQuery(api.tasks.list, {});
  const createTask = useMutation(api.tasks.create);
  const markDone = useMutation(api.tasks.markDone);
  const moveToQueue = useMutation(api.tasks.moveToQueue);
  const moveToBacklog = useMutation(api.tasks.moveToBacklog);
  const reorder = useMutation(api.tasks.reorder);
  const removeTask = useMutation(api.tasks.remove);
  const updateTask = useMutation(api.tasks.update);

  const [activeTab, setActiveTab] = useState<Tab>("queue");
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [editingId, setEditingId] = useState<Id<"tasks"> | null>(null);
  const [editTitle, setEditTitle] = useState("");
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
    await createTask({
      title,
      description: newDesc.trim() || undefined,
      status: activeTab === "queue" ? "queued" : "backlog",
    });
    setNewTitle("");
    setNewDesc("");
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

  const startEdit = (task: Task) => {
    setEditingId(task._id);
    setEditTitle(task.title);
  };

  const saveEdit = async () => {
    if (editingId && editTitle.trim()) {
      await updateTask({ id: editingId, title: editTitle.trim() });
    }
    setEditingId(null);
  };

  if (!allTasks) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-neutral-500">Loading...</div>
      </div>
    );
  }

  const activeTasks = activeTab === "queue" ? queuedTasks : backlogTasks;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-neutral-800 px-6 py-4">
        <h1 className="text-lg font-semibold tracking-tight">Priority Queue</h1>
        <p className="text-sm text-neutral-500 mt-0.5">
          {queuedTasks.length} queued &middot; {backlogTasks.length} backlog &middot; {doneTasks.length} done
        </p>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left: Done */}
        <aside className="w-80 border-r border-neutral-800 flex flex-col bg-neutral-950/50">
          <div className="px-4 py-3 border-b border-neutral-800">
            <h2 className="text-sm font-medium text-neutral-400 uppercase tracking-wider">
              Done
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {doneTasks.length === 0 && (
              <p className="text-sm text-neutral-600 px-2 py-4 text-center">
                Nothing completed yet
              </p>
            )}
            {doneTasks.map((task) => (
              <div
                key={task._id}
                className="group flex items-center gap-2 px-3 py-2 rounded-md hover:bg-neutral-900 transition-colors"
              >
                <span className="text-sm text-neutral-500 line-through flex-1 truncate">
                  {task.title}
                </span>
                <span className="text-xs text-neutral-700 shrink-0">
                  {task.completedAt
                    ? new Date(task.completedAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })
                    : ""}
                </span>
                <button
                  onClick={() => moveToQueue({ id: task._id })}
                  className="opacity-0 group-hover:opacity-100 text-xs text-neutral-500 hover:text-amber-400 transition-all"
                  title="Move back to queue"
                >
                  undo
                </button>
              </div>
            ))}
          </div>
        </aside>

        {/* Right: Active area */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Tabs */}
          <div className="flex items-center gap-1 px-4 pt-3 pb-0">
            <button
              onClick={() => setActiveTab("queue")}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                activeTab === "queue"
                  ? "bg-neutral-800 text-neutral-100"
                  : "text-neutral-500 hover:text-neutral-300"
              }`}
            >
              Queue ({queuedTasks.length})
            </button>
            <button
              onClick={() => setActiveTab("backlog")}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                activeTab === "backlog"
                  ? "bg-neutral-800 text-neutral-100"
                  : "text-neutral-500 hover:text-neutral-300"
              }`}
            >
              Backlog ({backlogTasks.length})
            </button>
          </div>

          {/* Add task */}
          <div className="px-4 py-3">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                placeholder={
                  activeTab === "queue"
                    ? "Add to queue..."
                    : "Add to backlog..."
                }
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                className="flex-1 bg-neutral-900 border border-neutral-800 rounded-md px-3 py-2 text-sm placeholder:text-neutral-600 focus:outline-none focus:border-neutral-600 transition-colors"
              />
              <button
                onClick={handleCreate}
                disabled={!newTitle.trim()}
                className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-30 disabled:hover:bg-neutral-800 text-sm rounded-md transition-colors"
              >
                Add
              </button>
            </div>
            {activeTab === "backlog" && (
              <input
                type="text"
                placeholder="Description (optional)"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                className="mt-2 w-full bg-neutral-900 border border-neutral-800 rounded-md px-3 py-2 text-sm placeholder:text-neutral-600 focus:outline-none focus:border-neutral-600 transition-colors"
              />
            )}
          </div>

          {/* Task list */}
          <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-1">
            {activeTasks.length === 0 && (
              <p className="text-sm text-neutral-600 py-8 text-center">
                {activeTab === "queue"
                  ? "Queue is empty. Add tasks or move items from backlog."
                  : "Backlog is empty. Add tasks you haven't prioritized yet."}
              </p>
            )}
            {activeTasks.map((task, index) => (
              <div
                key={task._id}
                className="group flex items-center gap-2 px-3 py-2.5 rounded-md hover:bg-neutral-900/80 border border-transparent hover:border-neutral-800 transition-all"
              >
                {/* Priority number for queue */}
                {activeTab === "queue" && (
                  <span className="text-xs text-neutral-600 w-5 text-right shrink-0 font-mono">
                    {index + 1}
                  </span>
                )}

                {/* Check button */}
                <button
                  onClick={() => markDone({ id: task._id })}
                  className="w-4 h-4 rounded-full border border-neutral-700 hover:border-emerald-500 hover:bg-emerald-500/20 transition-colors shrink-0"
                  title="Mark done"
                />

                {/* Title */}
                {editingId === task._id ? (
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveEdit();
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    onBlur={saveEdit}
                    autoFocus
                    className="flex-1 bg-neutral-900 border border-neutral-700 rounded px-2 py-0.5 text-sm focus:outline-none focus:border-neutral-500"
                  />
                ) : (
                  <span
                    className="flex-1 text-sm text-neutral-200 truncate cursor-pointer"
                    onDoubleClick={() => startEdit(task)}
                    title={task.description || undefined}
                  >
                    {task.title}
                    {task.description && (
                      <span className="text-neutral-600 ml-2 text-xs">
                        {task.description}
                      </span>
                    )}
                  </span>
                )}

                {/* Actions */}
                <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 shrink-0 transition-opacity">
                  {activeTab === "queue" && (
                    <>
                      <button
                        onClick={() => handleMoveUp(index)}
                        disabled={index === 0}
                        className="text-neutral-500 hover:text-neutral-300 disabled:opacity-20 p-1 text-xs"
                        title="Move up"
                      >
                        ▲
                      </button>
                      <button
                        onClick={() => handleMoveDown(index)}
                        disabled={index === activeTasks.length - 1}
                        className="text-neutral-500 hover:text-neutral-300 disabled:opacity-20 p-1 text-xs"
                        title="Move down"
                      >
                        ▼
                      </button>
                      <button
                        onClick={() => moveToBacklog({ id: task._id })}
                        className="text-xs text-neutral-500 hover:text-amber-400 px-1 transition-colors"
                        title="Move to backlog"
                      >
                        backlog
                      </button>
                    </>
                  )}
                  {activeTab === "backlog" && (
                    <button
                      onClick={() => moveToQueue({ id: task._id })}
                      className="text-xs text-neutral-500 hover:text-blue-400 px-1 transition-colors"
                      title="Move to queue"
                    >
                      queue
                    </button>
                  )}
                  <button
                    onClick={() => removeTask({ id: task._id })}
                    className="text-xs text-neutral-500 hover:text-red-400 px-1 transition-colors"
                    title="Delete"
                  >
                    &times;
                  </button>
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
