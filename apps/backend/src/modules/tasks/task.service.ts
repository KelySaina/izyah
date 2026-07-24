import type { Task, User } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { ApiError } from '../../utils/http';
import { toUserDTO, type UserDTO } from '../users/user.service';
import { enqueueNotification } from '../../queue';
import type { CreateTaskInput, UpdateTaskInput } from './task.schemas';

export interface TaskDTO {
  id: string;
  eventId: string;
  title: string;
  status: Task['status'];
  assignedUserId: string | null;
  assignedUser: UserDTO | null;
  createdAt: Date;
}

type TaskWithAssignee = Task & { assignedUser?: User | null };

function toTaskDTO(task: TaskWithAssignee): TaskDTO {
  return {
    id: task.id,
    eventId: task.eventId,
    title: task.title,
    status: task.status,
    assignedUserId: task.assignedUserId,
    assignedUser: task.assignedUser ? toUserDTO(task.assignedUser) : null,
    createdAt: task.createdAt,
  };
}

async function assertEventExists(eventId: string): Promise<void> {
  const exists = await prisma.event.count({ where: { id: eventId } });
  if (!exists) throw ApiError.notFound('Event not found');
}

/** Load a task and confirm it belongs to the given event. */
async function findTaskInEvent(eventId: string, taskId: string): Promise<Task> {
  await assertEventExists(eventId);
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task || task.eventId !== eventId) throw ApiError.notFound('Task not found');
  return task;
}

export async function createTask(eventId: string, input: CreateTaskInput): Promise<TaskDTO> {
  await assertEventExists(eventId);
  const task = await prisma.task.create({
    data: { eventId, title: input.title },
    include: { assignedUser: true },
  });
  return toTaskDTO(task);
}

export async function listTasks(eventId: string): Promise<TaskDTO[]> {
  await assertEventExists(eventId);
  const tasks = await prisma.task.findMany({
    where: { eventId },
    include: { assignedUser: true },
    orderBy: { createdAt: 'asc' },
  });
  return tasks.map(toTaskDTO);
}

export async function claimTask(
  eventId: string,
  taskId: string,
  userId: string,
  displayName: string,
): Promise<TaskDTO> {
  const existing = await findTaskInEvent(eventId, taskId);
  const task = await prisma.task.update({
    where: { id: taskId },
    data: { assignedUserId: userId, status: 'CLAIMED' },
    include: { assignedUser: true },
  });

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { slug: true, title: true, creatorId: true },
  });
  if (event && event.creatorId !== userId) {
    void enqueueNotification({
      userId: event.creatorId,
      type: 'task_claimed',
      payload: {
        eventId,
        eventSlug: event.slug,
        eventTitle: event.title,
        taskTitle: existing.title,
        displayName,
      },
    }).catch(() => undefined);
  }

  return toTaskDTO(task);
}

export async function releaseTask(
  eventId: string,
  taskId: string,
  userId: string,
): Promise<TaskDTO> {
  const existing = await findTaskInEvent(eventId, taskId);
  // Only the current assignee may release the task back to the pool.
  if (existing.assignedUserId !== userId) {
    throw ApiError.forbidden('Only the assignee can release this task');
  }
  const task = await prisma.task.update({
    where: { id: taskId },
    data: { assignedUserId: null, status: 'OPEN' },
    include: { assignedUser: true },
  });
  return toTaskDTO(task);
}

export async function updateTask(
  eventId: string,
  taskId: string,
  input: UpdateTaskInput,
): Promise<TaskDTO> {
  await findTaskInEvent(eventId, taskId);
  const task = await prisma.task.update({
    where: { id: taskId },
    data: input,
    include: { assignedUser: true },
  });
  return toTaskDTO(task);
}
