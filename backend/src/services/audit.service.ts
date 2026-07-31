import { query } from '../database/connection';
import type { AuditRecord } from '../types/entities';

/**
 * Valid action types for audit records.
 */
export type AuditActionType =
  | 'stock_adjustment'
  | 'stock_item_created'
  | 'stock_item_updated'
  | 'stock_item_deactivated'
  | 'stock_item_reactivated'
  | 'stock_item_deleted'
  | 'sale_created'
  | 'transfer_initiated'
  | 'transfer_confirmed'
  | 'transfer_failed'
  | 'user_created'
  | 'user_updated'
  | 'user_deactivated'
  | 'user_reactivated'
  | 'user_deleted'
  | 'branch_created'
  | 'branch_updated'
  | 'branch_deactivated'
  | 'branch_reactivated'
  | 'branch_deleted';

export interface AuditEntry {
  userId: string;
  branchId: string | null;
  actionType: AuditActionType | string;
  description: string;
  metadata?: Record<string, unknown>;
}

export interface AuditQueryFilters {
  startDate?: Date | string;
  endDate?: Date | string;
  userId?: string;
  branchId?: string;
  actionType?: string;
  page?: number;
  pageSize?: number;
}

export interface AuditQueryResult {
  records: AuditRecord[];
  total: number;
  page: number;
  pageSize: number;
}

interface DeadLetterEntry {
  entry: AuditEntry;
  failedAt: Date;
  attempts: number;
  lastError: string;
}

const MAX_RETRY_ATTEMPTS = 4;
const RETRY_DELAY_MS = [0, 0, 1000, 5000]; // attempt 1: immediate, attempt 2: immediate, attempt 3: 1s, attempt 4: 5s
const DEAD_LETTER_PROCESS_INTERVAL_MS = 60_000; // 60 seconds
const DEFAULT_PAGE_SIZE = 50;

