import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {
    status: v.optional(
      v.union(
        v.literal("backlog"),
        v.literal("queued"),
        v.literal("done")
      )
    ),
  },
  handler: async (ctx, args) => {
    if (args.status) {
      return await ctx.db
        .query("tasks")
        .withIndex("by_status", (q) => q.eq("status", args.status!))
        .collect();
    }
    return await ctx.db.query("tasks").collect();
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    status: v.union(
      v.literal("backlog"),
      v.literal("queued")
    ),
    priority: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // If adding to queue without explicit priority, put at the end
    let priority = args.priority;
    if (args.status === "queued" && priority === undefined) {
      const existing = await ctx.db
        .query("tasks")
        .withIndex("by_status", (q) => q.eq("status", "queued"))
        .collect();
      priority = existing.length > 0
        ? Math.max(...existing.map((t) => t.priority ?? 0)) + 1
        : 0;
    }

    return await ctx.db.insert("tasks", {
      title: args.title,
      description: args.description,
      status: args.status,
      priority,
      createdAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("tasks"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    priority: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { id, ...fields } = args;
    const updates: Record<string, unknown> = {};
    if (fields.title !== undefined) updates.title = fields.title;
    if (fields.description !== undefined) updates.description = fields.description;
    if (fields.priority !== undefined) updates.priority = fields.priority;
    await ctx.db.patch(id, updates);
  },
});

export const markDone = mutation({
  args: { id: v.id("tasks") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      status: "done",
      completedAt: Date.now(),
      priority: undefined,
    });
  },
});

export const moveToQueue = mutation({
  args: {
    id: v.id("tasks"),
    priority: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let priority = args.priority;
    if (priority === undefined) {
      const existing = await ctx.db
        .query("tasks")
        .withIndex("by_status", (q) => q.eq("status", "queued"))
        .collect();
      priority = existing.length > 0
        ? Math.max(...existing.map((t) => t.priority ?? 0)) + 1
        : 0;
    }
    await ctx.db.patch(args.id, {
      status: "queued",
      priority,
      completedAt: undefined,
    });
  },
});

export const moveToBacklog = mutation({
  args: { id: v.id("tasks") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      status: "backlog",
      priority: undefined,
      completedAt: undefined,
    });
  },
});

export const reorder = mutation({
  args: {
    taskIds: v.array(v.id("tasks")),
  },
  handler: async (ctx, args) => {
    for (let i = 0; i < args.taskIds.length; i++) {
      await ctx.db.patch(args.taskIds[i], { priority: i });
    }
  },
});

export const remove = mutation({
  args: { id: v.id("tasks") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});
