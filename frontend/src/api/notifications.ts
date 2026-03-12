import apiClient from './client';

export interface NotificationRecord {
  id: string;
  type: string;
  category: 'activity' | 'system';
  title: string;
  message: string;
  isRead: boolean;
  userId: string;
  taskId: string | null;
  actorId: string | null;
  createdAt: string;
}

export interface NotificationsResponse {
  notifications: NotificationRecord[];
  total: number;
}

export async function getNotificationsApi(
  category?: string,
  limit?: number,
  offset?: number,
): Promise<NotificationsResponse> {
  const params: Record<string, string> = {};
  if (category) params.category = category;
  if (limit !== undefined) params.limit = String(limit);
  if (offset !== undefined) params.offset = String(offset);
  const response = await apiClient.get<NotificationsResponse>('/notifications', { params });
  return response.data;
}

export async function getUnreadCountApi(): Promise<{ count: number }> {
  const response = await apiClient.get<{ count: number }>('/notifications/unread-count');
  return response.data;
}

export async function markAsReadApi(id: string): Promise<void> {
  await apiClient.patch(`/notifications/${id}/read`);
}

export async function markAllAsReadApi(): Promise<void> {
  await apiClient.patch('/notifications/read-all');
}
