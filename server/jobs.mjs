/**
 * In-memory job table for the studio agent service (see PROTOCOL.md).
 *
 * Semantics: ONE in-flight job per slug, a small global concurrency cap,
 * FIFO queueing with live `{type:'queued', position}` updates, and
 * cancellation that covers both queued and running jobs. Zero dependencies —
 * this is local-first plumbing; Phase 5 (hosted) replaces it with a real
 * queue behind the Agent SDK.
 */
import { randomUUID } from 'node:crypto'

const KILL_GRACE_MS = 5000

export function createJobTable({ concurrency = 2, maxQueue = 16 } = {}) {
  /** slug → job, for every job that is queued or running. */
  const bySlug = new Map()
  /** Jobs waiting for a slot, FIFO. Capped: every queued job holds an open
   *  NDJSON stream (socket + closures), so an unbounded queue is a DoS vector
   *  — reject beyond the cap instead of accumulating sockets. */
  const queue = []
  let running = 0

  /** Re-announce positions after any queue mutation (cheap: queue is tiny).
   *  Table-emitted events stamp their own jobId — they can fire before the
   *  caller's submit() returns. */
  const announcePositions = () => {
    queue.forEach((job, i) => job.emit({ jobId: job.id, type: 'queued', position: i + 1 }))
  }

  const pump = () => {
    while (running < concurrency && queue.length > 0) {
      const job = queue.shift()
      announcePositions()
      running++
      job.state = 'running'
      job.start(job)
    }
  }

  return {
    get: (slug) => bySlug.get(slug),
    counts: () => ({ running, queued: queue.length }),

    /**
     * Register and schedule a job. Returns null when the slug already has a
     * queued/running job, or `'full'` when the wait queue is at capacity.
     * `start(job)` spawns the engine (the job's `child` must be assigned
     * there); `emit(event)` writes one NDJSON event; `end()` closes the
     * client stream.
     */
    submit(slug, kind, { start, emit, end }) {
      if (bySlug.has(slug)) return null
      if (running >= concurrency && queue.length >= maxQueue) return 'full'
      const job = {
        id: randomUUID(),
        slug,
        kind,
        state: 'queued',
        child: null,
        cancelled: false,
        /** Set once the dead-session fallback respawned (edit jobs). */
        retried: false,
        start,
        emit,
        end,
        killTimer: null,
      }
      bySlug.set(slug, job)
      if (running < concurrency) {
        running++
        job.state = 'running'
        job.start(job)
      } else {
        queue.push(job)
        job.emit({ jobId: job.id, type: 'queued', position: queue.length })
      }
      return job
    },

    /**
     * Release the job's slot and start whatever is next. Call exactly once
     * per job, after its terminal event was emitted.
     */
    finish(job) {
      if (!bySlug.has(job.slug)) return
      bySlug.delete(job.slug)
      if (job.killTimer) clearTimeout(job.killTimer)
      if (job.state === 'running') {
        running = Math.max(0, running - 1)
        job.state = job.cancelled ? 'cancelled' : 'done'
        pump()
      }
    },

    /**
     * Cancel a job by slug. Queued jobs are removed and terminated here
     * (emits `cancelled`); running jobs get SIGTERM (SIGKILL after a grace
     * period) and their child's close handler emits the terminal event.
     * Returns true when there was a job to cancel.
     */
    cancel(slug) {
      const job = bySlug.get(slug)
      if (!job) return false
      job.cancelled = true
      if (job.state === 'queued') {
        const i = queue.indexOf(job)
        if (i >= 0) queue.splice(i, 1)
        announcePositions()
        bySlug.delete(slug)
        job.state = 'cancelled'
        job.emit({ jobId: job.id, type: 'cancelled' })
        job.end()
        return true
      }
      if (job.child && job.child.exitCode === null && !job.child.killed) {
        job.child.kill('SIGTERM')
        job.killTimer = setTimeout(() => {
          if (job.child && job.child.exitCode === null) job.child.kill('SIGKILL')
        }, KILL_GRACE_MS)
        job.killTimer.unref?.()
      }
      return true
    },
  }
}
