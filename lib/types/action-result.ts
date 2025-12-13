/**
 * Unified action result type for server actions
 * Provides consistent error handling across the application
 */

export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

/**
 * Helper to create a successful result
 */
export function success<T>(data: T): ActionResult<T> {
  return { success: true, data };
}

/**
 * Helper to create an error result
 */
export function failure<T>(error: string): ActionResult<T> {
  return { success: false, error };
}

/**
 * Type guard to check if result is successful
 */
export function isSuccess<T>(result: ActionResult<T>): result is { success: true; data: T } {
  return result.success === true;
}

/**
 * Type guard to check if result is an error
 */
export function isFailure<T>(result: ActionResult<T>): result is { success: false; error: string } {
  return result.success === false;
}
