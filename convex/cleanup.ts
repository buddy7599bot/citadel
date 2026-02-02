import { mutation } from "./_generated/server";

export const clearSeedTasks = mutation({
  args: {},
  handler: async (ctx) => {
    const tasks = await ctx.db.query("tasks").collect();
    const seedTitles = new Set([
      "PM Job Shortlist",
      "VPS Security Audit",
      "Crypto Trading Bot Research",
      "X Growth Strategy for DashPane",
      "Build Citadel Dashboard UI",
    ]);
    
    let deleted = 0;
    for (const task of tasks) {
      if (seedTitles.has(task.title)) {
        const messages = await ctx.db
          .query("messages")
          .withIndex("by_task", (q) => q.eq("taskId", task._id))
          .collect();
        for (const msg of messages) await ctx.db.delete(msg._id);
        
        const subs = await ctx.db
          .query("subscriptions")
          .withIndex("by_task", (q) => q.eq("taskId", task._id))
          .collect();
        for (const sub of subs) await ctx.db.delete(sub._id);
        
        await ctx.db.delete(task._id);
        deleted++;
      }
    }
    return { deletedTasks: deleted };
  },
});

export const clearAllDomainData = mutation({
  args: {},
  handler: async (ctx) => {
    const tables = [
      "trading_data",
      "trading_positions", 
      "social_metrics",
      "security_scans",
      "job_pipeline",
      "build_status",
    ] as const;
    const counts: Record<string, number> = {};
    for (const table of tables) {
      const rows = await ctx.db.query(table).collect();
      for (const row of rows) await ctx.db.delete(row._id);
      counts[table] = rows.length;
    }
    return counts;
  },
});

export const clearOldActivities = mutation({
  args: {},
  handler: async (ctx) => {
    const activities = await ctx.db.query("activities").collect();
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const cutoff = todayStart.getTime();
    let deleted = 0;
    for (const activity of activities) {
      if (activity.createdAt < cutoff) {
        await ctx.db.delete(activity._id);
        deleted++;
      }
    }
    return { deleted };
  },
});
