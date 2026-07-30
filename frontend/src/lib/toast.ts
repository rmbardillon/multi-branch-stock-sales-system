import { toast as sonnerToast } from "sonner";
import { ApiClientError } from "@/lib/api-client";

/**
 * Show a toast notification for API errors.
 * Handles specific HTTP status codes with user-friendly messages.
 */
export function showErrorToast(error: unknown) {
  if (error instanceof ApiClientError) {
    const message = getErrorMessage(error);
    sonnerToast.error(message, {
      description: getErrorDescription(error),
    });
  } else if (error instanceof Error) {
    sonnerToast.error(error.message || "An unexpected error occurred");
  } else {
    sonnerToast.error("An unexpected error occurred");
  }
}

/**
 * Show a success toast notification.
 */
export function showSuccessToast(message: string, description?: string) {
  sonnerToast.success(message, { description });
}

/**
 * Show an info toast notification.
 */
export function showInfoToast(message: string, description?: string) {
  sonnerToast.info(message, { description });
}

function getErrorMessage(error: ApiClientError): string {
  switch (error.statusCode) {
    case 400:
      return "Invalid request";
    case 401:
      return "Session expired";
    case 403:
      return "Access denied";
    case 404:
      return "Not found";
    case 409:
      return "Conflict";
    case 422:
      return "Validation error";
    case 500:
      return "Server error";
    case 503:
      return "Service unavailable";
    default:
      return error.message || "Request failed";
  }
}

function getErrorDescription(error: ApiClientError): string | undefined {
  // Use the server-provided message if available
  if (error.message && error.message !== "Request failed") {
    return error.message;
  }

  switch (error.statusCode) {
    case 400:
      return "Please check your input and try again.";
    case 403:
      return "You do not have permission to perform this action.";
    case 404:
      return "The requested resource could not be found.";
    case 409:
      return "A resource with this information already exists.";
    case 422:
      return formatValidationDetails(error.details);
    case 500:
      return "An internal server error occurred. Please try again later.";
    case 503:
      return "The service is temporarily unavailable. Please try again later.";
    default:
      return undefined;
  }
}

function formatValidationDetails(
  details?: Record<string, string[]>
): string | undefined {
  if (!details) return undefined;
  const messages = Object.entries(details)
    .map(([field, errors]) => `${field}: ${errors.join(", ")}`)
    .join("; ");
  return messages || undefined;
}
