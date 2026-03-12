import apiClient from './client';

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
}

export interface UserProfile {
  userId: string;
  username: string;
  role: string;
}

export interface UserRecord {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  role: string;
  bio?: string;
  isBlocked?: boolean;
  emailNotificationsEnabled?: boolean;
  deletedAt?: string;
  createdAt: string;
}

export interface SignupRequest {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  password: string;
}

export interface SignupResponse {
  message: string;
}

export async function signupApi(
  data: SignupRequest,
): Promise<SignupResponse> {
  const response = await apiClient.post<SignupResponse>('/auth/signup', data);
  return response.data;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  password: string;
}

export interface MessageResponse {
  message: string;
}

export async function forgotPasswordApi(
  data: ForgotPasswordRequest,
): Promise<MessageResponse> {
  const response = await apiClient.post<MessageResponse>(
    '/auth/forgot-password',
    data,
  );
  return response.data;
}


export async function resetPasswordApi(
  data: ResetPasswordRequest,
): Promise<MessageResponse> {
  const response = await apiClient.post<MessageResponse>(
    '/auth/reset-password',
    data,
  );
  return response.data;
}

export async function loginApi(
  credentials: LoginRequest,
): Promise<LoginResponse> {
  const response = await apiClient.post<LoginResponse>(
    '/auth/login',
    credentials,
  );
  return response.data;
}

export async function refreshTokenApi(
  refreshToken: string,
): Promise<LoginResponse> {
  const response = await apiClient.post<LoginResponse>('/auth/refresh', {
    refresh_token: refreshToken,
  });
  return response.data;
}

export async function logoutApi(): Promise<void> {
  await apiClient.post('/auth/logout');
}

export async function getAccountApi(): Promise<UserRecord> {
  const response = await apiClient.get<UserRecord>('/auth/account');
  return response.data;
}

export async function getProfileApi(): Promise<UserProfile> {
  const response = await apiClient.get<UserProfile>('/auth/profile');
  return response.data;
}

export async function getUsersApi(): Promise<UserRecord[]> {
  const response = await apiClient.get<UserRecord[]>('/auth/users');
  return response.data;
}

export async function updateUserRoleApi(
  userId: string,
  role: string,
): Promise<UserRecord> {
  const response = await apiClient.patch<UserRecord>(
    `/auth/users/${userId}/role`,
    { role },
  );
  return response.data;
}

export async function updateNameApi(firstName: string, lastName: string): Promise<UserRecord> {
  const response = await apiClient.patch<UserRecord>('/auth/account/name', { firstName, lastName });
  return response.data;
}

export async function updateBioApi(bio: string): Promise<UserRecord> {
  const response = await apiClient.patch<UserRecord>('/auth/account/bio', { bio });
  return response.data;
}

export async function changePasswordApi(currentPassword: string, newPassword: string): Promise<MessageResponse> {
  const response = await apiClient.patch<MessageResponse>('/auth/account/password', { currentPassword, newPassword });
  return response.data;
}

export async function updateEmailNotificationsApi(enabled: boolean): Promise<UserRecord> {
  const response = await apiClient.patch<UserRecord>('/auth/account/email-notifications', { enabled });
  return response.data;
}

export async function getUserByIdApi(userId: string): Promise<UserRecord> {
  const response = await apiClient.get<UserRecord>(`/auth/users/${userId}`);
  return response.data;
}

export async function deleteUserApi(userId: string): Promise<{ message: string }> {
  const response = await apiClient.delete<{ message: string }>(`/auth/users/${userId}`);
  return response.data;
}

export async function blockUserApi(userId: string, password: string): Promise<UserRecord> {
  const response = await apiClient.patch<UserRecord>(
    `/auth/users/${userId}/block`,
    { password },
  );
  return response.data;
}

export async function restoreUserApi(userId: string): Promise<UserRecord> {
  const response = await apiClient.patch<UserRecord>(
    `/auth/users/${userId}/restore`,
  );
  return response.data;
}

export async function softDeleteUserApi(userId: string, password: string): Promise<{ message: string }> {
  const response = await apiClient.patch<{ message: string }>(
    `/auth/users/${userId}/soft-delete`,
    { password },
  );
  return response.data;
}

// ── Task Types ──

export interface TaskUser {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
}

export interface TaskRecord {
  id: string;
  title: string;
  description: string;
  status: 'in_progress' | 'completed' | 'frozen';
  priority: 'low' | 'medium' | 'urgent';
  dueDate: string;
  finished: boolean;
  assignedTo: TaskUser;
  assignedToId: string;
  assignedBy: TaskUser;
  assignedById: string;
  reviewer: TaskUser;
  reviewerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskRequest {
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'urgent';
  dueDate: string;
  assignedToId: string;
  reviewerId: string;
}

// ── Task API Functions ──

export async function createTaskApi(data: CreateTaskRequest): Promise<TaskRecord> {
  const response = await apiClient.post<TaskRecord>('/tasks', data);
  return response.data;
}

export async function getTasksApi(): Promise<TaskRecord[]> {
  const response = await apiClient.get<TaskRecord[]>('/tasks');
  return response.data;
}

export async function getTaskApi(taskId: string): Promise<TaskRecord> {
  const response = await apiClient.get<TaskRecord>(`/tasks/${taskId}`);
  return response.data;
}

export async function updateTaskStatusApi(taskId: string, status: string): Promise<TaskRecord> {
  const response = await apiClient.patch<TaskRecord>(`/tasks/${taskId}/status`, { status });
  return response.data;
}

export async function unfreezeTaskApi(taskId: string): Promise<TaskRecord> {
  const response = await apiClient.patch<TaskRecord>(`/tasks/${taskId}/unfreeze`);
  return response.data;
}

export async function deleteTaskApi(taskId: string): Promise<{ message: string }> {
  const response = await apiClient.delete<{ message: string }>(`/tasks/${taskId}`);
  return response.data;
}