/**
 * Delay execution for the given number of milliseconds.
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class AuditService {
  private deadLetterQueue: DeadLetterEntry[] = [];
  private processingInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.startDeadLetterWorker();
  }

  /**
   * Log an audit record with retry logic.
   *
   * Retry strategy:
   * - Attempt 1: immediate insert
   * - Attempt 2: immediate retry
   * - Attempt 3: retry after 1 second
   * - Attempt 4: retry after 5 seconds
   * - If all fail: enqueue to dead-letter queue (never discard)
   */
  async log(entry: AuditEntry): Promise<void> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
      try {
        // Apply delay for attempts 3 and 4
        const delayMs = RETRY_DELAY_MS[attempt - 1] || 0;
        if (delayMs > 0) {
          await delay(delayMs);
        }

        await this.insertAuditRecord(entry);
        return; // Success — exit
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // If not the last attempt, continue to next retry
        if (attempt < MAX_RETRY_ATTEMPTS) {
          continue;
        }
      }
    }

    // All retries exhausted — enqueue to dead-letter queue
    this.deadLetterQueue.push({
      entry,
      failedAt: new Date(),
      attempts: MAX_RETRY_ATTEMPTS,
      lastError: lastError?.message || 'Unknown error',
    });
  }

  /**
   * Query audit records with optional filters and pagination.
   * Uses indexed columns for performance (returns within 5s for 12-month queries).
   */
  async query(filters: AuditQueryFilters): Promise<AuditQueryResult> {
    const page = filters.page && filters.page > 0 ? filters.page : 1;
    const pageSize = filters.pageSize && filters.pageSize > 0 ? filters.pageSize : DEFAULT_PAGE_SIZE;
    const offset = (page - 1) * pageSize;

    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (filters.startDate) {
      conditions.push(`ar.created_at >= $${paramIndex}`);
      params.push(filters.startDate instanceof Date ? filters.startDate.toISOString() : filters.startDate);
      paramIndex++;
    }

    if (filters.endDate) {
      conditions.push(`ar.created_at <= $${paramIndex}`);
      params.push(filters.endDate instanceof Date ? filters.endDate.toISOString() : filters.endDate);
      paramIndex++;
    }

    if (filters.userId) {
      conditions.push(`ar.user_id = $${paramIndex}`);
      params.push(filters.userId);
      paramIndex++;
    }

    if (filters.branchId) {
      conditions.push(`ar.branch_id = $${paramIndex}`);
      params.push(filters.branchId);
      paramIndex++;
    }

    if (filters.actionType) {
      conditions.push(`ar.action_type = $${paramIndex}`);
      params.push(filters.actionType);
      paramIndex++;
    }

    const whereClause = conditions.length > 0
      ? `WHERE ${conditions.join(' AND ')}`
      : '';

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) as total FROM audit_records ar ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].total, 10);

    // Get paginated records (ordered by newest first, uses created_at index)
    const dataParams = [...params, pageSize, offset];
    const dataResult = await query(
      `SELECT ar.id, ar.user_id, ar.branch_id, ar.action_type, ar.description, ar.metadata, ar.created_at,
              u.username AS user_name,
              b.name AS branch_name,
              si.name AS stock_item_name,
              si.sku AS stock_item_sku
       FROM audit_records ar
       LEFT JOIN users u ON ar.user_id = u.id
       LEFT JOIN branches b ON ar.branch_id = b.id
       LEFT JOIN stock_items si ON si.id = (ar.metadata->>'stock_item_id')::uuid
       ${whereClause}
       ORDER BY ar.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      dataParams
    );

    const records: AuditRecord[] = dataResult.rows.map((row) => {
      let description = row.description;

      // Enrich description: replace stock_item UUID with readable name if available
      if (row.stock_item_name && row.metadata?.stock_item_id) {
        const itemLabel = `${row.stock_item_name} (${row.stock_item_sku})`;
        description = description.replace(
          `item ${row.metadata.stock_item_id}`,
          itemLabel
        );
      }

      return {
        id: row.id,
        user_id: row.user_id,
        branch_id: row.branch_id,
        action_type: row.action_type,
        description,
        metadata: row.metadata,
        created_at: new Date(row.created_at),
        user_name: row.user_name || null,
        branch_name: row.branch_name || null,
      };
    });

    return {
      records,
      total,
      page,
      pageSize,
    };
  }

  /**
   * Get the current dead-letter queue length (for monitoring/testing).
   */
  getDeadLetterQueueLength(): number {
    return this.deadLetterQueue.length;
  }

  /**
   * Get a copy of the dead-letter queue entries (for monitoring/testing).
   */
  getDeadLetterQueue(): DeadLetterEntry[] {
    return [...this.deadLetterQueue];
  }

  /**
   * Start the background worker that processes the dead-letter queue every 60 seconds.
   */
  private startDeadLetterWorker(): void {
    if (this.processingInterval) {
      return;
    }

    this.processingInterval = setInterval(() => {
      this.processDeadLetterQueue().catch((err) => {
        console.error('[AuditService] Dead-letter queue processing error:', err);
      });
    }, DEAD_LETTER_PROCESS_INTERVAL_MS);

    // Allow the process to exit cleanly even if the interval is running
    if (this.processingInterval.unref) {
      this.processingInterval.unref();
    }
  }

  /**
   * Process the dead-letter queue. Attempts to re-insert each failed entry.
   * On success, removes from queue. On failure, leaves for next iteration.
   */
  async processDeadLetterQueue(): Promise<void> {
    if (this.deadLetterQueue.length === 0) {
      return;
    }

    // Process a snapshot of the current queue to avoid issues with concurrent modifications
    const toProcess = [...this.deadLetterQueue];
    const successIndices: number[] = [];

    for (let i = 0; i < toProcess.length; i++) {
      try {
        await this.insertAuditRecord(toProcess[i].entry);
        successIndices.push(i);
      } catch {
        // Leave in queue for next iteration — never discard
        toProcess[i].attempts++;
        toProcess[i].lastError = 'Dead-letter retry failed';
      }
    }

    // Remove successfully processed entries (in reverse to maintain indices)
    for (let i = successIndices.length - 1; i >= 0; i--) {
      const index = this.deadLetterQueue.indexOf(toProcess[successIndices[i]]);
      if (index !== -1) {
        this.deadLetterQueue.splice(index, 1);
      }
    }
  }

  /**
   * Stop the background worker (for graceful shutdown / testing).
   */
  stopDeadLetterWorker(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
  }

  /**
   * Insert an audit record into the database.
   */
  private async insertAuditRecord(entry: AuditEntry): Promise<void> {
    await query(
      `INSERT INTO audit_records (user_id, branch_id, action_type, description, metadata)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        entry.userId,
        entry.branchId,
        entry.actionType,
        entry.description,
        entry.metadata ? JSON.stringify(entry.metadata) : '{}',
      ]
    );
  }
}

// Singleton instance
export const auditService = new AuditService();

/**
 * Fire-and-forget audit log helper.
 *
 * This function is non-blocking — it will not delay the calling operation.
 * The retry mechanism handles persistence transparently.
 * Errors are caught silently; the audit system's retry + dead-letter queue
 * ensures entries are never discarded.
 */
export async function auditLog(
  userId: string,
  branchId: string | null,
  actionType: string,
  description: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  auditService.log({
    userId,
    branchId,
    actionType,
    description,
    metadata,
  }).catch((err) => {
    // Silent catch — the retry mechanism and dead-letter queue handle persistence.
    // This ensures the caller is never delayed by audit failures.
    console.error('[auditLog] Unexpected error (entry queued for retry):', err);
  });
}
